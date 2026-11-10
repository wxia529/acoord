/**
 * ABACUS workflows: BSSE (counterpoise) set generation, BSSE energy
 * collection, and INPUT generation for geometry / variable-cell optimisation.
 *
 * Every command is intentionally a short guided wizard: the user picks the
 * active structure, answers two or three questions, and ACoord writes a
 * ready-to-run folder.  No manual editing of STRU / INPUT is required, which is
 * what makes the counterpoise workflow usable by non-experts.
 */

import { basename, dirname, join } from 'node:path';
import * as vscode from 'vscode';
import { Structure } from '../models/structure.js';
import { FileManager } from '../io/fileManager.js';
import { STRUParser } from '../io/parsers/struParser.js';
import { AbacusInput } from '../io/abacus/abacusInput.js';
import {
  CALCULATION_LABELS,
  DEFAULT_CALCULATION_DEFAULTS,
  applyCalculationPreset,
  buildGammaOnlyKpt,
  createDefaultInput,
  describeCalculation,
} from '../io/abacus/abacusPresets.js';
import type {
  AbacusBasisType,
  AbacusCalculationKind,
  AbacusRelaxMethod,
} from '../io/abacus/abacusPresets.js';
import {
  buildBssePlan,
  detectBsseFragments,
  ensureVacuumBox,
  formatComposition,
} from '../io/abacus/bsseGenerator.js';
import type {
  BsseCustomGroup,
  BsseFragment,
  BsseFragmentMode,
} from '../io/abacus/bsseGenerator.js';
import { buildBsseFileSet } from '../io/abacus/bsseSetWriter.js';
import type { BsseIndex, BsseIndexEntry } from '../io/abacus/bsseSetWriter.js';
import {
  buildBsseResultMarkdown,
  computeCounterpoise,
  parseAbacusTotalEnergy,
} from '../io/abacus/bsseEnergy.js';
import type { AbacusEnergyReading } from '../io/abacus/bsseEnergy.js';
import type { StructureEditorProvider } from '../providers/structureEditorProvider.js';

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

/** Register every ABACUS-related command contributed by ACoord. */
export function registerAbacusCommands(
  context: vscode.ExtensionContext,
  provider: StructureEditorProvider
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('acoord.generateBsseSet', async () => {
      await runGuarded('Generate BSSE set', () => generateBsseSet(provider));
    }),
    vscode.commands.registerCommand('acoord.collectBsseEnergies', async () => {
      await runGuarded('Collect BSSE energies', collectBsseEnergies);
    }),
    vscode.commands.registerCommand('acoord.generateAbacusInput', async () => {
      await runGuarded('Generate ABACUS INPUT', () => generateAbacusInput(provider));
    })
  );
}

