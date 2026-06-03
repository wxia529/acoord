import { Atom } from '../../models/atom.js';
import { Structure } from '../../models/structure.js';
import { UnitCell } from '../../models/unitCell.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { BOHR_TO_ANGSTROM } from '../../utils/constants.js';
import { ELEMENT_DATA, getDefaultAtomRadius, parseElement } from '../../utils/elementData.js';
import { StructureParser } from './structureParser.js';

type OpenMXCoordinateUnit = 'ang' | 'frac';

interface OpenMXSpeciesDefaults {
  pao: string;
  vps: string;
  valence: number;
}

const DEFAULT_KSPACING = 0.33;
const DEFAULT_ENERGY_CUTOFF = 220.0;

const OPENMX_SPECIES_DEFAULTS: Record<string, OpenMXSpeciesDefaults> = {
  H: { pao: 'H6.0-s2p1', vps: 'H_PBE19', valence: 1.0 },
  He: { pao: 'He8.0-s2p1', vps: 'He_PBE19', valence: 2.0 },
  Li: { pao: 'Li8.0-s3p2', vps: 'Li_PBE19', valence: 3.0 },
  Be: { pao: 'Be7.0-s2p2', vps: 'Be_PBE19', valence: 2.0 },
  B: { pao: 'B7.0-s2p2d1', vps: 'B_PBE19', valence: 3.0 },
  C: { pao: 'C6.0-s2p2d1', vps: 'C_PBE19', valence: 4.0 },
  N: { pao: 'N6.0-s2p2d1', vps: 'N_PBE19', valence: 5.0 },
  O: { pao: 'O6.0-s2p2d1', vps: 'O_PBE19', valence: 6.0 },
  F: { pao: 'F6.0-s2p2d1', vps: 'F_PBE19', valence: 7.0 },
  Ne: { pao: 'Ne9.0-s2p2d1', vps: 'Ne_PBE19', valence: 8.0 },
  Na: { pao: 'Na9.0-s3p2d1', vps: 'Na_PBE19', valence: 9.0 },
  Mg: { pao: 'Mg9.0-s3p2d1', vps: 'Mg_PBE19', valence: 8.0 },
  Al: { pao: 'Al7.0-s2p2d1', vps: 'Al_PBE19', valence: 3.0 },
  Si: { pao: 'Si7.0-s2p2d1', vps: 'Si_PBE19', valence: 4.0 },
  P: { pao: 'P7.0-s2p2d1f1', vps: 'P_PBE19', valence: 5.0 },
  S: { pao: 'S7.0-s2p2d1f1', vps: 'S_PBE19', valence: 6.0 },
  Cl: { pao: 'Cl7.0-s2p2d1f1', vps: 'Cl_PBE19', valence: 7.0 },
  Ar: { pao: 'Ar9.0-s2p2d1f1', vps: 'Ar_PBE19', valence: 8.0 },
  K: { pao: 'K10.0-s3p2d1', vps: 'K_PBE19', valence: 9.0 },
  Ca: { pao: 'Ca9.0-s3p2d1', vps: 'Ca_PBE19', valence: 10.0 },
  Sc: { pao: 'Sc9.0-s3p2d1', vps: 'Sc_PBE19', valence: 11.0 },
  Ti: { pao: 'Ti7.0-s3p2d1', vps: 'Ti_PBE19', valence: 12.0 },
  V: { pao: 'V6.0-s3p2d1', vps: 'V_PBE19', valence: 13.0 },
  Cr: { pao: 'Cr6.0-s3p2d1', vps: 'Cr_PBE19', valence: 14.0 },
  Mn: { pao: 'Mn6.0-s3p2d1', vps: 'Mn_PBE19', valence: 15.0 },
  Fe: { pao: 'Fe5.5H-s3p2d1', vps: 'Fe_PBE19H', valence: 16.0 },
  Co: { pao: 'Co6.0H-s3p2d1', vps: 'Co_PBE19H', valence: 17.0 },
  Ni: { pao: 'Ni6.0H-s3p2d1', vps: 'Ni_PBE19H', valence: 18.0 },
  Cu: { pao: 'Cu6.0H-s3p2d1', vps: 'Cu_PBE19H', valence: 19.0 },
  Zn: { pao: 'Zn6.0H-s3p2d1', vps: 'Zn_PBE19H', valence: 20.0 },
  Ga: { pao: 'Ga7.0-s3p2d2', vps: 'Ga_PBE19', valence: 13.0 },
  Ge: { pao: 'Ge7.0-s3p2d2', vps: 'Ge_PBE19', valence: 4.0 },
  As: { pao: 'As7.0-s3p2d2', vps: 'As_PBE19', valence: 15.0 },
  Se: { pao: 'Se7.0-s3p2d2', vps: 'Se_PBE19', valence: 6.0 },
  Br: { pao: 'Br7.0-s3p2d2', vps: 'Br_PBE19', valence: 7.0 },
  Kr: { pao: 'Kr10.0-s3p2d2', vps: 'Kr_PBE19', valence: 8.0 },
  Rb: { pao: 'Rb11.0-s3p2d2', vps: 'Rb_PBE19', valence: 9.0 },
  Sr: { pao: 'Sr10.0-s3p2d2', vps: 'Sr_PBE19', valence: 10.0 },
  Y: { pao: 'Y10.0-s3p2d2', vps: 'Y_PBE19', valence: 11.0 },
  Zr: { pao: 'Zr7.0-s3p2d2', vps: 'Zr_PBE19', valence: 12.0 },
  Nb: { pao: 'Nb7.0-s3p2d2', vps: 'Nb_PBE19', valence: 13.0 },
  Mo: { pao: 'Mo7.0-s3p2d2', vps: 'Mo_PBE19', valence: 14.0 },
  Tc: { pao: 'Tc7.0-s3p2d2', vps: 'Tc_PBE19', valence: 15.0 },
  Ru: { pao: 'Ru7.0-s3p2d2', vps: 'Ru_PBE19', valence: 14.0 },
  Rh: { pao: 'Rh7.0-s3p2d2', vps: 'Rh_PBE19', valence: 15.0 },
  Pd: { pao: 'Pd7.0-s3p2d2', vps: 'Pd_PBE19', valence: 16.0 },
  Ag: { pao: 'Ag7.0-s3p2d2', vps: 'Ag_PBE19', valence: 17.0 },
  Cd: { pao: 'Cd7.0-s3p2d2', vps: 'Cd_PBE19', valence: 12.0 },
  In: { pao: 'In7.0-s3p2d2', vps: 'In_PBE19', valence: 13.0 },
  Sn: { pao: 'Sn7.0-s3p2d3', vps: 'Sn_PBE19', valence: 14.0 },
  Sb: { pao: 'Sb7.0-s3p2d2', vps: 'Sb_PBE19', valence: 15.0 },
  Te: { pao: 'Te7.0-s3p2d2f1', vps: 'Te_PBE19', valence: 16.0 },
  I: { pao: 'I7.0-s3p2d2f1', vps: 'I_PBE19', valence: 7.0 },
  Xe: { pao: 'Xe11.0-s3p2d2', vps: 'Xe_PBE19', valence: 8.0 },
  Cs: { pao: 'Cs12.0-s3p2d2', vps: 'Cs_PBE19', valence: 9.0 },
  Ba: { pao: 'Ba10.0-s3p2d2', vps: 'Ba_PBE19', valence: 10.0 },
  La: { pao: 'La8.0-s3p2d2f1', vps: 'La_PBE19', valence: 11.0 },
  Ce: { pao: 'Ce8.0-s3p2d2f1', vps: 'Ce_PBE19', valence: 12.0 },
  Pr: { pao: 'Pr8.0-s3p2d2f1', vps: 'Pr_PBE19', valence: 13.0 },
  Nd: { pao: 'Nd8.0-s3p2d2f1', vps: 'Nd_PBE19', valence: 14.0 },
  Pm: { pao: 'Pm8.0-s3p2d2f1', vps: 'Pm_PBE19', valence: 15.0 },
  Sm: { pao: 'Sm8.0-s3p2d2f1', vps: 'Sm_PBE19', valence: 16.0 },
  Eu: { pao: 'Eu8.0-s3p2d2f1', vps: 'Eu_PBE19', valence: 17.0 },
  Gd: { pao: 'Gd8.0-s3p2d2f1', vps: 'Gd_PBE19', valence: 18.0 },
  Tb: { pao: 'Tb8.0-s3p2d2f1', vps: 'Tb_PBE19', valence: 19.0 },
  Dy: { pao: 'Dy8.0-s3p2d2f1', vps: 'Dy_PBE19', valence: 20.0 },
  Ho: { pao: 'Ho8.0-s3p2d2f1', vps: 'Ho_PBE19', valence: 21.0 },
  Er: { pao: 'Er8.0-s3p2d2f1', vps: 'Er_PBE19', valence: 22.0 },
  Tm: { pao: 'Tm8.0-s3p2d2f1', vps: 'Tm_PBE19', valence: 23.0 },
  Yb: { pao: 'Yb8.0-s3p2d2f1', vps: 'Yb_PBE19', valence: 24.0 },
  Lu: { pao: 'Lu8.0-s3p2d2f1', vps: 'Lu_PBE19', valence: 11.0 },
  Hf: { pao: 'Hf9.0-s3p2d2f1', vps: 'Hf_PBE19', valence: 12.0 },
  Ta: { pao: 'Ta7.0-s3p2d2f1', vps: 'Ta_PBE19', valence: 13.0 },
  W: { pao: 'W7.0-s3p2d2f1', vps: 'W_PBE19', valence: 12.0 },
  Re: { pao: 'Re7.0-s3p2d2f1', vps: 'Re_PBE19', valence: 15.0 },
  Os: { pao: 'Os7.0-s3p2d2f1', vps: 'Os_PBE19', valence: 14.0 },
  Ir: { pao: 'Ir7.0-s3p2d2f1', vps: 'Ir_PBE19', valence: 15.0 },
  Pt: { pao: 'Pt7.0-s3p2d2f1', vps: 'Pt_PBE19', valence: 16.0 },
  Au: { pao: 'Au7.0-s3p2d2f1', vps: 'Au_PBE19', valence: 17.0 },
  Hg: { pao: 'Hg8.0-s3p2d2f1', vps: 'Hg_PBE19', valence: 18.0 },
  Tl: { pao: 'Tl8.0-s3p2d2f1', vps: 'Tl_PBE19', valence: 19.0 },
  Pb: { pao: 'Pb8.0-s3p2d2f1', vps: 'Pb_PBE19', valence: 14.0 },
  Bi: { pao: 'Bi8.0-s3p2d2f1', vps: 'Bi_PBE19', valence: 15.0 },
};

