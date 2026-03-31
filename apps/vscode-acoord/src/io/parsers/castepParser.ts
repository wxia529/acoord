import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { fractionalToCartesian } from '../../utils/parserUtils.js';
import { StructureParser } from './structureParser.js';

export class CastepParser extends StructureParser {
  parse(content: string): Structure {
    const frames = this.parseTrajectory(content);
    if (frames.length === 0) {
      throw new Error('Invalid CASTEP output: no structure found');
    }
    return frames[frames.length - 1];
  }

  parseTrajectory(content: string): Structure[] {
    const lines = content.split(/\r?\n/);

    const frames: Structure[] = [];
    let currentLattice: number[][] | null = null;
    let currentSpecies: string[] = [];
    let currentPositions: [number, number, number][] = [];

    const iterationMarkers = [
      'BFGS: starting iteration',
      'BFGS: improving iteration',
      'Starting MD iteration',
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.includes('Unit Cell') && this.isBlockHeader(line)) {
        const lattice = this.parseUnitCell(lines, i);
        if (lattice) {
          currentLattice = lattice;
        }
        continue;
      }

      if (trimmed.includes('Total number of ions in cell')) {
        this.parseIonCount(trimmed);
        continue;
      }

      if (trimmed.includes('Fractional coordinates of atoms')) {
        const parsed = this.parseFractionalCoordinates(lines, i, currentLattice);
        if (parsed) {
          currentSpecies = parsed.species;
          currentPositions = parsed.positions;
          i = parsed.nextIndex - 1;
        }
        continue;
      }

      if (iterationMarkers.some((m) => trimmed.includes(m))) {
        if (currentSpecies.length > 0 && currentPositions.length > 0) {
          frames.push(this.buildFrame(currentSpecies, currentPositions, currentLattice, frames.length + 1));
        }
        currentSpecies = [];
        currentPositions = [];
        continue;
      }
    }

    if (currentSpecies.length > 0 && currentPositions.length > 0) {
      frames.push(this.buildFrame(currentSpecies, currentPositions, currentLattice, frames.length + 1));
    }

    if (frames.length === 0) {
      throw new Error('Invalid CASTEP output: no atom positions found');
    }

