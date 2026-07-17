import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { ELEMENT_DATA, parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { BOHR_TO_ANGSTROM } from '../../utils/constants.js';
import { fractionalToCartesian } from '../../utils/parserUtils.js';
import { StructureParser } from './structureParser.js';
import { formatCoordinateTriplet } from '../../utils/coordinateFormat.js';

type QEUnit = 'angstrom' | 'bohr' | 'alat' | 'crystal';
export type QEPositionUnit = 'angstrom' | 'crystal';

interface ParsedAtom {
  element: string;
  sourceLabel: string;
  position: [number, number, number];
  fixed: boolean;
  selectiveDynamics?: [boolean, boolean, boolean];
}

interface QESpecies {
  label: string;
  element: string;
  mass: string;
  pseudo: string;
}

interface QELatticeParameters {
  a: number;
  b: number;
  c: number;
  cosAlpha: number;
  cosBeta: number;
  cosGamma: number;
}

interface ParsedCellBlock {
  vectors: number[][];
  nextIndex: number;
  alatFromHeader: number | null;
}

interface ParsedPositionsBlock {
  atoms: ParsedAtom[];
  nextIndex: number;
}

/**
 * Quantum ESPRESSO parser (.in/.pwi input, .out/.pwo log output)
 * - parse: supports pw.x input and output coordinates/cell
 * - serialize: writes pw.x input format
 */
export class QEParser extends StructureParser {
  parse(content: string): Structure {
    // Save complete raw content for format preservation (Strategy 1)
    const rawContent = content;
    
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid QE content: no structure found');
    }
    const structure = frames[frames.length - 1];
    
    // Store raw content in metadata for serialization
    structure.metadata.set('qeRawContent', rawContent);
    
    return structure;
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);
    let frames: Structure[];
    if (this.looksLikeQeOutput(lines)) {
      frames = this.parseOutputTrajectory(lines);
    } else if (this.looksLikeQeInput(lines)) {
      frames = [this.parseInput(lines)];
    } else {
      frames = this.parseOutputTrajectory(lines);
    }
    
    for (const frame of frames) {
      frame.metadata.set('qeRawContent', content);
    }
    
    return frames;
  }

  serialize(structure: Structure): string {
    return this.serializeWithPositionUnit(structure, 'angstrom');
  }

  /** Serialize a pw.x input using Cartesian Å or fractional crystal positions. */
  serializeWithPositionUnit(structure: Structure, positionUnit: QEPositionUnit): string {
    if (structure.atoms.length === 0) {
      throw new Error('Cannot write QE input: structure has no atoms');
    }
    if (positionUnit === 'crystal' && !structure.unitCell) {
      throw new Error('Cannot write QE crystal coordinates: structure has no unit cell');
    }

    // Strategy 1: Use saved raw content and replace coordinate sections
    const savedRawContent = structure.metadata.get('qeRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultQE(structure, positionUnit);
    }

    // Determine if this is a QE input or output file
    const lines = savedRawContent.split(/\r?\n/);
    if (this.looksLikeQeOutput(lines)) {
      // For output files, generate default QE input format
      return this.generateDefaultQE(structure, positionUnit);
    }

    // For input files, replace ATOMIC_POSITIONS and CELL_PARAMETERS sections
    return this.replaceQESections(savedRawContent, structure, positionUnit);
  }

  private generateDefaultQE(structure: Structure, positionUnit: QEPositionUnit): string {
    const lines: string[] = [];
    const prefixRaw = (structure.name || 'structure').trim() || 'structure';
    const prefix = prefixRaw.replace(/\s+/g, '_');

    const speciesOrder: string[] = [];
    for (const atom of structure.atoms) {
      const label = this.atomLabel(atom);
      if (!speciesOrder.includes(label)) {
        speciesOrder.push(label);
      }
    }

    const vectors = structure.unitCell
      ? structure.unitCell.getLatticeVectors()
      : [
        [20, 0, 0],
        [0, 20, 0],
        [0, 0, 20],
      ];

    const hasFixedFlags = this.hasPositionConstraints(structure);

    lines.push('&CONTROL');
    lines.push(`  calculation = 'scf'`);
    lines.push(`  prefix = '${prefix}'`);
    lines.push('/');
    lines.push('&SYSTEM');
    lines.push('  ibrav = 0');
    lines.push(`  nat = ${structure.atoms.length}`);
    lines.push(`  ntyp = ${speciesOrder.length}`);
    lines.push('  ecutwfc = 50');
    lines.push('/');
    lines.push('&ELECTRONS');
    lines.push('  conv_thr = 1.0d-8');
    lines.push('/');
    lines.push('CELL_PARAMETERS angstrom');
    for (const vec of vectors) {
      lines.push(formatCoordinateTriplet(vec));
    }
    lines.push('ATOMIC_SPECIES');
    for (const label of speciesOrder) {
      const element = structure.atoms.find((atom) => this.atomLabel(atom) === label)?.element ?? label;
      const mass = ELEMENT_DATA[element]?.atomicMass ?? 1;
      lines.push(`${label}  ${mass.toFixed(6)}  ${element}.UPF`);
    }
    lines.push(`ATOMIC_POSITIONS ${positionUnit}`);
    for (const atom of structure.atoms) {
      const position = this.positionForSerialization(atom, structure, positionUnit);
      const base = `${this.atomLabel(atom).padEnd(4)}  ${formatCoordinateTriplet(position)}`;
      if (hasFixedFlags) {
        lines.push(`${base}  ${this.formatPositionFlags(atom)}`);
      } else {
        lines.push(base);
      }
    }
    lines.push('K_POINTS gamma');

    return lines.join('\n');
  }

  private replaceQESections(
    rawContent: string,
    structure: Structure,
    positionUnit: QEPositionUnit
  ): string {
    let lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    
    const speciesOrder: string[] = [];
    for (const atom of structure.atoms) {
      const label = this.atomLabel(atom);
      if (!speciesOrder.includes(label)) {
        speciesOrder.push(label);
      }
    }
    const vectors = structure.unitCell
      ? structure.unitCell.getLatticeVectors()
      : null;
    const hasFixedFlags = this.hasPositionConstraints(structure);
    
    const originalNat = this.extractNat(lines);
    const originalSpeciesCount = this.parseSpecies(lines).length;
    const originalSpeciesLines = this.extractSpeciesLines(lines);
    lines = this.normalizeSystemLines(lines, structure.atoms.length, speciesOrder.length, vectors !== null);
    const hasCellParameters = lines.some((candidate) => /^\s*CELL_PARAMETERS\b/i.test(candidate));

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      const upper = trimmed.toUpperCase();

      // Replace CELL_PARAMETERS block
      if (upper.startsWith('CELL_PARAMETERS')) {
        resultLines.push('CELL_PARAMETERS angstrom');
        i++;

        // Skip old cell vectors (3 lines)
        let vecCount = 0;
        while (i < lines.length && vecCount < 3) {
          const checkLine = this.cleanLine(lines[i]);
          if (!checkLine) {
            i++;
            continue;
          }
          const values = checkLine.split(/\s+/).slice(0, 3);
          if (values.length === 3 && values.every((value) => Number.isFinite(this.parseNumber(value)))) {
            i++;
            vecCount++;
          } else {
            break;
          }
        }

        // Write new cell vectors
        if (vectors) {
          for (const vec of vectors) {
            resultLines.push(formatCoordinateTriplet(vec));
          }
        }
        continue;
      }

      // Replace ATOMIC_SPECIES block
      if (upper === 'ATOMIC_SPECIES') {
        if (!hasCellParameters && vectors) {
          resultLines.push('CELL_PARAMETERS angstrom');
          for (const vec of vectors) {
            resultLines.push(formatCoordinateTriplet(vec));
          }
        }
        resultLines.push(line);
        i++;

        const preservedTrivia: string[] = [];
        let skippedSpecies = 0;
        while (i < lines.length && skippedSpecies < originalSpeciesCount) {
          const checkLine = this.cleanLine(lines[i]);
          if (!checkLine) {
            preservedTrivia.push(lines[i]);
            i++;
            continue;
          }
          const parts = checkLine.split(/\s+/);
          if (parts.length >= 3 && this.labelToSymbol(parts[0])
            && Number.isFinite(this.parseNumber(parts[1]))) {
            i++;
            skippedSpecies++;
          } else {
            break;
          }
        }
        resultLines.push(...preservedTrivia);

        // Write species with preserved pseudo filenames
        for (const label of speciesOrder) {
          const atom = structure.atoms.find((candidate) => this.atomLabel(candidate) === label);
          const element = atom?.element ?? this.labelToSymbol(label) ?? label;
          const originalLine = originalSpeciesLines.get(label.toLowerCase());
          if (originalLine) {
            const parts = originalLine.trim().split(/\s+/);
            const mass = parts[1] ?? String(ELEMENT_DATA[element]?.atomicMass ?? 1);
            const pseudoFile = parts.length >= 3 ? parts.slice(2).join(' ') : `${element}.UPF`;
            resultLines.push(`${label}  ${mass}  ${pseudoFile}`);
          } else {
            const mass = ELEMENT_DATA[element]?.atomicMass ?? 1;
            resultLines.push(`${label}  ${mass.toFixed(6)}  ${element}.UPF`);
          }
        }
        continue;
      }

      // Replace ATOMIC_POSITIONS block
      if (upper.startsWith('ATOMIC_POSITIONS')) {
        resultLines.push(`ATOMIC_POSITIONS ${positionUnit}`);
        i++;

        const preservedTrivia: string[] = [];
        let skippedAtoms = 0;
        const atomsToSkip = originalNat ?? structure.atoms.length;
        while (i < lines.length && skippedAtoms < atomsToSkip) {
          const checkLine = this.cleanLine(lines[i]);
          if (!checkLine) {
            preservedTrivia.push(lines[i]);
            i++;
            continue;
          }
          const parts = checkLine.split(/\s+/);
          if (parts.length >= 4 && this.labelToSymbol(parts[0])
            && parts.slice(1, 4).every((value) => Number.isFinite(this.parseNumber(value)))) {
            i++;
            skippedAtoms++;
          } else {
            break;
          }
        }
        resultLines.push(...preservedTrivia);

        // Write new atom positions
        for (const atom of structure.atoms) {
          const position = this.positionForSerialization(atom, structure, positionUnit);
          const base = `${this.atomLabel(atom).padEnd(4)}  ${formatCoordinateTriplet(position)}`;
          if (hasFixedFlags) {
            resultLines.push(`${base}  ${this.formatPositionFlags(atom)}`);
          } else {
            resultLines.push(base);
          }
        }
        continue;
      }

      // Update nat in SYSTEM block
      if (/^\s*nat\s*=/i.test(trimmed)) {
        const indent = trimmed.match(/^(\s*)/)?.[1] ?? '';
        resultLines.push(`${indent}nat = ${structure.atoms.length}`);
        i++;
        continue;
      }

      // Update ntyp in SYSTEM block
      if (/^\s*ntyp\s*=/i.test(trimmed)) {
        const indent = trimmed.match(/^(\s*)/)?.[1] ?? '';
        resultLines.push(`${indent}ntyp = ${speciesOrder.length}`);
        i++;
        continue;
      }

      // Copy other lines unchanged
      resultLines.push(line);
      i++;
    }

    return resultLines.join('\n');
  }

  private cleanLine(line: string): string {
    if (!line) {return '';}
    const withoutComment = line.split(/[!#]/)[0];
    return withoutComment.trim();
  }

  private atomLabel(atom: Atom): string {
    const sourceLabel = atom.sourceLabel?.trim();
    if (sourceLabel && this.labelToSymbol(sourceLabel) === atom.element) {
      return sourceLabel;
    }
    return atom.element;
  }

  private positionForSerialization(
    atom: Atom,
    structure: Structure,
    positionUnit: QEPositionUnit
  ): [number, number, number] {
    if (positionUnit === 'angstrom') {
      return atom.getPosition();
    }
    if (!structure.unitCell) {
      throw new Error('Cannot write QE crystal coordinates: structure has no unit cell');
    }
    return structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
  }

  private normalizeSystemLines(
    lines: string[],
    nat: number,
    ntyp: number,
    forceExplicitCell: boolean
  ): string[] {
    const normalized: string[] = [];
    let inSystem = false;
    let sawNat = false;
    let sawNtyp = false;
    let sawIbrav = false;

    for (const line of lines) {
      if (/^\s*&SYSTEM\b/i.test(line)) {
        inSystem = true;
        normalized.push(line);
        continue;
      }
      if (inSystem && /^\s*\/\s*(?:!.*)?$/.test(line)) {
        if (!sawIbrav && forceExplicitCell) {
          normalized.push('  ibrav = 0,');
        }
        if (!sawNat) {
          normalized.push(`  nat = ${nat},`);
        }
        if (!sawNtyp) {
          normalized.push(`  ntyp = ${ntyp},`);
        }
        normalized.push(line);
        inSystem = false;
        continue;
      }
      if (!inSystem) {
        normalized.push(line);
        continue;
      }

      const commentIndex = line.indexOf('!');
      const comment = commentIndex >= 0 ? line.slice(commentIndex) : '';
      let updated = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
      if (/\bnat\s*=/i.test(updated)) {
        updated = updated.replace(/\bnat\s*=\s*[+-]?\d+/i, `nat = ${nat}`);
        sawNat = true;
      }
      if (/\bntyp\s*=/i.test(updated)) {
        updated = updated.replace(/\bntyp\s*=\s*[+-]?\d+/i, `ntyp = ${ntyp}`);
        sawNtyp = true;
      }
      if (/\bibrav\s*=/i.test(updated)) {
        if (forceExplicitCell) {
          updated = updated.replace(/\bibrav\s*=\s*[+-]?\d+/i, 'ibrav = 0');
        }
        sawIbrav = true;
      }
      normalized.push(updated + comment);
    }
    return normalized;
  }

  private looksLikeQeInput(lines: string[]): boolean {
    const hasNamelist = lines.some((line) =>
      /^\s*&(?:CONTROL|SYSTEM|ELECTRONS|IONS|CELL)\b/i.test(line)
    );
    if (hasNamelist) {
      return true;
    }
    const hasSpecies = lines.some((line) => /^\s*ATOMIC_SPECIES\b/i.test(line));
    const hasPositions = lines.some((line) => /^\s*ATOMIC_POSITIONS\b/i.test(line));
    return hasSpecies && hasPositions;
  }

  private looksLikeQeOutput(lines: string[]): boolean {
    return lines.some((line) =>
      /Program PWSCF/i.test(line) ||
      /number of atoms\/cell/i.test(line) ||
      /crystal axes:/i.test(line) ||
      /End final coordinates/i.test(line)
    );
  }

  private parseInput(lines: string[]): Structure {
    const nat = this.extractNat(lines);
    const alat = this.extractAlat(lines);
    const name = this.extractPrefix(lines) || '';
    const ibrav = this.extractIbrav(lines);
    const species = this.parseSpecies(lines);
    const speciesByLabel = new Map(species.map((entry) => [entry.label.toLowerCase(), entry]));

    const structure = new Structure(name);

    // Save QE format-specific blocks for preservation
    const controlBlock = this.extractNamelistBlock(lines, 'CONTROL');
    const systemBlock = this.extractNamelistBlock(lines, 'SYSTEM');
    const electronsBlock = this.extractNamelistBlock(lines, 'ELECTRONS');
    const ionsBlock = this.extractNamelistBlock(lines, 'IONS');
    const cellBlock = this.extractNamelistBlock(lines, 'CELL');
    
    if (controlBlock) {structure.metadata.set('qeControlBlock', controlBlock);}
    if (systemBlock) {structure.metadata.set('qeSystemBlock', systemBlock);}
    if (electronsBlock) {structure.metadata.set('qeElectronsBlock', electronsBlock);}
    if (ionsBlock) {structure.metadata.set('qeIonsBlock', ionsBlock);}
    if (cellBlock) {structure.metadata.set('qeCellBlock', cellBlock);}
    
    // Save ATOMIC_SPECIES block
    const speciesBlock = this.extractSpeciesBlock(lines);
    if (speciesBlock) {structure.metadata.set('qeSpeciesBlock', speciesBlock);}
    
    // Save CELL_PARAMETERS block with header
    const cellParamsBlock = this.extractCellParametersBlock(lines);
    if (cellParamsBlock) {structure.metadata.set('qeCellParametersBlock', cellParamsBlock);}
    
    // Save ATOMIC_POSITIONS header line
    const positionsHeader = this.extractPositionsHeader(lines);
    if (positionsHeader) {structure.metadata.set('qePositionsHeader', positionsHeader);}

    // Cards in a valid pw.x input are not ordered for single-pass structure
    // extraction: CELL_PARAMETERS commonly follows ATOMIC_POSITIONS. Resolve
    // the lattice first, then parse positions in a second pass.
    let cellVectors: number[][] | null = null;
    let atoms: ParsedAtom[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }
      if (/^CELL_PARAMETERS\b/i.test(trimmed)) {
        const block = this.parseCellBlock(lines, i, alat);
        if (!block) {
          throw new Error(`QEParser line ${i + 1}: CELL_PARAMETERS requires three valid vectors`);
        }
        cellVectors = block.vectors;
        i = block.nextIndex - 1;
        continue;
      }
    }

    if (!cellVectors && ibrav !== null && ibrav !== 0) {
      cellVectors = this.buildIbravVectors(lines, ibrav);
    }
    const effectiveAlat = alat ?? (cellVectors ? this.vectorLength(cellVectors[0]) : null);

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^ATOMIC_POSITIONS\b/i.test(trimmed)) {
        const block = this.parsePositionsBlock(lines, i, cellVectors, effectiveAlat, nat, speciesByLabel);
        if (block.atoms.length > 0) {
          atoms = block.atoms;
        }
        i = block.nextIndex - 1;
      }
    }

    if (atoms.length === 0) {
      throw new Error('Invalid QE input: missing ATOMIC_POSITIONS');
    }

    if (cellVectors) {
      const unitCell = this.unitCellFromVectors(cellVectors);
      const canonicalVectors = unitCell.getLatticeVectors();
      for (const atom of atoms) {
        const fractional = this.cartesianToFractional(atom.position, cellVectors);
        atom.position = fractionalToCartesian(
          fractional[0], fractional[1], fractional[2], canonicalVectors
        );
      }
      structure.unitCell = unitCell;
      structure.isCrystal = true;
    }

    for (const item of atoms) {
      const atom = new Atom(item.element, item.position[0], item.position[1], item.position[2], undefined, {
        color: BRIGHT_SCHEME.colors[item.element] || '#C0C0C0',
        radius: getDefaultAtomRadius(item.element),
        sourceLabel: item.sourceLabel,
      });
      atom.fixed = item.fixed;
      atom.selectiveDynamics = item.selectiveDynamics;
      structure.addAtom(atom);
    }

    return structure;
  }

  private parseOutputTrajectory(lines: string[]): Structure[] {
    const nat = this.extractNat(lines);
    let alat = this.extractAlat(lines);

    let currentCellVectors: number[][] | null = null;
    let lastCellVectors: number[][] | null = null;
    const frames: Structure[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        continue;
      }

      const alatLine = this.parseAlatFromLine(trimmed);
      if (this.isPositiveNumber(alatLine)) {
        alat = alatLine;
      }

      if (/crystal axes:/i.test(trimmed)) {
        const crystalAxes = this.parseCrystalAxesBlock(lines, i, alat);
        if (crystalAxes) {
          currentCellVectors = crystalAxes;
          if (!lastCellVectors) {
            lastCellVectors = crystalAxes;
          }
        }
        continue;
      }

      if (/^CELL_PARAMETERS\b/i.test(trimmed)) {
        const block = this.parseCellBlock(lines, i, alat);
        if (block) {
          currentCellVectors = block.vectors;
          lastCellVectors = block.vectors;
          if (this.isPositiveNumber(block.alatFromHeader)) {
            alat = block.alatFromHeader;
          }
          i = block.nextIndex - 1;
        }
        continue;
      }

      if (/^ATOMIC_POSITIONS\b/i.test(trimmed)) {
        const block = this.parsePositionsBlock(lines, i, currentCellVectors, alat, nat);
        if (block.atoms.length > 0) {
          const frameCell: number[][] | null = currentCellVectors || lastCellVectors;
          frames.push(this.buildStructureFromParsedAtoms(block.atoms, frameCell));
          if (frameCell) {
            lastCellVectors = frameCell;
          }
        }
        i = block.nextIndex - 1;
        continue;
      }

      if (/positions \(alat units\)/i.test(trimmed)) {
        const parsed = this.parseTauPositionsBlock(lines, i, alat, nat);
        if (parsed.length > 0) {
          const frameCell: number[][] | null = currentCellVectors || lastCellVectors;
          frames.push(this.buildStructureFromParsedAtoms(parsed, frameCell));
        }
      }
    }

    if (frames.length === 0) {
      throw new Error('Invalid QE output log: no atom positions found');
    }
    return frames;
  }

  private buildStructureFromParsedAtoms(atoms: ParsedAtom[], cellVectors: number[][] | null): Structure {
    const structure = new Structure('');
    if (cellVectors) {
      structure.unitCell = this.unitCellFromVectors(cellVectors);
      structure.isCrystal = true;
    }
    for (const item of atoms) {
      const atom = new Atom(item.element, item.position[0], item.position[1], item.position[2], undefined, {
        color: BRIGHT_SCHEME.colors[item.element] || '#C0C0C0',
        radius: getDefaultAtomRadius(item.element),
        sourceLabel: item.sourceLabel,
      });
      atom.fixed = item.fixed;
      atom.selectiveDynamics = item.selectiveDynamics;
      structure.addAtom(atom);
    }
    return structure;
  }

  private parseCellBlock(lines: string[], startIndex: number, fallbackAlat: number | null): ParsedCellBlock | null {
    const header = lines[startIndex] || '';
    const unit = this.detectCellUnit(header);
    const alatFromHeader = this.parseAlatFromCellHeader(header);
    const alat = this.isPositiveNumber(alatFromHeader) ? alatFromHeader : fallbackAlat;
    const factor = this.cellUnitToFactor(unit, alat);

    const vectors: number[][] = [];
    let i = startIndex + 1;
    while (i < lines.length && vectors.length < 3) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        i++;
        continue;
      }
      const values = trimmed.split(/\s+/).slice(0, 3).map((value) => this.parseNumber(value));
      if (values.length < 3 || values.some((value) => !Number.isFinite(value))) {
        break;
      }
      vectors.push([values[0] * factor, values[1] * factor, values[2] * factor]);
      i++;
    }

    if (vectors.length !== 3) {
      return null;
    }

    return {
      vectors,
      nextIndex: i,
      alatFromHeader: this.isPositiveNumber(alatFromHeader) ? alatFromHeader : null,
    };
  }

  private parsePositionsBlock(
    lines: string[],
    startIndex: number,
    cellVectors: number[][] | null,
    alat: number | null,
    nAtoms: number | null,
    speciesByLabel: ReadonlyMap<string, QESpecies> = new Map()
  ): ParsedPositionsBlock {
    const unit = this.detectPositionUnit(lines[startIndex] || '');
    if (unit === 'crystal' && !cellVectors) {
      throw new Error(
        `QEParser line ${startIndex + 1}: ATOMIC_POSITIONS crystal requires a valid lattice`
      );
    }
    if (unit === 'alat' && !this.isPositiveNumber(alat)) {
      throw new Error(
        `QEParser line ${startIndex + 1}: ATOMIC_POSITIONS alat requires celldm(1), A, or a valid cell`
      );
    }
    const atoms: ParsedAtom[] = [];
    let i = startIndex + 1;

    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        if (atoms.length > 0) {
          i++;
          break;
        }
        i++;
        continue;
      }

      const parsed = this.parseAtomicPositionLine(trimmed, speciesByLabel);
      if (!parsed) {
        if (atoms.length > 0) {
          break;
        }
        i++;
        continue;
      }

      const position = this.toCartesian(parsed.position, unit, cellVectors, alat);
      if (!position) {
        i++;
        continue;
      }

      atoms.push({
        element: parsed.element,
        sourceLabel: parsed.sourceLabel,
        position,
        fixed: parsed.fixed,
        selectiveDynamics: parsed.selectiveDynamics,
      });

      i++;
      if (nAtoms && atoms.length >= nAtoms) {
        break;
      }
    }

    return { atoms, nextIndex: i };
  }

  private parseAtomicPositionLine(
    line: string,
    speciesByLabel: ReadonlyMap<string, QESpecies>
  ): ParsedAtom | null {
    if (!line || line.startsWith('#') || line.startsWith('!')) {
      return null;
    }
    const parts = line.split(/\s+/);
    if (parts.length < 4) {
      return null;
    }

    const sourceLabel = parts[0];
    const element = speciesByLabel.get(sourceLabel.toLowerCase())?.element ?? this.labelToSymbol(sourceLabel);
    if (!element) {
      return null;
    }
    const x = this.parseNumber(parts[1]);
    const y = this.parseNumber(parts[2]);
    const z = this.parseNumber(parts[3]);
    if (![x, y, z].every((value) => Number.isFinite(value))) {
      return null;
    }

    let fixed = false;
    let selectiveDynamics: [boolean, boolean, boolean] | undefined;
    if (parts.length >= 7) {
      const flags = parts.slice(4, 7).map((value) => parseInt(value, 10));
      if (flags.every((value) => value === 0 || value === 1)) {
        selectiveDynamics = [
          flags[0] === 1,
          flags[1] === 1,
          flags[2] === 1,
        ];
        fixed = flags[0] === 0 && flags[1] === 0 && flags[2] === 0;
      }
    }

    return {
      element,
      sourceLabel,
      position: [x, y, z],
      fixed,
      selectiveDynamics,
    };
  }

  private parseTauPositionsBlock(
    lines: string[],
    startIndex: number,
    alat: number | null,
    nAtoms: number | null
  ): ParsedAtom[] {
    if (!this.isPositiveNumber(alat)) {
      return [];
    }
    const atoms: ParsedAtom[] = [];
    const pattern =
      /^\s*\d+\s+(\S+)\s+tau\(\s*\d+\)\s*=\s*\(\s*(\S+)\s+(\S+)\s+(\S+)\s*\)/i;

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern);
      if (!match) {
        if (atoms.length > 0) {
          break;
        }
        continue;
      }

      const element = this.labelToSymbol(match[1]);
      if (!element) {
        continue;
      }
      const x = this.parseNumber(match[2]);
      const y = this.parseNumber(match[3]);
      const z = this.parseNumber(match[4]);
      if (![x, y, z].every((value) => Number.isFinite(value))) {
        continue;
      }
      atoms.push({
        element,
        sourceLabel: match[1],
        position: [x * alat, y * alat, z * alat],
        fixed: false,
      });
      if (nAtoms && atoms.length >= nAtoms) {
        break;
      }
    }
    return atoms;
  }

  private parseCrystalAxesBlock(lines: string[], startIndex: number, alat: number | null): number[][] | null {
    if (!this.isPositiveNumber(alat)) {
      return null;
    }
    if (startIndex + 3 >= lines.length) {
      return null;
    }
    const vectors: number[][] = [];
    for (let i = 1; i <= 3; i++) {
      const values = (lines[startIndex + i] || '')
        .match(/[+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?/g)
        ?.map((value) => this.parseNumber(value))
        .filter((value) => Number.isFinite(value)) || [];
      if (values.length < 3) {
        return null;
      }
      const tail = values.slice(values.length - 3);
      vectors.push([tail[0] * alat, tail[1] * alat, tail[2] * alat]);
    }
    return vectors;
  }

  private toCartesian(
    value: [number, number, number],
    unit: QEUnit,
    cellVectors: number[][] | null,
    alat: number | null
  ): [number, number, number] | null {
    if (unit === 'angstrom') {
      return value;
    }
    if (unit === 'bohr') {
      return [
        value[0] * BOHR_TO_ANGSTROM,
        value[1] * BOHR_TO_ANGSTROM,
        value[2] * BOHR_TO_ANGSTROM,
      ];
    }
    if (unit === 'alat') {
      if (!this.isPositiveNumber(alat)) {
        return null;
      }
      return [value[0] * alat, value[1] * alat, value[2] * alat];
    }
    if (!cellVectors) {
      return null;
    }
    return fractionalToCartesian(value[0], value[1], value[2], cellVectors);
  }

  private detectPositionUnit(header: string): QEUnit {
    const lower = header.toLowerCase();
    if (lower.includes('crystal')) {
      return 'crystal';
    }
    if (lower.includes('bohr')) {
      return 'bohr';
    }
    if (lower.includes('angstrom')) {
      return 'angstrom';
    }
    if (lower.includes('alat')) {
      return 'alat';
    }
    return 'alat';
  }

  private detectCellUnit(header: string): QEUnit {
    const lower = header.toLowerCase();
    if (lower.includes('bohr')) {
      return 'bohr';
    }
    if (lower.includes('angstrom')) {
      return 'angstrom';
    }
    if (lower.includes('alat')) {
      return 'alat';
    }
    return 'alat';
  }

  private cellUnitToFactor(unit: QEUnit, alat: number | null): number {
    if (unit === 'angstrom') {
      return 1;
    }
    if (unit === 'bohr') {
      return BOHR_TO_ANGSTROM;
    }
    if (this.isPositiveNumber(alat)) {
      return alat;
    }
    return BOHR_TO_ANGSTROM;
  }

  private parseSpecies(lines: string[]): QESpecies[] {
    const species: QESpecies[] = [];
    const expectedCount = this.extractIntegerParameter(lines, 'ntyp');
    const startIndex = lines.findIndex((line) => /^\s*ATOMIC_SPECIES\b/i.test(line));
    if (startIndex < 0) {
      return species;
    }

    for (let i = startIndex + 1; i < lines.length; i++) {
      const cleaned = this.cleanLine(lines[i]);
      if (!cleaned) {
        continue;
      }
      const parts = cleaned.split(/\s+/);
      const element = this.labelToSymbol(parts[0] ?? '');
      if (parts.length < 3 || !element || !Number.isFinite(this.parseNumber(parts[1]))) {
        break;
      }
      species.push({
        label: parts[0],
        element,
        mass: parts[1],
        pseudo: parts.slice(2).join(' '),
      });
      if (expectedCount !== null && species.length >= expectedCount) {
        break;
      }
    }
    return species;
  }

  private buildIbravVectors(lines: string[], ibrav: number): number[][] {
    const params = this.readLatticeParameters(lines);
    const { a, b, c, cosAlpha, cosBeta, cosGamma } = params;
    const sinBeta = Math.sqrt(Math.max(0, 1 - cosBeta * cosBeta));
    const sinGamma = Math.sqrt(Math.max(0, 1 - cosGamma * cosGamma));

    switch (ibrav) {
      case 1:
        return [[a, 0, 0], [0, a, 0], [0, 0, a]];
      case 2:
        return [[-a / 2, 0, a / 2], [0, a / 2, a / 2], [-a / 2, a / 2, 0]];
      case 3:
        return [[a / 2, a / 2, a / 2], [-a / 2, a / 2, a / 2], [-a / 2, -a / 2, a / 2]];
      case -3:
        return [[-a / 2, a / 2, a / 2], [a / 2, -a / 2, a / 2], [a / 2, a / 2, -a / 2]];
      case 4:
        return [[a, 0, 0], [-a / 2, Math.sqrt(3) * a / 2, 0], [0, 0, c]];
      case 5: {
        const tx = Math.sqrt((1 - cosGamma) / 2);
        const ty = Math.sqrt((1 - cosGamma) / 6);
        const tz = Math.sqrt((1 + 2 * cosGamma) / 3);
        return [[a * tx, -a * ty, a * tz], [0, 2 * a * ty, a * tz], [-a * tx, -a * ty, a * tz]];
      }
      case -5: {
        const ty = Math.sqrt((1 - cosGamma) / 6);
        const tz = Math.sqrt((1 + 2 * cosGamma) / 3);
        const u = tz - 2 * Math.sqrt(2) * ty;
        const v = tz + Math.sqrt(2) * ty;
        const scale = a / Math.sqrt(3);
        return [[scale * u, scale * v, scale * v], [scale * v, scale * u, scale * v], [scale * v, scale * v, scale * u]];
      }
      case 6:
        return [[a, 0, 0], [0, a, 0], [0, 0, c]];
      case 7:
        return [[a / 2, -a / 2, c / 2], [a / 2, a / 2, c / 2], [-a / 2, -a / 2, c / 2]];
      case 8:
        return [[a, 0, 0], [0, b, 0], [0, 0, c]];
      case 9:
        return [[a / 2, b / 2, 0], [-a / 2, b / 2, 0], [0, 0, c]];
      case -9:
        return [[a / 2, -b / 2, 0], [a / 2, b / 2, 0], [0, 0, c]];
      case 91:
        return [[a, 0, 0], [0, b / 2, -c / 2], [0, b / 2, c / 2]];
      case 10:
        return [[a / 2, 0, c / 2], [a / 2, b / 2, 0], [0, b / 2, c / 2]];
      case 11:
        return [[a / 2, b / 2, c / 2], [-a / 2, b / 2, c / 2], [-a / 2, -b / 2, c / 2]];
      case 12:
        return [[a, 0, 0], [b * cosGamma, b * sinGamma, 0], [0, 0, c]];
      case -12:
        return [[a, 0, 0], [0, b, 0], [c * cosBeta, 0, c * sinBeta]];
      case 13:
        return [[a / 2, 0, -c / 2], [b * cosGamma, b * sinGamma, 0], [a / 2, 0, c / 2]];
      case -13:
        return [[a / 2, b / 2, 0], [-a / 2, b / 2, 0], [c * cosBeta, 0, c * sinBeta]];
      case 14: {
        if (sinGamma < 1e-12) {
          throw new Error('QEParser: invalid triclinic lattice, sin(gamma) is zero');
        }
        const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
        const volumeTerm = 1 + 2 * cosAlpha * cosBeta * cosGamma
          - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma;
        if (volumeTerm <= 0) {
          throw new Error('QEParser: invalid triclinic lattice angles');
        }
        return [
          [a, 0, 0],
          [b * cosGamma, b * sinGamma, 0],
          [c * cosBeta, cy, c * Math.sqrt(volumeTerm) / sinGamma],
        ];
      }
      default:
        throw new Error(`QEParser: unsupported ibrav = ${ibrav}`);
    }
  }

  private readLatticeParameters(lines: string[]): QELatticeParameters {
    const celldm1 = this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*1\\s*\\)');
    const latticeA = this.extractNumericParameter(lines, 'A');
    const a = celldm1 !== null ? celldm1 * BOHR_TO_ANGSTROM : latticeA;
    if (!this.isPositiveNumber(a)) {
      throw new Error('QEParser: non-zero ibrav requires celldm(1) or A');
    }

    const ratioB = this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*2\\s*\\)');
    const ratioC = this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*3\\s*\\)');
    const latticeB = this.extractNumericParameter(lines, 'B');
    const latticeC = this.extractNumericParameter(lines, 'C');
    return {
      a,
      b: latticeB ?? (ratioB !== null ? a * ratioB : a),
      c: latticeC ?? (ratioC !== null ? a * ratioC : a),
      cosAlpha: this.extractNumericParameter(lines, 'cosBC')
        ?? this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*4\\s*\\)') ?? 0,
      cosBeta: this.extractNumericParameter(lines, 'cosAC')
        ?? this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*5\\s*\\)') ?? 0,
      cosGamma: this.extractNumericParameter(lines, 'cosAB')
        ?? this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*6\\s*\\)')
        ?? this.extractNumericParameter(lines, 'celldm\\s*\\(\\s*4\\s*\\)') ?? 0,
    };
  }

  private extractNumericParameter(lines: string[], parameterPattern: string): number | null {
    const system = this.extractNamelistText(lines, 'SYSTEM');
    const pattern = new RegExp(`(?:^|[,\\s])${parameterPattern}\\s*=\\s*([^,\\s!]+)`, 'im');
    const match = system.match(pattern);
    if (!match || !match[1]) {
      return null;
    }
    const value = this.parseNumber(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  private extractIntegerParameter(lines: string[], parameter: string): number | null {
    const value = this.extractNumericParameter(lines, parameter);
    return value !== null && Number.isInteger(value) ? value : null;
  }

  private extractNamelistText(lines: string[], name: string): string {
    const startIndex = lines.findIndex((line) => new RegExp(`^\\s*&${name}\\b`, 'i').test(line));
    if (startIndex < 0) {
      return '';
    }
    const block: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (/^\s*\/\s*(?:!.*)?$/.test(lines[i])) {
        break;
      }
      block.push(lines[i].split('!')[0]);
    }
    return block.join('\n');
  }

  private extractNat(lines: string[]): number | null {
    const fromNamelist = this.extractIntegerParameter(lines, 'nat');
    if (fromNamelist !== null) {
      return fromNamelist;
    }
    for (const line of lines) {
      const match = line.match(/number of atoms\/cell\s*=\s*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return null;
  }

  private extractPrefix(lines: string[]): string | null {
    for (const line of lines) {
      const stripped = line.split('!')[0];
      const match = stripped.match(/\bprefix\s*=\s*['"]?([^'",\s]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  private extractAlat(lines: string[]): number | null {
    for (const line of lines) {
      const fromCellHeader = this.parseAlatFromCellHeader(line);
      if (this.isPositiveNumber(fromCellHeader)) {
        return fromCellHeader;
      }
      const fromLine = this.parseAlatFromLine(line);
      if (this.isPositiveNumber(fromLine)) {
        return fromLine;
      }
      const stripped = line.split('!')[0];
      const aMatch = stripped.match(/(^|,)\s*A\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/);
      if (aMatch && aMatch[2]) {
        const parsed = this.parseNumber(aMatch[2]);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return null;
  }

  private extractIbrav(lines: string[]): number | null {
    return this.extractIntegerParameter(lines, 'ibrav') ?? 0;
  }

  private parseAlatFromLine(line: string): number | null {
    const match = line.match(/celldm\s*\(\s*1\s*\)\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/i);
    if (!match || !match[1]) {
      return null;
    }
    const value = this.parseNumber(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value * BOHR_TO_ANGSTROM;
  }

  private parseAlatFromCellHeader(line: string): number | null {
    const match = line.match(/alat\s*=\s*([+-]?\d*\.?\d+(?:[eEdD][+-]?\d+)?)/i);
    if (!match || !match[1]) {
      return null;
    }
    const value = this.parseNumber(match[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    return value * BOHR_TO_ANGSTROM;
  }

  private hasPositionConstraints(structure: Structure): boolean {
    return structure.atoms.some((atom) =>
      atom.fixed || atom.selectiveDynamics?.some((canMove) => !canMove)
    );
  }

  private formatPositionFlags(atom: Atom): string {
    const selectiveDynamics = atom.selectiveDynamics ?? (atom.fixed
      ? [false, false, false] as [boolean, boolean, boolean]
      : [true, true, true] as [boolean, boolean, boolean]);
    return selectiveDynamics.map((canMove) => canMove ? '1' : '0').join(' ');
  }

  private parseNumber(value: string): number {
    const trimmed = value.trim();
    if (!trimmed) {
      return NaN;
    }
    const normalized = trimmed.replace(/[dD]/g, 'e');
    const tokens = normalized.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+\-*/^]/g);
    if (!tokens || tokens.join('') !== normalized.replace(/\s+/g, '')) {
      return NaN;
    }

    let index = 0;
    const parsePrimary = (): number => {
      const token = tokens[index];
      if (token === '+' || token === '-') {
        index++;
        const operand = parsePrimary();
        return token === '-' ? -operand : operand;
      }
      if (token === '(') {
        index++;
        const result = parseAdditive();
        if (tokens[index] !== ')') {
          return NaN;
        }
        index++;
        return result;
      }
      if (!token) {
        return NaN;
      }
      index++;
      return Number(token);
    };
    const parsePower = (): number => {
      const base = parsePrimary();
      if (tokens[index] === '^') {
        index++;
        return base ** parsePower();
      }
      return base;
    };
    const parseMultiplicative = (): number => {
      let result = parsePower();
      while (tokens[index] === '*' || tokens[index] === '/') {
        const operator = tokens[index++];
        const right = parsePower();
        result = operator === '*' ? result * right : result / right;
      }
      return result;
    };
    const parseAdditive = (): number => {
      let result = parseMultiplicative();
      while (tokens[index] === '+' || tokens[index] === '-') {
        const operator = tokens[index++];
        const right = parseMultiplicative();
        result = operator === '+' ? result + right : result - right;
      }
      return result;
    };

    const result = parseAdditive();
    return index === tokens.length && Number.isFinite(result) ? result : NaN;
  }

  private isPositiveNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private labelToSymbol(label: string): string | undefined {
    const match = label.match(/[A-Za-z]+/);
    if (!match) {
      return undefined;
    }
    const letters = match[0];
    const firstTwo = letters.slice(0, 2);
    return parseElement(firstTwo) || parseElement(letters[0]);
  }

  private unitCellFromVectors(vectors: number[][]): UnitCell {
    return UnitCell.fromVectors(vectors);
  }

  private vectorLength(vector: readonly number[]): number {
    return Math.sqrt(vector.reduce((sum, component) => sum + component * component, 0));
  }

  private cartesianToFractional(
    position: readonly [number, number, number],
    vectors: number[][]
  ): [number, number, number] {
    const [a, b, c] = vectors;
    const m00 = a[0], m01 = b[0], m02 = c[0];
    const m10 = a[1], m11 = b[1], m12 = c[1];
    const m20 = a[2], m21 = b[2], m22 = c[2];
    const determinant =
      m00 * (m11 * m22 - m12 * m21)
      - m01 * (m10 * m22 - m12 * m20)
      + m02 * (m10 * m21 - m11 * m20);
    if (Math.abs(determinant) < 1e-12) {
      throw new Error('QEParser: lattice vectors are singular');
    }
    const [x, y, z] = position;
    return [
      ((m11 * m22 - m12 * m21) * x
        + (m02 * m21 - m01 * m22) * y
        + (m01 * m12 - m02 * m11) * z) / determinant,
      ((m12 * m20 - m10 * m22) * x
        + (m00 * m22 - m02 * m20) * y
        + (m02 * m10 - m00 * m12) * z) / determinant,
      ((m10 * m21 - m11 * m20) * x
        + (m01 * m20 - m00 * m21) * y
        + (m00 * m11 - m01 * m10) * z) / determinant,
    ];
  }

  private extractNamelistBlock(lines: string[], blockName: string): string[] | null {
    const pattern = new RegExp(`^\\s*&${blockName}\\b`, 'i');
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        startIndex = i;
        break;
      }
    }
    if (startIndex < 0) {return null;}

    const blockLines: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === '/') {
        break;
      }
      if (trimmed && !trimmed.startsWith('!')) {
        blockLines.push(line);
      }
    }
    return blockLines.length > 0 ? blockLines : null;
  }

  private extractSpeciesLines(lines: string[]): Map<string, string> {
    const speciesMap = new Map<string, string>();
    const expectedCount = this.extractIntegerParameter(lines, 'ntyp');
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^ATOMIC_SPECIES\b/i.test(lines[i].trim())) {
        startIndex = i;
        break;
      }
    }
    if (startIndex < 0) {return speciesMap;}

    for (let i = startIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!this.cleanLine(trimmed)) {continue;}
      const parts = this.cleanLine(trimmed).split(/\s+/);
      if (parts.length >= 3 && this.labelToSymbol(parts[0]) && Number.isFinite(this.parseNumber(parts[1]))) {
        speciesMap.set(parts[0].toLowerCase(), lines[i]);
        if (expectedCount !== null && speciesMap.size >= expectedCount) {
          break;
        }
      } else {
        break;
      }
    }
    return speciesMap;
  }

  private extractSpeciesBlock(lines: string[]): string[] | null {
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^ATOMIC_SPECIES\b/i.test(lines[i].trim())) {
        startIndex = i;
        break;
      }
    }
    if (startIndex < 0) {return null;}

    const blockLines: string[] = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {break;}
      const parts = this.cleanLine(trimmed).split(/\s+/);
      if (parts.length >= 3 && this.labelToSymbol(parts[0]) && Number.isFinite(this.parseNumber(parts[1]))) {
        blockLines.push(lines[i]);
      } else {
        break;
      }
    }
    return blockLines.length > 0 ? blockLines : null;
  }

  private extractCellParametersBlock(lines: string[]): string[] | null {
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^CELL_PARAMETERS\b/i.test(lines[i].trim())) {
        startIndex = i;
        break;
      }
    }
    if (startIndex < 0) {return null;}

    const blockLines: string[] = [lines[startIndex]];
    for (let i = startIndex + 1; i < lines.length && blockLines.length < 4; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {continue;}
      if (/^[+-]?\d/.test(trimmed)) {
        blockLines.push(lines[i]);
      } else {
        break;
      }
    }
    return blockLines.length > 1 ? blockLines : null;
  }

  private extractPositionsHeader(lines: string[]): string | null {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (/^ATOMIC_POSITIONS\b/i.test(trimmed)) {
        return trimmed;
      }
    }
    return null;
  }
}