/**
 * OpenMX input parser and serializer.
 */
export class OpenMXParser extends StructureParser {
  parse(content: string): Structure {
    if (!content.trim()) {
      throw new Error('OpenMXParser: empty input');
    }

    const lines = content.split(/\r?\n/);
    const name = this.parseSystemName(lines);
    const vectors = this.parseUnitVectors(lines);
    const structure = new Structure(name, true);
    structure.unitCell = UnitCell.fromVectors(vectors);

    const coordUnit = this.parseCoordinateUnit(lines);
    const atomLines = this.extractBlock(lines, 'Atoms.SpeciesAndCoordinates');
    if (atomLines.length === 0) {
      throw new Error('OpenMXParser: missing <Atoms.SpeciesAndCoordinates block');
    }

    for (const [idx, line] of atomLines.entries()) {
      const atom = this.parseAtomLine(line, idx + 1, coordUnit, structure.unitCell);
      if (atom) {
        structure.addAtom(atom);
      }
    }

    if (structure.atoms.length === 0) {
      throw new Error('OpenMXParser: no atom coordinates found');
    }

    this.applyFixedConstraints(lines, structure);
    structure.metadata.set('openmxRawContent', content);

    return structure;
  }

  serialize(structure: Structure): string {
    if (structure.atoms.length === 0) {
      throw new Error('Cannot write OpenMX input: structure has no atoms');
    }
    if (!structure.unitCell) {
      throw new Error('OpenMX export requires lattice vectors.');
    }

    const savedRawContent = structure.metadata.get('openmxRawContent') as string | undefined;
    if (savedRawContent) {
      return this.replaceOpenMXSections(savedRawContent, structure);
    }

    return this.generateDefaultOpenMX(structure);
  }

