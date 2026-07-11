import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { StructureParser } from './structureParser.js';
import { formatCoordinateTriplet } from '../../utils/coordinateFormat.js';

/**
 * Gaussian input file format parser (GJF/COM)
 * Minimal support: title, charge/multiplicity, atom lines, and TV lattice vectors.
 */
export class GJFParser extends StructureParser {
  parse(content: string): Structure {
    // Save complete raw content for format preservation (Strategy 1)
    const rawContent = content;
    
    const lines = content.split(/\r?\n/);
    let idx = 0;

    // Skip route section and header until first blank line
    while (idx < lines.length && lines[idx].trim() !== '') {
      idx++;
    }
    while (idx < lines.length && lines[idx].trim() === '') {
      idx++;
    }

    // Title section (first non-empty line)
    const titleLine = (lines[idx] || '').trim();
    const title = titleLine;
    idx++;

    // Skip blank line after title
    while (idx < lines.length && lines[idx].trim() === '') {
      idx++;
    }

    // Charge and multiplicity line
    let chargeMultiplicityIndex = -1;
    for (let i = idx; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 2 && this.isInteger(parts[0]) && this.isInteger(parts[1])) {
        chargeMultiplicityIndex = i;
        break;
      }
      if (lines[i].trim() === '') {
        break;
      }
    }
    if (chargeMultiplicityIndex < 0) {
      throw new Error('Invalid GJF format: missing charge/multiplicity');
    }

    const chargeLine = lines[chargeMultiplicityIndex].trim().split(/\s+/);
    const charge = parseInt(chargeLine[0], 10);
    const multiplicity = parseInt(chargeLine[1], 10);

    idx = chargeMultiplicityIndex + 1;

    const structure = new Structure(title || '');
    structure.metadata.set('charge', charge);
    structure.metadata.set('multiplicity', multiplicity);
    
    // Store raw content in metadata for serialization
    structure.metadata.set('gjfRawContent', rawContent);
    
    const latticeVectors: number[][] = [];
    let hasFreezeCodes = false;

    // Atom and TV lines until blank line or EOF
    for (; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line) {
        break;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        continue;
      }

      if (parts[0].toUpperCase() === 'TV' && parts.length >= 4) {
        const vec = [
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3]),
        ];
        if (vec.every((v) => Number.isFinite(v))) {
          latticeVectors.push(vec as [number, number, number]);
        }
        continue;
      }

      const isDefaultGhost = /^bq$/i.test(parts[0]);
      const ghostMatch = /^([a-z]{1,2})-bq$/i.exec(parts[0]);
      const isGhost = isDefaultGhost || ghostMatch !== null;
      const isDummy = !isGhost && /^x\d*$/i.test(parts[0]);
      const element = isDummy
        ? 'X'
        : parseElement(isDefaultGhost ? 'H' : ghostMatch ? ghostMatch[1] : parts[0]);
      if (!element) {
        throw new Error(`GJFParser line ${idx + 1}: invalid atom label "${parts[0]}"`);
      }

      const hasFreezeCode = parts.length >= 5 && this.isInteger(parts[1]);
      const coordinateOffset = hasFreezeCode ? 2 : 1;
      const x = parseFloat(parts[coordinateOffset]);
      const y = parseFloat(parts[coordinateOffset + 1]);
      const z = parseFloat(parts[coordinateOffset + 2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      const fixed = hasFreezeCode && parseInt(parts[1], 10) === -1;
      hasFreezeCodes ||= hasFreezeCode;
      structure.addAtom(new Atom(element, x, y, z, undefined, {
        color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
        radius: getDefaultAtomRadius(element),
        fixed,
        selectiveDynamics: hasFreezeCode
          ? (fixed ? [false, false, false] : [true, true, true])
          : undefined,
        role: isDummy ? 'dummy' : isGhost ? 'ghost' : 'real',
        sourceLabel: isDummy ? 'X' : isGhost ? parts[0] : undefined,
      }));
    }

    structure.metadata.set('gjfHasFreezeCodes', hasFreezeCodes);

    if (latticeVectors.length === 3) {
      structure.isCrystal = true;
      structure.unitCell = this.unitCellFromLattice(latticeVectors);
    }

    return structure;
  }

  serialize(structure: Structure): string {
    // Strategy 1: Use saved raw content and replace coordinate section
    const savedRawContent = structure.metadata.get('gjfRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultGJF(structure);
    }

    // Replace charge/multiplicity and coordinate section
    return this.replaceGJFSections(savedRawContent, structure);
  }

  private generateDefaultGJF(structure: Structure): string {
    const lines: string[] = [];
    lines.push('#P');
    lines.push('');
    lines.push(structure.name?.trim() ? structure.name : 'Gaussian input');
    lines.push('');

    const charge = structure.metadata.get('charge') as number ?? 0;
    const multiplicity = structure.metadata.get('multiplicity') as number ?? 1;
    lines.push(`${charge} ${multiplicity}`);

    this.writeGJFCoordinates(lines, structure);

    return lines.join('\n');
  }

  private replaceGJFSections(rawContent: string, structure: Structure): string {
    const lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    
    const charge = structure.metadata.get('charge') as number ?? 0;
    const multiplicity = structure.metadata.get('multiplicity') as number ?? 1;

    let i = 0;
    let inCoordinates = false;
    let coordsWritten = false;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Find charge/multiplicity line (two integers)
      if (!inCoordinates && !coordsWritten) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2 && this.isInteger(parts[0]) && this.isInteger(parts[1])) {
          // Replace charge/multiplicity
          resultLines.push(`${charge} ${multiplicity}`);
          i++;
          inCoordinates = true;
          continue;
        }
      }

      // In coordinate section - skip old coordinates
      if (inCoordinates && !coordsWritten) {
        if (!trimmed) {
          // Blank line marks end of coordinates
          coordsWritten = true;
          // Write new coordinates before the blank line
          this.writeGJFCoordinates(resultLines, structure);
          resultLines.push(line);
          i++;
          continue;
        }
        // Skip old coordinate line
        i++;
        continue;
      }

      // Copy other lines unchanged
      resultLines.push(line);
      i++;
    }

    // If coordinates were not found, append them
    if (!coordsWritten) {
      this.writeGJFCoordinates(resultLines, structure);
    }

    return resultLines.join('\n');
  }

  private writeGJFCoordinates(lines: string[], structure: Structure): void {
    const includeFreezeCodes = structure.metadata.get('gjfHasFreezeCodes') === true
      || structure.atoms.some((atom) => atom.fixed);

    for (const atom of structure.atoms) {
      const freezeCode = includeFreezeCodes ? `  ${atom.fixed ? -1 : 0}` : '';
      lines.push(
        `${(this.getAtomLabel(atom) + freezeCode).padEnd(8)}  ${formatCoordinateTriplet([atom.x, atom.y, atom.z])}`
      );
    }

    if (structure.unitCell) {
      const vectors = structure.unitCell.getLatticeVectors();
      for (const vec of vectors) {
        lines.push(`${'TV'.padEnd(8)}  ${formatCoordinateTriplet(vec)}`);
      }
    }
  }

  private getAtomLabel(atom: Atom): string {
    if (atom.role === 'dummy') {
      return 'X';
    }
    if (atom.role === 'ghost') {
      return atom.element === 'H' ? 'Bq' : `${atom.element}-Bq`;
    }
    return atom.element;
  }

  private isInteger(value: string): boolean {
    return /^-?\d+$/.test(value.trim());
  }

  private unitCellFromLattice(vectors: number[][]): UnitCell {
    return UnitCell.fromVectors(vectors);
  }
}