    return frames;
  }

  serialize(_structure: Structure): string {
    throw new Error('CASTEP output export is not supported');
  }

  private isBlockHeader(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.includes('Unit Cell') || /^\s*\*+\s*$/.test(trimmed);
  }

  private parseUnitCell(lines: string[], startIndex: number): number[][] | null {
    const vectors: number[][] = [];
    let i = startIndex + 1;

    while (i < lines.length && vectors.length < 3) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('-')) {
        i++;
        continue;
      }

      if (/^[a-z]+\s+a\s*=/i.test(trimmed) || /^\s*a\s*=/i.test(trimmed)) {
        const vector = this.parseLatticeLine(trimmed);
        if (vector) {
          vectors.push(vector);
        }
        i++;
        continue;
      }

      const numbers = trimmed.split(/\s+/).filter((t) => /^-?\d/.test(t));
      if (numbers.length >= 3) {
        const vals = numbers.slice(0, 3).map((n) => parseFloat(n));
        if (vals.every((v) => Number.isFinite(v))) {
          vectors.push(vals);
        }
      }
      i++;
    }

    if (vectors.length === 3) {
      return vectors;
    }

    return this.parseUnitCellFromAxes(lines, startIndex);
  }

  private parseLatticeLine(line: string): number[] | null {
    const match = line.match(/a\s*=\s*([\d.]+)\s+(\S+)\s+(\S+)\s*$/i);
    if (match) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);
      const z = parseFloat(match[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        return [x, y, z];
      }
    }

    const numbers = line.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (numbers && numbers.length >= 3) {
      const vals = numbers.slice(0, 3).map((n) => parseFloat(n));
      if (vals.every((v) => Number.isFinite(v))) {
        return vals;
      }
    }
    return null;
  }

  private parseUnitCellFromAxes(lines: string[], startIndex: number): number[][] | null {
    let i = startIndex;

    while (i < lines.length && i < startIndex + 20) {
      const trimmed = lines[i].trim();
      if (/crystal axes/i.test(trimmed) || /real lattice/i.test(trimmed)) {
        const vectors = this.parseAxesBlock(lines, i);
        if (vectors) {
          return vectors;
        }
      }
      i++;
    }
    return null;
  }

  private parseAxesBlock(lines: string[], startIndex: number): number[][] | null {
    const vectors: number[][] = [];
    let i = startIndex + 1;

    while (i < lines.length && vectors.length < 3) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('=')) {
        i++;
        continue;
      }

      const numbers = trimmed.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
      if (numbers && numbers.length >= 3) {
        const vals = numbers.slice(0, 3).map((n) => parseFloat(n));
        if (vals.every((v) => Number.isFinite(v))) {
          vectors.push(vals);
        }
      } else {
        i++;
        continue;
      }
      i++;
    }

    return vectors.length === 3 ? vectors : null;
  }

  private parseIonCount(line: string): number | null {
    const match = line.match(/total\s+number\s+of\s+ions\s+in\s+cell\s*=\s*(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private parseFractionalCoordinates(
    lines: string[],
    startIndex: number,
    latticeVectors: number[][] | null
  ): { species: string[]; positions: [number, number, number][]; nextIndex: number } | null {
    const species: string[] = [];
    const positions: [number, number, number][] = [];
    let i = startIndex + 1;

    let state: 'header' | 'separator' | 'data' = 'header';
    while (i < lines.length) {
      const trimmed = lines[i].trim();

      if (!trimmed) {
        if (state === 'data' && species.length > 0) {
          break;
        }
        i++;
        continue;
      }

      if (state === 'header') {
        if (/^[-]+$/.test(trimmed) || /^x-+x$/i.test(trimmed)) {
          state = 'data';
        } else if (/^\s*x\s+(y|frac)/i.test(trimmed) || /^\s*Element/i.test(trimmed) || /Element\s+Atom/i.test(trimmed)) {
          state = 'separator';
        }
        i++;
        continue;
      }

      if (state === 'separator') {
        if (/^[-]+$/.test(trimmed) || /^x-+$/.test(trimmed)) {
          state = 'data';
        }
        i++;
        continue;
      }

      const parts = trimmed.split(/\s+/);

      const isBorderedFormat = parts[0] === 'x' && parts[parts.length - 1] === 'x';
      if (isBorderedFormat) {
        const result = this.parseBorderedLine(parts, latticeVectors);
        if (result) {
          species.push(result.element);
          positions.push(result.position);
        } else if (species.length > 0) {
          break;
        }
        i++;
        continue;
      }

      if (parts.length < 4) {
        if (species.length > 0) {
          break;
        }
        i++;
        continue;
      }

      const numbers = parts.slice(0, 3).map((p) => parseFloat(p));
      if (numbers.some((n) => !Number.isFinite(n))) {
        if (species.length > 0) {
          break;
        }
        i++;
        continue;
      }

      let elementIdx = 3;
      for (let j = 3; j < parts.length; j++) {
        if (parseElement(this.stripCustomSpecies(parts[j]))) {
          elementIdx = j;
          break;
        }
      }

      const elementRaw = parts[elementIdx];
      const element = this.stripCustomSpecies(elementRaw);
      if (!parseElement(element)) {
        if (species.length > 0) {
          break;
        }
        i++;
        continue;
      }

      const fx = numbers[0];
      const fy = numbers[1];
      const fz = numbers[2];

      let position: [number, number, number];
      if (latticeVectors) {
        position = fractionalToCartesian(fx, fy, fz, latticeVectors);
      } else {
        position = [fx, fy, fz];
      }

      species.push(element);
      positions.push(position);
      i++;
    }

    if (species.length === 0) {
      return null;
    }

    return { species, positions, nextIndex: i };
  }

  private parseBorderedLine(
    parts: string[],
    latticeVectors: number[][] | null
  ): { element: string; position: [number, number, number] } | null {
    const innerParts = parts.slice(1, -1);

    if (innerParts.length < 5) {
      return null;
    }

    const elementRaw = innerParts[0];
    const element = this.stripCustomSpecies(elementRaw);
    if (!parseElement(element)) {
      return null;
    }

    let coords: [number, number, number] | null = null;
    for (let start = 2; start <= innerParts.length - 3; start++) {
      const fx = parseFloat(innerParts[start]);
      const fy = parseFloat(innerParts[start + 1]);
      const fz = parseFloat(innerParts[start + 2]);
      if (Number.isFinite(fx) && Number.isFinite(fy) && Number.isFinite(fz)) {
        coords = [fx, fy, fz];
        break;
      }
    }

    if (!coords) {
      return null;
    }

    let position: [number, number, number];
    if (latticeVectors) {
      position = fractionalToCartesian(coords[0], coords[1], coords[2], latticeVectors);
    } else {
      position = coords;
    }

    return { element, position };
  }

  private stripCustomSpecies(label: string): string {
    const match = label.match(/^([A-Z][a-z]?)/i);
    return match ? match[1] : label;
  }

  private buildFrame(
    species: string[],
    positions: [number, number, number][],
    latticeVectors: number[][] | null,
    frameIndex: number
  ): Structure {
    const structure = new Structure(`CASTEP frame ${frameIndex}`, true);

    if (latticeVectors) {
      structure.unitCell = UnitCell.fromVectors(latticeVectors);
      structure.isCrystal = true;
    }

    for (let i = 0; i < species.length && i < positions.length; i++) {
      const element = species[i];
      const [x, y, z] = positions[i];
      const atom = new Atom(element, x, y, z, undefined, {
        color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
        radius: getDefaultAtomRadius(element),
      });
      structure.addAtom(atom);
    }

    return structure;
  }
}