  private generateDefaultOpenMX(structure: Structure): string {
    if (!structure.unitCell) {
      throw new Error('OpenMX export requires lattice vectors.');
    }

    const species = this.getSpeciesOrder(structure);
    const vectors = structure.unitCell.getLatticeVectors();
    const [nka, nkb, nkc] = this.computeKgrid(vectors, DEFAULT_KSPACING);
    const name = this.sanitizeSystemName(structure.name || 'structure');
    const lines: string[] = [];

    lines.push('# ------------------------------------------------------------');
    lines.push('# Structure information generated by ACoord');
    lines.push(`# Number of atoms                    : ${structure.atoms.length}`);
    lines.push(`# Number of atomic species           : ${species.length}`);
    lines.push('# ------------------------------------------------------------');
    lines.push('');
    lines.push(`System.Name                   ${name}`);
    lines.push('DATA.PATH                     ./');
    lines.push('');
    lines.push(`Species.Number                ${species.length}`);
    lines.push('<Definition.of.Atomic.Species');
    for (const symbol of species) {
      const defaults = this.getOpenMXSpeciesDefaults(symbol);
      lines.push(`  ${symbol}   ${defaults.pao}   ${defaults.vps}`);
    }
    lines.push('Definition.of.Atomic.Species>');
    lines.push('');
    lines.push(`Atoms.Number                  ${structure.atoms.length}`);
    lines.push('Atoms.SpeciesAndCoordinates.Unit   Ang');
    lines.push('<Atoms.SpeciesAndCoordinates');
    structure.atoms.forEach((atom, idx) => {
      const defaults = this.getOpenMXSpeciesDefaults(atom.element);
      const charge = 0.5 * defaults.valence;
      lines.push(
        `  ${(idx + 1).toString().padStart(4)}  ${atom.element.padEnd(2)}  ${this.formatFloat(atom.x)}  ${this.formatFloat(atom.y)}  ${this.formatFloat(atom.z)}    ${charge.toFixed(1).padStart(4)}  ${charge.toFixed(1).padStart(4)}`
      );
    });
    lines.push('Atoms.SpeciesAndCoordinates>');
    lines.push('');
    lines.push('Atoms.UnitVectors.Unit        Ang');
    lines.push('<Atoms.UnitVectors');
    for (const vector of vectors) {
      lines.push(`  ${this.formatFloat(vector[0])}  ${this.formatFloat(vector[1])}  ${this.formatFloat(vector[2])}`);
    }
    lines.push('Atoms.UnitVectors>');
    lines.push('');
    lines.push('scf.XcType                    GGA-PBE');
    lines.push('scf.SpinPolarization          off');
    lines.push('scf.ElectronicTemperature     300.0');
    lines.push(`scf.energycutoff              ${DEFAULT_ENERGY_CUTOFF.toFixed(1)}`);
    lines.push('scf.maxIter                   100');
    lines.push('scf.EigenvalueSolver          band');
    lines.push(`scf.Kgrid                     ${nka}  ${nkb}  ${nkc}`);
    lines.push('scf.Mixing.Type               rmm-diisk');
    lines.push('scf.Init.Mixing.Weight        0.05');
    lines.push('scf.Min.Mixing.Weight         0.01');
    lines.push('scf.Max.Mixing.Weight         0.30');
    lines.push('scf.Mixing.History            25');
    lines.push('scf.Mixing.StartPulay         15');
    lines.push('scf.criterion                 1.0e-7');
    lines.push('');
    lines.push('MD.Type                       nomd');
    lines.push('MD.maxIter                    1');
    lines.push('MD.TimeStep                   1.0');
    lines.push('MD.Opt.criterion              0.0003');
    this.writeFixedConstraints(lines, structure);
    lines.push('');
    lines.push('Dos.fileout                   off');
    lines.push('Dos.Erange                    -25.0  20.0');
    lines.push(`Dos.Kgrid                     ${Math.max(1, Math.round(1.6 * nka))}  ${Math.max(1, Math.round(1.6 * nkb))}  ${Math.max(1, Math.round(1.6 * nkc))}`);

    return lines.join('\n');
  }

