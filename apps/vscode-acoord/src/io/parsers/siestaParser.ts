import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomRadius, ELEMENT_DATA } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { BOHR_TO_ANGSTROM } from '../../utils/constants.js';
import { fractionalToCartesian } from '../../utils/parserUtils.js';
import { StructureParser } from './structureParser.js';

interface FDFHeader {
  systemName: string;
  latticeConstant: number;
  coordinateFormat: string;
  speciesLabels: Map<number, string>;
}

/**
 * SIESTA fdf file format parser
 * Supports:
 * - LatticeVectors (3x3 matrix)
 * - LatticeParameters (a, b, c, alpha, beta, gamma)
 * - AtomicCoordinatesFormat: Fractional, Ang, Bohr, ScaledCartesian
 * - ChemicalSpeciesLabel block
 * - AtomicCoordinatesAndAtomicSpecies block
 */
export class SIESTAParser extends StructureParser {
  parse(content: string): Structure {
    if (!content.trim()) {
      throw new Error('SIESTAParser: empty input');
    }

    const lines = content.split(/\r?\n/);
    const header = this.parseHeader(lines);
    const latticeVectors = this.parseLattice(lines, header.latticeConstant);
    const speciesMap = this.parseSpeciesLabels(lines);

    const atomData = this.parseAtomicCoordinates(lines, header.coordinateFormat);
    if (atomData.length === 0) {
      throw new Error('SIESTAParser: no atoms found');
    }

    const structure = new Structure(header.systemName, true);
    structure.unitCell = UnitCell.fromVectors(latticeVectors);
    structure.isCrystal = true;

    for (const atomDataItem of atomData) {
      const element = speciesMap.get(atomDataItem.speciesIdx);
      if (!element) {
        throw new Error(
          `SIESTAParser: undefined species index ${atomDataItem.speciesIdx}`
        );
      }

      let x = atomDataItem.fx;
      let y = atomDataItem.fy;
      let z = atomDataItem.fz;

      const format = header.coordinateFormat.toLowerCase();
      if (format === 'fractional' || format === 'scaledbylatticevectors') {
        [x, y, z] = fractionalToCartesian(x, y, z, latticeVectors);
      } else if (format === 'bohr' || format === 'notscaledcartesianbohr') {
        x *= BOHR_TO_ANGSTROM;
        y *= BOHR_TO_ANGSTROM;
        z *= BOHR_TO_ANGSTROM;
      } else if (format === 'latticeconstant' || format === 'scaledcartesian') {
        x *= header.latticeConstant;
        y *= header.latticeConstant;
        z *= header.latticeConstant;
      }

      const atom = new Atom(element, x, y, z, undefined, {
        color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
        radius: getDefaultAtomRadius(element),
      });
      structure.addAtom(atom);
    }

    structure.metadata.set('fdfRawContent', content);
    return structure;
  }

  serialize(structure: Structure): string {
    if (structure.atoms.length === 0) {
      throw new Error('SIESTAParser: cannot serialize empty structure');
    }

    const rawContent = structure.metadata.get('fdfRawContent') as string | undefined;
    if (rawContent) {
      return this.replaceSections(rawContent, structure);
    }

    return this.generateDefaultFDF(structure);
  }

  private parseHeader(lines: string[]): FDFHeader {
    const header: FDFHeader = {
      systemName: 'SIESTA Structure',
      latticeConstant: 1.0,
      coordinateFormat: 'Fractional',
      speciesLabels: new Map(),
    };

    for (let i = 0; i < lines.length; i++) {
      const line = this.stripComment(lines[i]);
      const tokens = line.trim().split(/\s+/);
      if (tokens.length < 2) {
        continue;
      }

      const key = tokens[0].toLowerCase();
      if (key === 'systemname') {
        header.systemName = tokens.slice(1).join(' ').trim() || 'SIESTA Structure';
      } else if (key === 'systemlabel') {
        if (header.systemName === 'SIESTA Structure') {
          header.systemName = tokens.slice(1).join(' ').trim() || 'SIESTA Structure';
        }
      } else if (key === 'latticeconstant') {
        const value = tokens[1];
        const num = Number.parseFloat(value);
        if (Number.isFinite(num) && num > 0) {
          let unit = 'ang';
          if (tokens.length >= 3) {
            unit = tokens[2].toLowerCase();
          } else if (value.toLowerCase().includes('ang')) {
            unit = 'ang';
          } else if (value.toLowerCase().includes('bohr')) {
            unit = 'bohr';
          }

          if (unit === 'bohr') {
            header.latticeConstant = num * BOHR_TO_ANGSTROM;
          } else {
            header.latticeConstant = num;
          }
        }
      } else if (key === 'atomiccoordinatesformat') {
        header.coordinateFormat = tokens[1] || 'Fractional';
      }
    }

    return header;
  }

