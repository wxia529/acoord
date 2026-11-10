/**
 * Counterpoise (BSSE) calculation planner.
 *
 * Boys-Bernardi counterpoise correction needs one single-point calculation per
 * fragment, where the fragment keeps its own nuclei but *all* other atoms are
 * present as basis-only ("empty") centres.  ABACUS expresses this with the
 * `X_empty` species suffix, so every fragment calculation becomes a STRU file
 * whose ghost block contains the rest of the system at the exact same
 * coordinates.
 *
 * `buildBssePlan()` turns a structure into that ordered list of calculations:
 *
 *   STRU_0  full system            -> E_total
 *   STRU_1  fragment 1 + ghosts    -> E_1
 *   ...
 *
 * and the corrected interaction energy is E_total - sum(E_i).
 */

import { Structure } from '../../models/structure.js';
import { UnitCell } from '../../models/unitCell.js';
import { collectStruSpeciesLabels, getStruAtomSpeciesLabel } from '../parsers/struParser.js';

export type BsseFragmentMode = 'molecule' | 'element' | 'atom' | 'species' | 'custom';

/** One hand-picked fragment: the atoms that keep their nuclei. */
export interface BsseCustomGroup {
  name?: string;
  atomIds: string[];
}

export interface BsseFragment {
  /** Stable identifier (`frag1`, ...). */
  id: string;
  /** Human readable label used in file names and reports (`H2O`, `O#1`). */
  name: string;
  /** Atom ids of the fragment (real atoms only). */
  atomIds: string[];
  /** Hill-style composition, e.g. `H2O`. */
  composition: string;
}

export interface BsseCalculationPlan {
  index: number;
  /** Short name, e.g. `full` or `H2O`. */
  name: string;
  fileName: string;
  inputFileName: string;
  structure: Structure;
  speciesLabels: string[];
  ntype: number;
  fragment?: BsseFragment;
  isReference: boolean;
}

export interface BssePlanOptions {
  mode: BsseFragmentMode;
  /** Include the full-system reference calculation (default: true). */
  includeReference?: boolean;
  /** Required for `mode: 'custom'`: the atom ids of every fragment. */
  customGroups?: BsseCustomGroup[];
}

/**
 * Split a structure into fragments.
 *
 * - `molecule`: connected components of the existing bond graph (each molecule
 *   is one fragment; isolated atoms become their own fragment).
 * - `element`: one fragment per element.
 * - `atom`: one fragment per atom (identical to the ABACUS water example).
 * - `species`: one fragment per species label written in the file, so a STRU
 *   that labels its groups (`O_water`, `H_water`, `Cu_surf`, ...) defines the
 *   fragments itself.
 * - `custom`: the fragment membership comes from `customGroups`.
 */
export function detectBsseFragments(
  structure: Structure,
  mode: BsseFragmentMode,
  customGroups?: BsseCustomGroup[]
): BsseFragment[] {
  const realAtoms = structure.atoms.filter((atom) => atom.role === 'real');
  if (realAtoms.length === 0) {
    throw new Error('BSSE: the structure contains no real atoms to fragment');
  }

  if (mode === 'atom') {
    return realAtoms.map((atom, index) => ({
      id: `frag${index + 1}`,
      name: `${atom.element}${index + 1}`,
      atomIds: [atom.id],
      composition: atom.element,
    }));
  }

  if (mode === 'species') {
    const groups = new Map<string, string[]>();
    for (const atom of realAtoms) {
      const label = getStruAtomSpeciesLabel(atom);
      const list = groups.get(label) ?? [];
      list.push(atom.id);
      groups.set(label, list);
    }
    return Array.from(groups.entries()).map(([label, atomIds], index) => ({
      id: `frag${index + 1}`,
      name: label,
      atomIds,
      composition: formatComposition(
        atomIds.map((id) => structure.getAtom(id)?.element ?? 'X')
      ),
    }));
  }

  if (mode === 'custom') {
    const known = new Set(realAtoms.map((atom) => atom.id));
    const used = new Set<string>();
    const fragments: BsseFragment[] = [];
    for (const [index, group] of (customGroups ?? []).entries()) {
      const atomIds = group.atomIds.filter((id) => known.has(id) && !used.has(id));
      if (atomIds.length === 0) {
        continue;
      }
      atomIds.forEach((id) => used.add(id));
      const composition = formatComposition(
        atomIds.map((id) => structure.getAtom(id)?.element ?? 'X')
      );
      fragments.push({
        id: `frag${fragments.length + 1}`,
        name: group.name?.trim() || composition || `group${index + 1}`,
        atomIds,
        composition,
      });
    }
    return fragments;
  }

  if (mode === 'element') {
    const groups = new Map<string, string[]>();
    for (const atom of realAtoms) {
      const list = groups.get(atom.element) ?? [];
      list.push(atom.id);
      groups.set(atom.element, list);
    }
    return Array.from(groups.entries()).map(([element, atomIds], index) => ({
      id: `frag${index + 1}`,
      name: element,
      atomIds,
      composition: element,
    }));
  }

  // molecule: union-find over the real-atom bond graph.
  // Analyse a clone so that analysing the graph never mutates the caller's
  // structure (bonds may not have been computed yet for file-loaded frames).
  const analysed = structure.hasCalculatedBonds ? structure : structure.clone();
  if (!analysed.hasCalculatedBonds) {
    analysed.calculateBonds();
  }
  const parent = new Map<string, string>();
  for (const atom of realAtoms) {
    parent.set(atom.id, atom.id);
  }
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    let current = id;
    while (parent.get(current) !== root) {
      const next = parent.get(current) as string;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (a: string, b: string): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  };
  for (const bond of analysed.getBonds()) {
    if (parent.has(bond.atomId1) && parent.has(bond.atomId2)) {
      union(bond.atomId1, bond.atomId2);
    }
  }

  const byRoot = new Map<string, string[]>();
  for (const atom of realAtoms) {
    const root = find(atom.id);
    const list = byRoot.get(root) ?? [];
    list.push(atom.id);
    byRoot.set(root, list);
  }

  const usedNames = new Map<string, number>();
  return Array.from(byRoot.values()).map((atomIds, index) => {
    const composition = formatComposition(atomIds.map((id) => {
      const atom = structure.getAtom(id);
      return atom ? atom.element : 'X';
    }));
    const seen = (usedNames.get(composition) ?? 0) + 1;
    usedNames.set(composition, seen);
    return {
      id: `frag${index + 1}`,
      name: seen > 1 ? `${composition}#${seen}` : composition,
      atomIds,
      composition,
    };
  });
}