  private replaceOpenMXSections(rawContent: string, structure: Structure): string {
    if (!structure.unitCell) {
      throw new Error('OpenMX export requires lattice vectors.');
    }

    const lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    const vectors = structure.unitCell.getLatticeVectors();
    const coordUnit = this.parseCoordinateUnit(lines);
    const vectorUnit = this.parseUnitVectorUnit(lines);
    const originalAtomLines = this.extractBlock(lines, 'Atoms.SpeciesAndCoordinates');
    const hasConstraints = this.hasFixedConstraints(structure);
    let fixedBlockHandled = false;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = this.stripComment(line).trim();

      if (/^Atoms\.Number\s+/i.test(trimmed)) {
        resultLines.push(this.replaceKeywordValue(line, structure.atoms.length.toString()));
        i++;
        continue;
      }

      if (this.isBlockStart(trimmed, 'Atoms.SpeciesAndCoordinates')) {
        resultLines.push(line);
        i++;
        while (i < lines.length && !this.isBlockEnd(this.stripComment(lines[i]).trim(), 'Atoms.SpeciesAndCoordinates')) {
          i++;
        }
        for (let atomIndex = 0; atomIndex < structure.atoms.length; atomIndex++) {
          resultLines.push(
            this.formatReplacementAtomLine(
              structure,
              atomIndex,
              coordUnit,
              originalAtomLines[atomIndex]
            )
          );
        }
        if (i < lines.length) {
          resultLines.push(lines[i]);
          i++;
        }
        continue;
      }

      if (this.isBlockStart(trimmed, 'Atoms.UnitVectors')) {
        resultLines.push(line);
        i++;
        while (i < lines.length && !this.isBlockEnd(this.stripComment(lines[i]).trim(), 'Atoms.UnitVectors')) {
          i++;
        }
        for (const vector of vectors) {
          resultLines.push(this.formatUnitVectorLine(vector, vectorUnit));
        }
        if (i < lines.length) {
          resultLines.push(lines[i]);
          i++;
        }
        continue;
      }

      if (this.isBlockStart(trimmed, 'MD.Fixed.XYZ')) {
        fixedBlockHandled = true;
        i++;
        while (i < lines.length && !this.isBlockEnd(this.stripComment(lines[i]).trim(), 'MD.Fixed.XYZ')) {
          i++;
        }
        if (i < lines.length) {
          i++;
        }
        if (hasConstraints) {
          this.writeFixedConstraints(resultLines, structure);
        }
        continue;
      }

      resultLines.push(line);

      if (!fixedBlockHandled && hasConstraints && /^MD\.Opt\.criterion\s+/i.test(trimmed)) {
        this.writeFixedConstraints(resultLines, structure);
        fixedBlockHandled = true;
      }

      i++;
    }