  private parseLattice(lines: string[], latticeConstant: number): number[][] {
    const latticeBlock = this.extractBlock(lines, 'LatticeVectors');
    if (latticeBlock) {
      const vectors = this.parseMatrix3x3(latticeBlock);
      return vectors.map((row) => row.map((val) => val * latticeConstant));
    }

    const latticeParams = this.extractParameter(lines, 'LatticeParameters');
    if (latticeParams && latticeParams.length === 6) {
      const vectors = this.latticeParametersToVectors(
        latticeParams[0],
        latticeParams[1],
        latticeParams[2],
        latticeParams[3],
        latticeParams[4],
        latticeParams[5]
      );
      return vectors.map((row) => row.map((val) => val * latticeConstant));
    }

    throw new Error('SIESTAParser: missing %block LatticeVectors or LatticeParameters');
  }

  private parseSpeciesLabels(lines: string[]): Map<number, string> {
    const block = this.extractBlock(lines, 'ChemicalSpeciesLabel');
    if (!block) {
      throw new Error('SIESTAParser: missing %block ChemicalSpeciesLabel');
    }

    const speciesMap = new Map<number, string>();
    for (const line of block) {
      const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
      if (tokens.length < 3) {
        continue;
      }

      const idx = parseInt(tokens[0], 10);
      const element = parseElement(tokens[2]);
      if (Number.isFinite(idx) && element) {
        speciesMap.set(idx, element);
      }
    }

    if (speciesMap.size === 0) {
      throw new Error('SIESTAParser: no species labels found');
    }

    return speciesMap;
  }

  private parseAtomicCoordinates(lines: string[], _format: string): {
    fx: number;
    fy: number;
    fz: number;
    speciesIdx: number;
  }[] {
    const block = this.extractBlock(lines, 'AtomicCoordinatesAndAtomicSpecies');
    if (!block) {
      throw new Error('SIESTAParser: missing %block AtomicCoordinatesAndAtomicSpecies');
    }

    const atoms: { fx: number; fy: number; fz: number; speciesIdx: number }[] = [];
    for (const line of block) {
      const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
      if (tokens.length < 4) {
        continue;
      }

      const fx = Number.parseFloat(tokens[0]);
      const fy = Number.parseFloat(tokens[1]);
      const fz = Number.parseFloat(tokens[2]);
      const speciesIdx = parseInt(tokens[3], 10);

      if (
        Number.isFinite(fx) &&
        Number.isFinite(fy) &&
        Number.isFinite(fz) &&
        Number.isFinite(speciesIdx)
      ) {
        atoms.push({ fx, fy, fz, speciesIdx });
      }
    }

    return atoms;
  }

  private latticeParametersToVectors(
    a: number,
    b: number,
    c: number,
    alpha: number,
    beta: number,
    gamma: number
  ): number[][] {
    const α = (alpha * Math.PI) / 180;
    const β = (beta * Math.PI) / 180;
    const γ = (gamma * Math.PI) / 180;

    const cosAlpha = Math.cos(α);
    const cosBeta = Math.cos(β);
    const cosGamma = Math.cos(γ);
    const sinGamma = Math.sin(γ);

    if (Math.abs(sinGamma) < 1e-10) {
      throw new Error('SIESTAParser: invalid LatticeParameters - gamma must not be 0° or 180°');
    }

    const ax = a;
    const ay = 0;
    const az = 0;

    const bx = b * cosGamma;
    const by = b * sinGamma;
    const bz = 0;

    const cx = c * cosBeta;
    const cy = (c * (cosAlpha - cosBeta * cosGamma)) / sinGamma;

    const volumeFactor =
      1 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma +
      2 * cosAlpha * cosBeta * cosGamma;

    let cz: number;
    if (volumeFactor < 0) {
      if (volumeFactor > -1e-10) {
        cz = 0;
      } else {
        throw new Error('SIESTAParser: invalid LatticeParameters - invalid angles');
      }
    } else {
      cz = (c * Math.sqrt(volumeFactor)) / sinGamma;
    }

    return [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ];
  }

