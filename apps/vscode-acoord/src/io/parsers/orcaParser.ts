import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { StructureParser } from './structureParser.js';

/**
 * ORCA input file parser (.inp)
 * Minimal support: * xyz charge mult ... *
 * Lattice data (if any) is ignored.
 */
export class ORCAParser extends StructureParser {
  parse(content: string): Structure {
    // Save complete raw content for format preservation (Strategy 1)
    const rawContent = content;
    
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) =>
      /^\*\s*xyz\b/i.test(line.trim())
    );

    if (startIndex < 0) {
      throw new Error('Invalid ORCA input: missing "* xyz" block');
    }

    const headerLine = lines[startIndex].trim();
    const parts = headerLine.split(/\s+/);
    let charge = 0;
    let multiplicity = 1;

    if (parts.length >= 4) {
      charge = parseInt(parts[parts.length - 2], 10);
      multiplicity = parseInt(parts[parts.length - 1], 10);
    }

    const structure = new Structure('');
    structure.metadata.set('charge', charge);
    structure.metadata.set('multiplicity', multiplicity);
    
    // Store raw content in metadata for serialization
    structure.metadata.set('orcaRawContent', rawContent);

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      if (line.startsWith('*')) {
        break;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        continue;
      }
      const element = parseElement(parts[0]);
      if (!element) {
        continue;
      }
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      structure.addAtom(new Atom(element, x, y, z, undefined, {
        color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
        radius: getDefaultAtomRadius(element),
      }));
    }

    this.applyCartesianConstraints(lines, structure);

    return structure;
  }

  serialize(structure: Structure): string {
    // Strategy 1: Use saved raw content and replace coordinate section
    const savedRawContent = structure.metadata.get('orcaRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultORCA(structure);
    }

    // Replace charge/multiplicity and coordinate section
    const updatedContent = this.replaceORCASections(savedRawContent, structure);
    return this.synchronizeCartesianConstraints(updatedContent, structure);
  }

  private generateDefaultORCA(structure: Structure): string {
    const lines: string[] = [];
    lines.push('! B3LYP D3 def2-SVP');
    lines.push('%maxcore     8192');
    lines.push('%pal nprocs   8 end');

    const charge = structure.metadata.get('charge') as number ?? 0;
    const multiplicity = structure.metadata.get('multiplicity') as number ?? 1;
    const constraints = this.buildCartesianConstraintLines(structure);
    if (constraints.length > 0) {
      lines.push('%geom Constraints');
      lines.push(...constraints);
      lines.push('end');
      lines.push('end');
    }
    lines.push(`* xyz ${charge} ${multiplicity}`);
    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }
    lines.push('*');
    return lines.join('\n');
  }

  private replaceORCASections(rawContent: string, structure: Structure): string {
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

      // Find * xyz line
      if (!inCoordinates && /^\*\s*xyz\b/i.test(trimmed)) {
        // Update charge/multiplicity in the line
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 4) {
          const updatedParts = [...parts];
          updatedParts[parts.length - 2] = charge.toString();
          updatedParts[parts.length - 1] = multiplicity.toString();
          resultLines.push(updatedParts.join(' '));
        } else {
          resultLines.push(line);
        }
        i++;
        inCoordinates = true;
        continue;
      }

      // In coordinate section - skip old coordinates until closing *
      if (inCoordinates && !coordsWritten) {
        if (trimmed.startsWith('*') && trimmed !== '* xyz') {
          // Closing * - write coordinates before it
          coordsWritten = true;
          this.writeORCACoordinates(resultLines, structure);
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

    // If coordinates were not found (missing closing *), append them
    if (!coordsWritten && inCoordinates) {
      this.writeORCACoordinates(resultLines, structure);
      resultLines.push('*');
    }

    return resultLines.join('\n');
  }

  private writeORCACoordinates(lines: string[], structure: Structure): void {
    for (const atom of structure.atoms) {
      lines.push(
        `${atom.element}  ${atom.x.toFixed(10)}  ${atom.y.toFixed(10)}  ${atom.z.toFixed(10)}`
      );
    }
  }

  private applyCartesianConstraints(lines: string[], structure: Structure): void {
    const constrainedAxes = structure.atoms.map(() => [false, false, false] as [boolean, boolean, boolean]);
    let inGeom = false;
    let inConstraints = false;

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '');
      const trimmed = line.trim();

      if (!inGeom && /^%geom\b/i.test(trimmed)) {
        inGeom = true;
        inConstraints = /\bconstraints\b/i.test(trimmed);
      } else if (inGeom && !inConstraints && /^constraints\b/i.test(trimmed)) {
        inConstraints = true;
      } else if (inConstraints && /^end\b/i.test(trimmed)) {
        inConstraints = false;
        continue;
      } else if (inGeom && /^end\b/i.test(trimmed)) {
        inGeom = false;
        continue;
      }

      if (!inConstraints) {
        continue;
      }

      const entryPattern = /\{\s*([CXYZ])\s+(\d+)(?::(\d+))?\s+C\s*\}/gi;
      for (const match of line.matchAll(entryPattern)) {
        const axis = match[1].toUpperCase();
        const start = Number.parseInt(match[2], 10);
        const end = match[3] ? Number.parseInt(match[3], 10) : start;
        for (let atomIndex = start; atomIndex <= end && atomIndex < constrainedAxes.length; atomIndex++) {
          if (axis === 'C' || axis === 'X') {
            constrainedAxes[atomIndex][0] = true;
          }
          if (axis === 'C' || axis === 'Y') {
            constrainedAxes[atomIndex][1] = true;
          }
          if (axis === 'C' || axis === 'Z') {
            constrainedAxes[atomIndex][2] = true;
          }
        }
      }
    }

    for (let i = 0; i < structure.atoms.length; i++) {
      const axes = constrainedAxes[i];
      if (!axes.some(Boolean)) {
        continue;
      }
      structure.atoms[i].selectiveDynamics = axes.map((constrained) => !constrained) as [boolean, boolean, boolean];
      structure.atoms[i].fixed = axes.every(Boolean);
    }
  }

  private synchronizeCartesianConstraints(content: string, structure: Structure): string {
    const lines = content.split(/\r?\n/);
    const constraintLines = this.buildCartesianConstraintLines(structure);
    const result: string[] = [];
    let inGeom = false;
    let inConstraints = false;
    let foundConstraints = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!inGeom && /^%geom\b/i.test(trimmed)) {
        inGeom = true;
        inConstraints = /\bconstraints\b/i.test(trimmed);
        foundConstraints ||= inConstraints;
        result.push(line);
        continue;
      }
      if (inGeom && !inConstraints && /^constraints\b/i.test(trimmed)) {
        inConstraints = true;
        foundConstraints = true;
        result.push(line);
        continue;
      }
      if (inConstraints && /^end\b/i.test(trimmed)) {
        result.push(...constraintLines);
        result.push(line);
        inConstraints = false;
        continue;
      }
      if (inGeom && !inConstraints && /^end\b/i.test(trimmed)) {
        inGeom = false;
        result.push(line);
        continue;
      }
      if (inConstraints) {
        const updated = line.replace(/\{\s*[CXYZ]\s+\d+(?::\d+)?\s+C\s*\}/gi, '').trimEnd();
        if (updated.trim() !== '') {
          result.push(updated);
        }
        continue;
      }
      result.push(line);
    }

    if (foundConstraints || constraintLines.length === 0) {
      return result.join('\n');
    }

    const geomIndex = result.findIndex((line) => /^%geom\b/i.test(line.trim()));
    const block = ['  Constraints', ...constraintLines, '  end'];
    if (geomIndex >= 0) {
      result.splice(geomIndex + 1, 0, ...block);
    } else {
      const xyzIndex = result.findIndex((line) => /^\*\s*xyz\b/i.test(line.trim()));
      const insertionIndex = xyzIndex >= 0 ? xyzIndex : result.length;
      result.splice(insertionIndex, 0, '%geom', ...block, 'end');
    }
    return result.join('\n');
  }

  private buildCartesianConstraintLines(structure: Structure): string[] {
    const constrainedIndices: Record<'C' | 'X' | 'Y' | 'Z', number[]> = {
      C: [],
      X: [],
      Y: [],
      Z: [],
    };
    for (let atomIndex = 0; atomIndex < structure.atoms.length; atomIndex++) {
      const atom = structure.atoms[atomIndex];
      const canMove = atom.selectiveDynamics ?? (atom.fixed
        ? [false, false, false]
        : [true, true, true]);
      if (atom.fixed || canMove.every((value) => !value)) {
        constrainedIndices.C.push(atomIndex);
        continue;
      }
      (['X', 'Y', 'Z'] as const).forEach((axis, axisIndex) => {
        if (!canMove[axisIndex]) {
          constrainedIndices[axis].push(atomIndex);
        }
      });
    }

    return (['C', 'X', 'Y', 'Z'] as const).flatMap((axis) =>
      this.compressConstraintIndices(axis, constrainedIndices[axis])
    );
  }

  private compressConstraintIndices(axis: 'C' | 'X' | 'Y' | 'Z', indices: number[]): string[] {
    const lines: string[] = [];
    let rangeStart = indices[0];
    let rangeEnd = indices[0];

    for (let i = 1; i <= indices.length; i++) {
      const index = indices[i];
      if (index === rangeEnd + 1) {
        rangeEnd = index;
        continue;
      }
      if (rangeStart !== undefined && rangeEnd !== undefined) {
        const atomRange = rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}:${rangeEnd}`;
        lines.push(`    { ${axis} ${atomRange} C }`);
      }
      rangeStart = index;
      rangeEnd = index;
    }
    return lines;
  }
}