    if (!fixedBlockHandled && hasConstraints) {
      if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim()) {
        resultLines.push('');
      }
      this.writeFixedConstraints(resultLines, structure);
    }

    return resultLines.join('\n');
  }

  private parseSystemName(lines: string[]): string {
    for (const raw of lines) {
      const line = this.stripComment(raw).trim();
      const match = /^System\.Name\s+(.+)$/i.exec(line);
      if (match) {
        return this.stripQuotes(match[1].trim());
      }
    }
    return 'structure';
  }

  private parseUnitVectors(lines: string[]): number[][] {
    const unit = this.parseUnitVectorUnit(lines);
    const block = this.extractBlock(lines, 'Atoms.UnitVectors');
    if (block.length < 3) {
      throw new Error('OpenMXParser: missing <Atoms.UnitVectors block');
    }

    const scale = unit === 'bohr' ? BOHR_TO_ANGSTROM : 1;
    const vectors = block.slice(0, 3).map((line, idx) => {
      const values = this.stripComment(line).trim().split(/\s+/).slice(0, 3).map(Number);
      if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
        throw new Error(`OpenMXParser line ${idx + 1}: invalid Atoms.UnitVectors row`);
      }
      return [values[0] * scale, values[1] * scale, values[2] * scale];
    });

    return vectors;
  }

  private parseUnitVectorUnit(lines: string[]): 'ang' | 'bohr' {
    const value = this.parseKeywordValue(lines, 'Atoms.UnitVectors.Unit');
    return value && /^(bohr|au)$/i.test(value) ? 'bohr' : 'ang';
  }

  private parseCoordinateUnit(lines: string[]): OpenMXCoordinateUnit {
    const value = this.parseKeywordValue(lines, 'Atoms.SpeciesAndCoordinates.Unit');
    return value && /^frac/i.test(value) ? 'frac' : 'ang';
  }

  private parseKeywordValue(lines: string[], keyword: string): string | null {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}\\s+(.+)$`, 'i');
    for (const raw of lines) {
      const line = this.stripComment(raw).trim();
      const match = pattern.exec(line);
      if (match) {
        return this.stripQuotes(match[1].trim().split(/\s+/)[0]);
      }
    }
    return null;
  }

  private extractBlock(lines: string[], name: string): string[] {
    const startPattern = new RegExp(`^<\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const endPattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`, 'i');
    const result: string[] = [];
    let inBlock = false;

    for (const raw of lines) {
      const line = this.stripComment(raw).trim();
      if (!inBlock) {
        if (startPattern.test(line)) {
          inBlock = true;
        }
        continue;
      }
      if (endPattern.test(line)) {
        break;
      }
      if (line) {
        result.push(line);
      }
    }

    return result;
  }

  private parseAtomLine(
    line: string,
    lineNum: number,
    coordUnit: OpenMXCoordinateUnit,
    unitCell: UnitCell
  ): Atom | null {
    const tokens = this.stripComment(line).trim().split(/\s+/);
    if (tokens.length < 4) {
      return null;
    }

    const firstIsIndex = Number.isInteger(Number(tokens[0]));
    const symbolToken = firstIsIndex ? tokens[1] : tokens[0];
    const coordStart = firstIsIndex ? 2 : 1;
    const element = parseElement(symbolToken);
    if (!element) {
      throw new Error(`OpenMXParser line ${lineNum}: invalid element "${symbolToken}"`);
    }

    const coords = tokens.slice(coordStart, coordStart + 3).map(Number);
    if (coords.length !== 3 || coords.some((value) => !Number.isFinite(value))) {
      throw new Error(`OpenMXParser line ${lineNum}: invalid atom coordinates`);
    }

    const [x, y, z] = coordUnit === 'frac'
      ? unitCell.fractionalToCartesian(coords[0], coords[1], coords[2])
      : coords;

    return new Atom(element, x, y, z, undefined, {
      color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
      radius: getDefaultAtomRadius(element),
    });
  }

  private formatReplacementAtomLine(
    structure: Structure,
    atomIndex: number,
    coordUnit: OpenMXCoordinateUnit,
    originalLine?: string
  ): string {
    const atom = structure.atoms[atomIndex];
    const coords = coordUnit === 'frac' && structure.unitCell
      ? structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z)
      : [atom.x, atom.y, atom.z] as [number, number, number];
    const originalTokens = originalLine ? this.stripComment(originalLine).trim().split(/\s+/) : [];
    const firstIsIndex = Number.isInteger(Number(originalTokens[0]));
    const coordStart = firstIsIndex ? 2 : 1;
    const serial = firstIsIndex && originalTokens[0]
      ? originalTokens[0]
      : (atomIndex + 1).toString();
    const suffix = originalTokens.length > coordStart + 3
      ? originalTokens.slice(coordStart + 3).join(' ')
      : this.defaultAtomChargeSuffix(atom.element);

    return `  ${serial.padStart(4)}  ${atom.element.padEnd(2)}  ${this.formatFloat(coords[0])}  ${this.formatFloat(coords[1])}  ${this.formatFloat(coords[2])}    ${suffix}`;
  }

  private defaultAtomChargeSuffix(element: string): string {
    const defaults = this.getOpenMXSpeciesDefaults(element);
    const charge = (0.5 * defaults.valence).toFixed(1);
    return `${charge}  ${charge}`;
  }

  private formatUnitVectorLine(vector: number[], unit: 'ang' | 'bohr'): string {
    const scale = unit === 'bohr' ? 1 / BOHR_TO_ANGSTROM : 1;
    return `  ${this.formatFloat(vector[0] * scale)}  ${this.formatFloat(vector[1] * scale)}  ${this.formatFloat(vector[2] * scale)}`;
  }

  private applyFixedConstraints(lines: string[], structure: Structure): void {
    const block = this.extractBlock(lines, 'MD.Fixed.XYZ');
    if (block.length === 0) {
      return;
    }

    for (const [idx, line] of block.entries()) {
      const tokens = this.stripComment(line).trim().split(/\s+/);
      if (tokens.length < 4) {
        throw new Error(`OpenMXParser line ${idx + 1}: invalid MD.Fixed.XYZ row`);
      }

      const atomIndex = Number.parseInt(tokens[0], 10) - 1;
      const fixedFlags = tokens.slice(1, 4).map((token) => Number.parseInt(token, 10));
      if (
        atomIndex < 0 ||
        atomIndex >= structure.atoms.length ||
        fixedFlags.some((flag) => flag !== 0 && flag !== 1)
      ) {
        throw new Error(`OpenMXParser line ${idx + 1}: invalid MD.Fixed.XYZ row`);
      }

      const atom = structure.atoms[atomIndex];
      const selectiveDynamics: [boolean, boolean, boolean] = [
        fixedFlags[0] === 0,
        fixedFlags[1] === 0,
        fixedFlags[2] === 0,
      ];
      atom.selectiveDynamics = selectiveDynamics;
      atom.fixed = selectiveDynamics.every((canMove) => !canMove);
    }

    for (const atom of structure.atoms) {
      if (!atom.selectiveDynamics) {
        atom.selectiveDynamics = [true, true, true];
        atom.fixed = false;
      }
    }
  }

  private writeFixedConstraints(lines: string[], structure: Structure): void {
    if (!this.hasFixedConstraints(structure)) {
      return;
    }

    lines.push('<MD.Fixed.XYZ');
    structure.atoms.forEach((atom, idx) => {
      const selectiveDynamics = atom.selectiveDynamics ?? (atom.fixed
        ? [false, false, false] as [boolean, boolean, boolean]
        : [true, true, true] as [boolean, boolean, boolean]);
      const fixedFlags = selectiveDynamics.map((canMove) => canMove ? 0 : 1);
      lines.push(
        `  ${(idx + 1).toString().padStart(4)}  ${fixedFlags[0]} ${fixedFlags[1]} ${fixedFlags[2]}`
      );
    });
    lines.push('MD.Fixed.XYZ>');
  }

  private hasFixedConstraints(structure: Structure): boolean {
    return structure.atoms.some((atom) =>
      atom.fixed || atom.selectiveDynamics?.some((canMove) => !canMove)
    );
  }

  private isBlockStart(line: string, name: string): boolean {
    return new RegExp(`^<\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line);
  }

  private isBlockEnd(line: string, name: string): boolean {
    return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`, 'i').test(line);
  }

  private replaceKeywordValue(line: string, value: string): string {
    const commentMatch = line.match(/(\s*#.*)$/);
    const comment = commentMatch?.[1] ?? '';
    const withoutComment = commentMatch ? line.slice(0, commentMatch.index) : line;
    const match = /^(\s*\S+\s+)(.*?)(\s*)$/.exec(withoutComment);
    if (!match) {
      return line;
    }
    return `${match[1]}${value}${match[3]}${comment}`;
  }

  private stripComment(line: string): string {
    return line.replace(/#.*/, '');
  }

  private stripQuotes(value: string): string {
    return value.replace(/^['"]|['"]$/g, '');
  }

  private getSpeciesOrder(structure: Structure): string[] {
    const species: string[] = [];
    for (const atom of structure.atoms) {
      if (!species.includes(atom.element)) {
        species.push(atom.element);
      }
    }
    return species;
  }

  private getOpenMXSpeciesDefaults(element: string): OpenMXSpeciesDefaults {
    const defaults = OPENMX_SPECIES_DEFAULTS[element];
    if (!defaults) {
      const info = ELEMENT_DATA[element];
      const name = info?.symbol ?? element;
      throw new Error(`OpenMX export does not have default PAO/VPS data for element "${name}"`);
    }
    return defaults;
  }

  private sanitizeSystemName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'structure';
    }
    return trimmed.replace(/\s+/g, '_');
  }

  private formatFloat(value: number): string {
    const cleaned = Math.abs(value) < 5e-13 ? 0 : value;
    return cleaned.toFixed(7).padStart(14);
  }

  private computeKgrid(vectors: number[][], spacing: number): [number, number, number] {
    const [a, b, c] = vectors;
    const volume = this.dot(a, this.cross(b, c));
    if (Math.abs(volume) < 1e-12) {
      return [1, 1, 1];
    }
    const factor = (2 * Math.PI) / volume;
    const b1 = this.scale(this.cross(b, c), factor);
    const b2 = this.scale(this.cross(c, a), factor);
    const b3 = this.scale(this.cross(a, b), factor);

    return [
      Math.max(1, Math.floor(this.length(b1) / spacing)),
      Math.max(1, Math.floor(this.length(b2) / spacing)),
      Math.max(1, Math.floor(this.length(b3) / spacing)),
    ];
  }

  private cross(a: number[], b: number[]): [number, number, number] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  private dot(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  private scale(a: number[], value: number): [number, number, number] {
    return [a[0] * value, a[1] * value, a[2] * value];
  }

  private length(a: number[]): number {
    return Math.sqrt(this.dot(a, a));
  }
}