/** Hill-order composition string of an element list (`H2O`, `CH4`, `NaCl`). */
export function formatComposition(elements: string[]): string {
  const counts = new Map<string, number>();
  for (const element of elements) {
    counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  const hasCarbon = counts.has('C');
  const ordered = Array.from(counts.keys()).sort((a, b) => {
    if (hasCarbon) {
      if (a === 'C') { return -1; }
      if (b === 'C') { return 1; }
      if (a === 'H') { return -1; }
      if (b === 'H') { return 1; }
    }
    return a.localeCompare(b);
  });
  return ordered
    .map((element) => {
      const count = counts.get(element) ?? 0;
      return count > 1 ? `${element}${count}` : element;
    })
    .join('');
}

/**
 * Build the ordered list of single-point calculations needed for a
 * counterpoise correction.
 */
export function buildBssePlan(
  structure: Structure,
  options: BssePlanOptions
): BsseCalculationPlan[] {
  const fragments = detectBsseFragments(structure, options.mode, options.customGroups);
  const plan: BsseCalculationPlan[] = [];
  let index = 0;

  if (options.includeReference !== false) {
    const realIds = new Set(
      structure.atoms.filter((atom) => atom.role === 'real').map((atom) => atom.id)
    );
    plan.push(
      createPlan(createEmptyVariant(structure, realIds), index, 'full', true, undefined)
    );
    index += 1;
  }

  for (const fragment of fragments) {
    const variant = createEmptyVariant(structure, new Set(fragment.atomIds));
    plan.push(createPlan(variant, index, fragment.name, false, fragment));
    index += 1;
  }

  return plan;
}

function createPlan(
  structure: Structure,
  index: number,
  name: string,
  isReference: boolean,
  fragment: BsseFragment | undefined
): BsseCalculationPlan {
  const speciesLabels = collectStruSpeciesLabels(structure);
  return {
    index,
    name,
    fileName: `STRU_${index}`,
    inputFileName: `INPUT_${index}`,
    structure,
    speciesLabels,
    ntype: speciesLabels.length,
    fragment,
    isReference,
  };
}

/**
 * ABACUS is a periodic code: every STRU needs `LATTICE_VECTORS`, even for a
 * single molecule.  Structures read from xyz / pdb / gjf files carry no cell,
 * so the BSSE writer wraps them into a cubic box with enough vacuum around the
 * molecule.  Structures that already own a cell are returned untouched.
 */
export function ensureVacuumBox(structure: Structure, paddingAngstrom = 15): Structure {
  if (structure.unitCell || structure.atoms.length === 0) {
    return structure;
  }
  const xs = structure.atoms.map((atom) => atom.x);
  const ys = structure.atoms.map((atom) => atom.y);
  const zs = structure.atoms.map((atom) => atom.z);
  const extent = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs)
  );
  const box = Math.max(extent + 2 * paddingAngstrom, 10);
  const center: [number, number, number] = [
    (Math.max(...xs) + Math.min(...xs)) / 2,
    (Math.max(...ys) + Math.min(...ys)) / 2,
    (Math.max(...zs) + Math.min(...zs)) / 2,
  ];
  const wrapped = structure.clone();
  wrapped.unitCell = new UnitCell(box, box, box, 90, 90, 90);
  wrapped.translate(box / 2 - center[0], box / 2 - center[1], box / 2 - center[2]);
  wrapped.name = structure.name;
  return wrapped;
}

/**
 * Copy `structure`, keeping `keepRealIds` as real atoms and turning every other
 * atom into an empty (`X_empty`) basis centre.  Atoms that are already ghost
 * centres stay ghosts.
 */
export function createEmptyVariant(
  structure: Structure,
  keepRealIds: Set<string>
): Structure {
  const variant = structure.clone();
  // Drop the saved raw text so the file is generated from scratch with the new
  // species labels, while keeping pseudopotential/orbital rows from metadata.
  variant.metadata.delete('struRawContent');

  for (const atom of variant.atoms) {
    if (atom.role === 'ghost') {
      continue;
    }
    const keep = keepRealIds.has(atom.id);
    const label = getStruAtomSpeciesLabel(atom);
    atom.role = keep ? 'real' : 'ghost';
    if (keep) {
      // keep whatever label the file used, so `O_water` stays `O_water`
      atom.sourceLabel = label === atom.element ? undefined : label;
    } else {
      atom.sourceLabel = `${label}_empty`;
    }
    if (!keep) {
      atom.fixed = false;
      atom.selectiveDynamics = undefined;
    }
  }

  // Bond graph is only meaningful between real atoms.
  variant.calculateBonds();
  return variant;
}