async function runGuarded(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`ACoord ${label} failed: ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BSSE set generation
// ─────────────────────────────────────────────────────────────────────────────

interface ModeItem extends vscode.QuickPickItem {
  mode: BsseFragmentMode;
}

const BSSE_MODE_ITEMS: ModeItem[] = [
  {
    label: '$(symbol-class) Molecules / connected fragments',
    description: 'recommended',
    detail: 'One fragment per bonded molecule. Isolated atoms become their own fragment.',
    mode: 'molecule',
  },
  {
    label: '$(symbol-string) One fragment per element',
    description: 'per element',
    detail: 'Every element keeps its nuclei; the other elements stay as empty centres.',
    mode: 'element',
  },
  {
    label: '$(symbol-parameter) One fragment per atom',
    description: 'like the ABACUS water example',
    detail: 'Atom-by-atom counterpoise: water becomes O + H1 + H2, i.e. four runs in total.',
    mode: 'atom',
  },
  {
    label: '$(list-selection) Pick the fragments by hand',
    description: 'custom groups',
    detail: 'Choose the atoms of each fragment from a list - use this when the automatic grouping picks the wrong atoms.',
    mode: 'custom',
  },
  {
    label: '$(symbol-namespace) One fragment per species label',
    description: 'labels written in the file',
    detail: 'Uses the labels of the structure, e.g. O_water / H_water / Cu_surf in a STRU.',
    mode: 'species',
  },
];

interface AtomPickItem extends vscode.QuickPickItem {
  atomId: string;
  element: string;
}

async function generateBsseSet(provider: StructureEditorProvider): Promise<void> {
  const target = await resolveStructure(provider);
  if (!target) {
    return;
  }
  const original = target.structure;
  const structure = ensureVacuumBox(original);
  const notes: string[] = [];
  const sourceNameLabel = target.uri ? basename(target.uri.fsPath) : '<unsaved structure>';
  if (target.uri && !isStruFile(target.uri)) {
    notes.push(
      `The source file \`${sourceNameLabel}\` is not an ABACUS STRU, so ` +
        '`ATOMIC_SPECIES` / `NUMERICAL_ORBITAL` hold ACoord defaults. ' +
        'Confirm the pseudopotential / orbital file names (and `pseudo_dir` / `orbital_dir` in INPUT) before running.'
    );
  }
  if (!original.unitCell && structure.unitCell) {
    notes.push(
      `The source file had no cell, so a cubic box of ${structure.unitCell.a.toFixed(2)} Angstrom ` +
        'with 15 Angstrom of vacuum was added around the molecule (ABACUS needs LATTICE_VECTORS).'
    );
  }

  let modeItem = await vscode.window.showQuickPick(BSSE_MODE_ITEMS, {
    placeHolder: 'BSSE: how should the fragments be defined?',
    ignoreFocusOut: true,
    matchOnDetail: true,
  });
  if (!modeItem) {
    return;
  }

  let mode: BsseFragmentMode = modeItem.mode;
  let customGroups: BsseCustomGroup[] | undefined;
  if (mode === 'custom') {
    customGroups = await pickCustomFragments(structure);
    if (!customGroups) {
      return;
    }
    if (customGroups.length < 2) {
      vscode.window.showWarningMessage(
        'BSSE needs at least two fragments: assign the atoms to two or more groups.'
      );
      return;
    }
  }

  let fragments: BsseFragment[] = [];
  for (;;) {
    try {
      fragments = detectBsseFragments(structure, mode, customGroups);
    } catch (error) {
      vscode.window.showErrorMessage(
        `BSSE: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    if (fragments.length === 0) {
      vscode.window.showErrorMessage('BSSE: no fragment could be built from this structure.');
      return;
    }
    if (mode !== 'molecule' || fragments.length >= 2) {
      break;
    }
    const answer = await vscode.window.showWarningMessage(
      `Only one connected fragment (${fragments[0]?.composition ?? 'system'}) was found, ` +
        'so a per-molecule BSSE set would correct nothing.',
      { modal: true },
      'Use per-atom mode',
      'Use per-element mode',
      'Keep one fragment'
    );
    if (answer === 'Use per-atom mode') {
      mode = 'atom';
    } else if (answer === 'Use per-element mode') {
      mode = 'element';
    } else {
      break;
    }
  }

  const sourceDir = target.uri ? dirname(target.uri.fsPath) : defaultWorkspaceDir();
  if (!sourceDir) {
    vscode.window.showErrorMessage('BSSE: no folder available; open a workspace folder first.');
    return;
  }
  const sourceName = target.uri
    ? basename(target.uri.fsPath).replace(/\.[^.]+$/, '')
    : structure.name || 'structure';

  const outDirInput = await vscode.window.showInputBox({
    prompt: 'Folder for the BSSE calculation set',
    value: join(sourceDir, `${sourceName}_bsse`),
    ignoreFocusOut: true,
    validateInput: (text) => (text.trim() ? undefined : 'Enter a folder path'),
  });
  if (!outDirInput) {
    return;
  }
  const outDir = outDirInput.trim();

  const template = (await readExistingInput(sourceDir)) ?? createDefaultInput({ kind: 'scf' });
  const ecutwfc = await askNumber(
    'ecutwfc for every single-point run (Ry)',
    template.getNumber('ecutwfc') ?? DEFAULT_CALCULATION_DEFAULTS.ecutwfc,
    1
  );
  if (ecutwfc === undefined) {
    return;
  }
  const basisItem = await vscode.window.showQuickPick(
    [
      { label: 'lcao', description: 'numerical atomic orbitals (recommended for BSSE)' },
      { label: 'pw', description: 'plane waves' },
    ],
    {
      placeHolder: 'basis_type for the BSSE runs',
      ignoreFocusOut: true,
    }
  );
  if (!basisItem) {
    return;
  }
  const basisType = basisItem.label as AbacusBasisType;
  template.set('ecutwfc', ecutwfc);
  template.set('basis_type', basisType);
  template.set('calculation', 'scf');

  const plan = buildBssePlan(structure, { mode, customGroups });
  const files = buildBsseFileSet({
    plan,
    inputTemplate: template,
    title: `${sourceName} (${mode} fragments)`,
    gammaOnly: template.get('gamma_only') !== '0',
    notes,
  });

  if (!(await confirmOverwrite(outDir))) {
    return;
  }

  await writeGeneratedFiles(outDir, files);

  const summary = plan
    .map((calculation) =>
      calculation.isReference
        ? `STRU_${calculation.index} = full system (ntype ${calculation.ntype})`
        : `STRU_${calculation.index} = ${calculation.name} (ntype ${calculation.ntype})`
    )
    .join('\n');

  const action = await vscode.window.showInformationMessage(
    `BSSE set written to ${outDir}:\n${summary}`,
    { modal: false },
    'Open README'
  );
  if (action === 'Open README') {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(outDir, 'README_bsse.md'))
    );
    await vscode.window.showTextDocument(doc, { preview: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BSSE energy collection
// ─────────────────────────────────────────────────────────────────────────────

async function collectBsseEnergies(): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select BSSE folder',
  });
  if (!picked || picked.length === 0) {
    return;
  }
  const dir = picked[0].fsPath;
  const index = await readBsseIndex(dir);
  const entries = index?.calculations ?? (await scanStruEntries(dir));
  if (entries.length === 0) {
    vscode.window.showErrorMessage(
      `No BSSE set found in ${dir}: expected STRU_0, STRU_1, ... or bsse_index.json.`
    );
    return;
  }

  const scriptEnergies = await readEnergyList(dir);
  const readings: Array<{ entry: BsseIndexEntry; reading: AbacusEnergyReading }> = [];
  const missing: string[] = [];

  for (const entry of entries) {
    const fromList = scriptEnergies.get(entry.index);
    if (fromList !== undefined) {
      readings.push({
        entry,
        reading: { label: entry.stru, energy: fromList, source: 'energies.txt' },
      });
      continue;
    }
    const logUri = await findLogForCalculation(dir, entry);
    if (!logUri) {
      missing.push(entry.stru);
      continue;
    }
    const content = await readTextFile(logUri);
    const energy = content ? parseAbacusTotalEnergy(content) : undefined;
    if (energy === undefined) {
      missing.push(entry.stru);
      continue;
    }
    readings.push({
      entry,
      reading: {
        label: entry.stru,
        energy,
        source: vscode.workspace.asRelativePath(logUri, false),
      },
    });
  }

  const referenceEntry = readings.find((item) => item.entry.isReference)
    ?? (index === undefined ? readings.find((item) => item.entry.index === 0) : undefined);
  const reference = referenceEntry?.reading;
  const fragments = readings
    .filter((item) => item !== referenceEntry)
    .map((item) => item.reading);

  const result = computeCounterpoise(reference, fragments);
  const markdown = buildBsseResultMarkdown(result, {
    title: basename(dir),
    missing,
  });

  const resultUri = vscode.Uri.file(join(dir, 'bsse_result.md'));
  await vscode.workspace.fs.writeFile(resultUri, new TextEncoder().encode(markdown));
  const document = await vscode.workspace.openTextDocument(resultUri);
  await vscode.window.showTextDocument(document, { preview: true });

  if (result.corrected !== undefined) {
    vscode.window.showInformationMessage(
      `BSSE-corrected energy: ${result.corrected.toFixed(6)} eV`
    );
  } else if (missing.length > 0) {
    vscode.window.showWarningMessage(
      `Missing energies for: ${missing.join(', ')}. Run the calculations first.`
    );
  }
}

async function readEnergyList(dir: string): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const content = await readTextFile(vscode.Uri.file(join(dir, 'energies.txt')));
  if (!content) {
    return result;
  }
  for (const line of content.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      continue;
    }
    const index = Number(parts[0]);
    const energy = Number(parts[1]);
    if (Number.isInteger(index) && Number.isFinite(energy)) {
      result.set(index, energy);
    }
  }
  return result;
}

const LOG_CANDIDATES: Array<(entry: BsseIndexEntry) => string> = [
  (entry) => join(`calc_${entry.index}`, 'log.txt'),
  (entry) => join(`run_${entry.index}`, 'log.txt'),
  (entry) => join(`OUT.STRU_${entry.index}`, 'running_scf.log'),
  (entry) => join(`OUT.${entry.stru}`, 'running_scf.log'),
  (entry) => join(`OUT.${entry.index}`, 'running_scf.log'),
  (entry) => `${entry.stru}.log`,
];

async function findLogForCalculation(
  dir: string,
  entry: BsseIndexEntry
): Promise<vscode.Uri | undefined> {
  for (const candidate of LOG_CANDIDATES) {
    const uri = vscode.Uri.file(join(dir, candidate(entry)));
    if (await pathExists(uri)) {
      return uri;
    }
  }
  // Last resort: any running_scf.log below the folder whose path mentions the index.
  const matches = await vscode.workspace.findFiles(
    new vscode.RelativePattern(vscode.Uri.file(dir), `**/*${entry.index}*/running_scf.log`),
    null,
    5
  );
  return matches[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// ABACUS INPUT generation (geometry / variable-cell optimisation)
// ─────────────────────────────────────────────────────────────────────────────

interface CalculationItem extends vscode.QuickPickItem {
  calculation: AbacusCalculationKind;
}

const CALCULATION_ITEMS: CalculationItem[] = [
  {
    label: 'SCF single point',
    description: 'calculation scf',
    detail: 'One self-consistent field calculation.',
    calculation: 'scf',
  },
  {
    label: 'Geometry optimisation (fixed cell)',
    description: 'calculation relax',
    detail: 'Relaxes ionic positions only; the STRU lattice is kept fixed.',
    calculation: 'relax',
  },
  {
    label: 'Variable-cell optimisation',
    description: 'calculation cell-relax',
    detail: 'Relaxes ions and lattice vectors together (cal_stress 1).',
    calculation: 'cell-relax',
  },
  {
    label: 'Molecular dynamics',
    description: 'calculation md',
    detail: 'Born-Oppenheimer MD with a fixed number of steps.',
    calculation: 'md',
  },
];

async function generateAbacusInput(provider: StructureEditorProvider): Promise<void> {
  const target = await resolveStructure(provider);
  if (!target) {
    return;
  }
  const structure = target.structure;
  const dir = target.uri ? dirname(target.uri.fsPath) : defaultWorkspaceDir();
  if (!dir) {
    vscode.window.showErrorMessage('ACoord: no folder available; open a workspace folder first.');
    return;
  }

  const kindItem = await vscode.window.showQuickPick(CALCULATION_ITEMS, {
    placeHolder: 'ABACUS task',
    ignoreFocusOut: true,
    matchOnDetail: true,
  });
  if (!kindItem) {
    return;
  }
  const kind = kindItem.calculation;

  const existing = await readExistingInput(dir);
  const ecutwfc = await askNumber(
    'ecutwfc (Ry)',
    existing?.getNumber('ecutwfc') ?? DEFAULT_CALCULATION_DEFAULTS.ecutwfc,
    1
  );
  if (ecutwfc === undefined) {
    return;
  }
  const basisItem = await vscode.window.showQuickPick(
    [
      { label: 'lcao', description: 'numerical atomic orbitals' },
      { label: 'pw', description: 'plane waves' },
    ],
    { placeHolder: 'basis_type', ignoreFocusOut: true }
  );
  if (!basisItem) {
    return;
  }

  let relaxNmax: number | undefined;
  let relaxMethod: AbacusRelaxMethod | undefined;
  let forceThrEv: number | undefined;
  let stressThrKbar: number | undefined;
  let mdNstep: number | undefined;

  if (kind === 'relax' || kind === 'cell-relax') {
    relaxNmax = await askNumber(
      'relax_nmax (maximum ionic steps)',
      existing?.getNumber('relax_nmax') ?? DEFAULT_CALCULATION_DEFAULTS.relaxNmax,
      1
    );
    if (relaxNmax === undefined) {
      return;
    }
    const methodItem = await vscode.window.showQuickPick(
      [
        { label: 'cg', description: 'conjugate gradient (robust)' },
        { label: 'bfgs', description: 'BFGS (fast close to the minimum)' },
        { label: 'sd', description: 'steepest descent (safe start)' },
      ],
      { placeHolder: 'relax_method', ignoreFocusOut: true }
    );
    if (!methodItem) {
      return;
    }
    relaxMethod = methodItem.label as AbacusRelaxMethod;
    forceThrEv = await askNumber(
      'force_thr_ev (eV/Angstrom)',
      existing?.getNumber('force_thr_ev') ?? DEFAULT_CALCULATION_DEFAULTS.forceThrEv,
      0
    );
    if (forceThrEv === undefined) {
      return;
    }
    if (kind === 'cell-relax') {
      stressThrKbar = await askNumber(
        'stress_thr (kbar)',
        existing?.getNumber('stress_thr') ?? DEFAULT_CALCULATION_DEFAULTS.stressThrKbar,
        0
      );
      if (stressThrKbar === undefined) {
        return;
      }
    }
  } else if (kind === 'md') {
    mdNstep = await askNumber(
      'md_nstep (number of MD steps)',
      existing?.getNumber('md_nstep') ?? DEFAULT_CALCULATION_DEFAULTS.mdNstep,
      1
    );
    if (mdNstep === undefined) {
      return;
    }
  }

  const input = existing ?? createDefaultInput({ kind });
  applyCalculationPreset(input, {
    kind,
    ecutwfc,
    basisType: basisItem.label as AbacusBasisType,
    relaxNmax,
    relaxMethod,
    forceThrEv,
    stressThrKbar,
    mdNstep,
  });

  const fixedAtoms = structure.atoms.filter((atom) => atom.role === 'real' && atom.fixed);
  if (fixedAtoms.length > 0 && (kind === 'relax' || kind === 'cell-relax')) {
    const answer = await vscode.window.showInformationMessage(
      `${fixedAtoms.length} atom(s) are marked as fixed. Write them into the STRU file as 0 0 0 move flags?`,
      'Write STRU',
      'Skip'
    );
    if (answer === 'Write STRU' && target.uri && isStruFile(target.uri)) {
      const parser = new STRUParser();
      await vscode.workspace.fs.writeFile(
        target.uri,
        new TextEncoder().encode(`${parser.serialize(structure)}\n`)
      );
    }
  }

  const inputText = input.serialize();
  const inputUri = vscode.Uri.file(join(dir, 'INPUT'));
  if (await pathExists(inputUri)) {
    const choice = await vscode.window.showWarningMessage(
      `${inputUri.fsPath} already exists.`,
      { modal: true },
      'Overwrite',
      'Save as INPUT.new'
    );
    if (!choice) {
      return;
    }
    const targetUri = choice === 'Overwrite'
      ? inputUri
      : vscode.Uri.file(join(dir, 'INPUT.new'));
    await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(inputText));
  } else {
    await vscode.workspace.fs.writeFile(inputUri, new TextEncoder().encode(inputText));
  }

  if (input.get('gamma_only') === '1' && !(await pathExists(vscode.Uri.file(join(dir, 'KPT'))))) {
    const createKpt = await vscode.window.showInformationMessage(
      'gamma_only = 1: also write a Gamma-only KPT file?',
      'Write KPT',
      'Skip'
    );
    if (createKpt === 'Write KPT') {
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(join(dir, 'KPT')),
        new TextEncoder().encode(buildGammaOnlyKpt())
      );
    }
  }

  vscode.window.showInformationMessage(
    `INPUT written for ${describeCalculation(kind)}${kind === 'md' ? '' : ` (${CALCULATION_LABELS[kind]})`}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedStructure {
  structure: Structure;
  uri?: vscode.Uri;
}

async function resolveStructure(
  provider: StructureEditorProvider
): Promise<ResolvedStructure | undefined> {
  const activeUri = getActiveStructureUri();
  if (activeUri) {
    const inMemory = provider.getStructureForUri(activeUri);
    if (inMemory) {
      return { structure: inMemory, uri: activeUri };
    }
    const content = await readTextFile(activeUri);
    if (content) {
      try {
        const structures = FileManager.loadStructures(activeUri.fsPath, content);
        const structure = structures[structures.length - 1];
        if (structure) {
          return { structure, uri: activeUri };
        }
      } catch {
        // Not a structure file: fall through to the file picker.
      }
    }
  }

  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: false,
    openLabel: 'Use this structure',
    filters: {
      'Structure files': [
        'stru', 'xyz', 'cif', 'poscar', 'vasp', 'pdb', 'fdf', 'cell', 'dat', 'in', 'pwi', 'gjf', 'inp', 'acoord',
      ],
    },
  });
  if (!picked || picked.length === 0) {
    return undefined;
  }
  const content = await readTextFile(picked[0]);
  if (!content) {
    vscode.window.showErrorMessage(`ACoord: cannot read ${picked[0].fsPath}`);
    return undefined;
  }
  const structures = FileManager.loadStructures(picked[0].fsPath, content);
  const structure = structures[structures.length - 1];
  if (!structure) {
    vscode.window.showErrorMessage(`ACoord: no structure found in ${picked[0].fsPath}`);
    return undefined;
  }
  return { structure, uri: picked[0] };
}

function getActiveStructureUri(): vscode.Uri | undefined {
  const input = vscode.window.tabGroups.activeTabGroup?.activeTab?.input;
  if (input instanceof vscode.TabInputCustom && input.viewType === 'acoord.structureEditor') {
    return input.uri;
  }
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  return vscode.window.activeTextEditor?.document.uri;
}

function defaultWorkspaceDir(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function readTextFile(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function readExistingInput(dir: string): Promise<AbacusInput | undefined> {
  const content = await readTextFile(vscode.Uri.file(join(dir, 'INPUT')));
  if (!content) {
    return undefined;
  }
  return AbacusInput.parse(content);
}

async function confirmOverwrite(outDir: string): Promise<boolean> {
  let existingFiles: Array<[string, vscode.FileType]> = [];
  try {
    existingFiles = await vscode.workspace.fs.readDirectory(vscode.Uri.file(outDir));
  } catch {
    return true;
  }
  if (existingFiles.length === 0) {
    return true;
  }
  const answer = await vscode.window.showWarningMessage(
    `${outDir} already contains files. Overwrite STRU_* / INPUT_* / README_bsse.md?`,
    { modal: true },
    'Overwrite'
  );
  return answer === 'Overwrite';
}

async function writeGeneratedFiles(
  outDir: string,
  files: Array<{ name: string; content: string }>
): Promise<void> {
  const dirUri = vscode.Uri.file(outDir);
  await vscode.workspace.fs.createDirectory(dirUri);
  for (const file of files) {
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(join(outDir, file.name)),
      new TextEncoder().encode(file.content)
    );
  }
}

async function readBsseIndex(dir: string): Promise<BsseIndex | undefined> {
  const content = await readTextFile(vscode.Uri.file(join(dir, 'bsse_index.json')));
  if (!content) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as BsseIndex;
    if (!Array.isArray(parsed.calculations)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

async function scanStruEntries(dir: string): Promise<BsseIndexEntry[]> {
  const entries: BsseIndexEntry[] = [];
  let files;
  try {
    files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
  } catch {
    return entries;
  }
  for (const [name, type] of files) {
    if (type !== vscode.FileType.File) {
      continue;
    }
    const match = /^STRU_(\d+)$/.exec(name);
    if (!match) {
      continue;
    }
    const index = Number(match[1]);
    entries.push({
      index,
      name,
      stru: name,
      input: `INPUT_${index}`,
      ntype: 0,
      species: [],
      isReference: index === 0,
    });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries;
}

/**
 * Hand-picked fragments: the user selects the atoms of every fragment from a
 * list, so any grouping can be expressed without editing the structure file.
 * The last fragment takes whatever is left, which keeps the flow short.
 */
async function pickCustomFragments(
  structure: Structure
): Promise<BsseCustomGroup[] | undefined> {
  const realAtoms = structure.atoms.filter((atom) => atom.role === 'real');
  if (realAtoms.length < 2) {
    vscode.window.showErrorMessage('BSSE: at least two real atoms are needed.');
    return undefined;
  }
  const total = await askNumber(
    `How many fragments? (${realAtoms.length} real atoms in this structure)`,
    2,
    2
  );
  if (total === undefined) {
    return undefined;
  }
  const indexOf = new Map(realAtoms.map((atom, index) => [atom.id, index + 1]));
  let remaining = [...realAtoms];
  const groups: BsseCustomGroup[] = [];

  for (let step = 0; step < total; step += 1) {
    const isLast = step === total - 1;
    if (isLast || remaining.length === 1) {
      groups.push({
        name: formatComposition(remaining.map((atom) => atom.element)),
        atomIds: remaining.map((atom) => atom.id),
      });
      break;
    }
    const items: AtomPickItem[] = remaining.map((atom) => ({
      label: `#${indexOf.get(atom.id)}  ${atom.element}`,
      description: `${atom.x.toFixed(3)}, ${atom.y.toFixed(3)}, ${atom.z.toFixed(3)}`,
      atomId: atom.id,
      element: atom.element,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      ignoreFocusOut: true,
      placeHolder:
        `Fragment ${step + 1} of ${total}: pick its atoms ` +
        `(${remaining.length} left, the last fragment takes the rest)`,
      matchOnDescription: true,
    });
    if (!picked) {
      return undefined;
    }
    if (picked.length === 0) {
      vscode.window.showWarningMessage('BSSE: a fragment needs at least one atom.');
      return undefined;
    }
    const chosen = new Set(picked.map((item) => item.atomId));
    groups.push({
      name: formatComposition(picked.map((item) => item.element)),
      atomIds: Array.from(chosen),
    });
    remaining = remaining.filter((atom) => !chosen.has(atom.id));
    if (remaining.length === 0) {
      break;
    }
  }
  return groups;
}

async function askNumber(
  prompt: string,
  value: number,
  minimum?: number
): Promise<number | undefined> {
  const raw = await vscode.window.showInputBox({
    prompt,
    value: String(value),
    ignoreFocusOut: true,
    validateInput: (text) => {
      const parsed = Number(text.trim());
      if (!text.trim() || !Number.isFinite(parsed)) {
        return 'Enter a number';
      }
      if (minimum !== undefined && parsed < minimum) {
        return `Must be >= ${minimum}`;
      }
      return undefined;
    },
  });
  return raw === undefined ? undefined : Number(raw.trim());
}

function isStruFile(uri: vscode.Uri): boolean {
  const name = basename(uri.fsPath);
  return /STRU/i.test(name) || name.toLowerCase().endsWith('.stru');
}