  private extractBlock(lines: string[], blockName: string): string[] | null {
    const openPattern = new RegExp(`%block\\s+${blockName}`, 'i');
    const closePattern = new RegExp(`%endblock\\s+${blockName}`, 'i');

    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (openPattern.test(lines[i])) {
        startIndex = i + 1;
        break;
      }
    }

    if (startIndex === -1) {
      return null;
    }

    const blockLines: string[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      if (closePattern.test(lines[i])) {
        break;
      }
      blockLines.push(lines[i]);
    }

    return blockLines;
  }

  private extractParameter(lines: string[], paramName: string): number[] | null {
    const pattern = new RegExp(`^\\s*${paramName}\\s+`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = this.stripComment(lines[i]);
      const match = line.match(pattern);
      if (match) {
        const valuePart = line.slice(match[0].length);
        const tokens = valuePart.trim().split(/\s+/).filter((t) => t.length > 0);
        const values = tokens
          .map((t) => Number.parseFloat(t))
          .filter((v) => Number.isFinite(v));
        return values;
      }
    }

    return null;
  }

  private stripComment(line: string): string {
    const raw = (line || '').trim();
    const idx = raw.indexOf('#');
    if (idx >= 0) {
      return raw.slice(0, idx).trim();
    }
    return raw;
  }

  private parseMatrix3x3(lines: string[]): number[][] {
    const matrix: number[][] = [];
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
      const values = tokens
        .map((t) => Number.parseFloat(t))
        .filter((v) => Number.isFinite(v));
      if (values.length >= 3) {
        matrix.push(values.slice(0, 3));
      }
    }

    if (matrix.length !== 3) {
      throw new Error('SIESTAParser: LatticeVectors must have 3 rows');
    }

    return matrix;
  }

  private replaceSections(rawContent: string, structure: Structure): string {
    let result = rawContent;

    // Update NumberOfAtoms
    result = result.replace(
      /(NumberOfAtoms\s+)\d+/i,
      `$1${structure.atoms.length}`
    );

    // Update NumberOfSpecies
    const speciesSet = new Set(structure.atoms.map(atom => atom.element));
    result = result.replace(
      /(NumberOfSpecies\s+)\d+/i,
      `$1${speciesSet.size}`
    );

    // Update ChemicalSpeciesLabel block
    const speciesBlock = this.serializeSpeciesLabels(structure);
    result = this.replaceBlock(result, 'ChemicalSpeciesLabel', speciesBlock);

    const newLatticeBlock = this.serializeLatticeVectors(structure);
    result = this.replaceBlock(result, 'LatticeVectors', newLatticeBlock);

    const newCoordsBlock = this.serializeAtomicCoordinates(structure);
    result = this.replaceBlock(result, 'AtomicCoordinatesAndAtomicSpecies', newCoordsBlock);

    return result;
  }

  private serializeLatticeVectors(structure: Structure): string {
    const vectors = structure.unitCell
      ? structure.unitCell.getLatticeVectors()
      : [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ];

    const lines: string[] = [];
    for (const vec of vectors) {
      lines.push(`  ${vec[0].toFixed(10)}   ${vec[1].toFixed(10)}   ${vec[2].toFixed(10)}`);
    }
    return lines.join('\n');
  }

  private serializeSpeciesLabels(structure: Structure): string {
    const speciesOrder: string[] = [];
    for (const atom of structure.atoms) {
      if (!speciesOrder.includes(atom.element)) {
        speciesOrder.push(atom.element);
      }
    }

    const lines: string[] = [];
    for (let i = 0; i < speciesOrder.length; i++) {
      const element = speciesOrder[i];
      const atomicNumber = this.getAtomicNumber(element);
      lines.push(`  ${i + 1}  ${atomicNumber}   ${element}`);
    }
    return lines.join('\n');
  }

  private serializeAtomicCoordinates(structure: Structure): string {
    if (!structure.unitCell) {
      throw new Error('SIESTAParser: cannot serialize without unit cell');
    }

    const speciesMap = new Map<string, number>();
    let nextIdx = 1;

    const lines: string[] = [];
    for (const atom of structure.atoms) {
      const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);

      let speciesIdx = speciesMap.get(atom.element);
      if (speciesIdx === undefined) {
        speciesIdx = nextIdx++;
        speciesMap.set(atom.element, speciesIdx);
      }

      lines.push(
        `  ${frac[0].toFixed(10)}   ${frac[1].toFixed(10)}   ${frac[2].toFixed(10)}   ${speciesIdx}`
      );
    }

    return lines.join('\n');
  }

  private replaceBlock(content: string, blockName: string, newContent: string): string {
    const openPattern = new RegExp(`(%block\\s+${blockName}\\s*)(?:\\n|\\r\\n)[\\s\\S]*?(%endblock\\s+${blockName})`, 'i');
    const newBlock = `$1\n${newContent}\n$2`;

    if (openPattern.test(content)) {
      return content.replace(openPattern, newBlock);
    }

    const closePattern = new RegExp(`%endblock\\s+${blockName}`, 'i');
    if (!closePattern.test(content)) {
      const insertPattern = new RegExp(`%block\\s+${blockName}`, 'i');
      if (insertPattern.test(content)) {
        return content.replace(insertPattern, `%block ${blockName}\n${newContent}\n%endblock ${blockName}`);
      }
    }

    return content;
  }

  private generateDefaultFDF(structure: Structure): string {
    const lines: string[] = [];

    lines.push(`SystemName          ${(structure.name || 'SIESTA Structure').trim()}`);
    lines.push('');

    const speciesOrder: string[] = [];
    for (const atom of structure.atoms) {
      if (!speciesOrder.includes(atom.element)) {
        speciesOrder.push(atom.element);
      }
    }

    lines.push(`NumberOfAtoms       ${structure.atoms.length}`);
    lines.push(`NumberOfSpecies     ${speciesOrder.length}`);
    lines.push('');

    lines.push('%block ChemicalSpeciesLabel');
    for (let i = 0; i < speciesOrder.length; i++) {
      const element = speciesOrder[i];
      lines.push(`  ${i + 1}  ${this.getAtomicNumber(element)}   ${element}`);
    }
    lines.push('%endblock ChemicalSpeciesLabel');
    lines.push('');

    if (structure.unitCell) {
      const vectors = structure.unitCell.getLatticeVectors();
      lines.push('%block LatticeVectors');
      for (const vec of vectors) {
        lines.push(`  ${vec[0].toFixed(10)}   ${vec[1].toFixed(10)}   ${vec[2].toFixed(10)}`);
      }
      lines.push('%endblock LatticeVectors');
      lines.push('');
    }

    lines.push('AtomicCoordinatesFormat  Fractional');
    lines.push('');

    lines.push('%block AtomicCoordinatesAndAtomicSpecies');
    if (!structure.unitCell) {
      throw new Error('SIESTAParser: cannot serialize without unit cell');
    }
    for (const atom of structure.atoms) {
      const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
      const speciesIdx = speciesOrder.indexOf(atom.element) + 1;
      lines.push(
        `  ${frac[0].toFixed(10)}   ${frac[1].toFixed(10)}   ${frac[2].toFixed(10)}   ${speciesIdx}`
      );
    }
    lines.push('%endblock AtomicCoordinatesAndAtomicSpecies');

    return lines.join('\n');
  }

  private getAtomicNumber(element: string): number {
    const info = ELEMENT_DATA[element];
    return info ? info.atomicNumber : 1;
  }
}
