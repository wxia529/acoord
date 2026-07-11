import { Structure } from '../../models/structure.js';
import { Atom } from '../../models/atom.js';
import { UnitCell } from '../../models/unitCell.js';
import { ELEMENT_DATA, parseElement, getDefaultAtomRadius } from '../../utils/elementData.js';
import type { ElementInfo } from '../../utils/elementData.js';
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { BOHR_TO_ANGSTROM, ANGSTROM_TO_BOHR } from '../../utils/constants.js';
import { fractionalToCartesian } from '../../utils/parserUtils.js';
import { StructureParser } from './structureParser.js';
import { formatCoordinateTriplet } from '../../utils/coordinateFormat.js';

type AbacusOrbitalLibrary = 'efficiency' | 'precision';

interface StruSpecies {
  label: string;
  mass: number;
  pseudoFile?: string;
  pseudoType?: string;
  rawLine: string;
}

interface StruOrbital {
  element?: string;
  orbitalFile: string;
  rawLine: string;
}

interface StruLatticeMetadata {
  latticeConstantBohr?: number;
  latticeVectors?: number[][];
  latticeParameters?: number[];
  requiresInputLatname?: boolean;
}

interface StruAtomExtras {
  moveFlags?: [number, number, number];
  movementStyle?: 'bare' | 'm';
  movementStart?: number;
  originalTokens?: string[];
  commentSuffix?: string;
  velocity?: [number, number, number];
  velocityKeyword?: 'v' | 'vel' | 'velocity';
  mag?: number[];
  magKeyword?: 'mag' | 'magmom';
  angle1?: number;
  angle2?: number;
  lambda?: number[];
  sc?: number[];
}

interface StruElementBlockMetadata {
  elementLine: string;
  magnetismLine: string;
  countCommentSuffix?: string;
}

interface SplitCommentLine {
  content: string;
  commentSuffix: string;
}

const APNS_PSEUDOPOTENTIALS_V1: Record<string, string> = {
  Ag: 'Ag.upf',
  Al: 'Al.upf',
  Ar: 'Ar.upf',
  As: 'As.PD04.PBE.UPF',
  Au: 'Au_ONCV_PBE-1.0.upf',
  B: 'B.PD04.PBE.UPF',
  Ba: 'Ba_ONCV_PBE-1.0.upf',
  Be: 'Be_ONCV_PBE-1.2.upf',
  Bi: 'Bi_ONCV_PBE-1.2.upf',
  Br: 'Br.upf',
  C: 'C.upf',
  Ca: 'Ca.upf',
  Cd: 'Cd_ONCV_PBE-1.2.upf',
  Cl: 'Cl.upf',
  Co: 'Co_ONCV_PBE-1.2.upf',
  Cr: 'Cr_ONCV_PBE-1.2.upf',
  Cs: 'Cs.upf',
  Cu: 'Cu_ONCV_PBE-1.0.upf',
  F: 'F.upf',
  Fe: 'Fe_ONCV_PBE-1.2.upf',
  Ga: 'Ga.upf',
  Ge: 'Ge_ONCV_PBE-1.2.upf',
  H: 'H.upf',
  He: 'He_ONCV_PBE-1.2.upf',
  Hf: 'Hf-sp.PD04.PBE.UPF',
  Hg: 'Hg.PD04.PBE.UPF',
  I: 'I.upf',
  In: 'In.upf',
  Ir: 'Ir_ONCV_PBE-1.0.upf',
  K: 'K_ONCV_PBE-1.2.upf',
  Kr: 'Kr_ONCV_PBE-1.2.upf',
  La: 'La_ONCV_PBE-1.2.upf',
  Li: 'Li.upf',
  Mg: 'Mg.PD04.PBE.UPF',
  Mn: 'Mn_ONCV_PBE-1.2.upf',
  Mo: 'Mo_ONCV_PBE-1.0.upf',
  N: 'N_ONCV_PBE-1.0.upf',
  Na: 'Na.upf',
  Nb: 'Nb.upf',
  Ne: 'Ne.upf',
  Ni: 'Ni_ONCV_PBE-1.2.upf',
  O: 'O.upf',
  Os: 'Os-sp.PD04.PBE.UPF',
  P: 'P.PD04.PBE.UPF',
  Pb: 'Pb_ONCV_PBE-1.2.upf',
  Pd: 'Pd_ONCV_PBE-1.2.upf',
  Pt: 'Pt_ONCV_PBE-1.2.upf',
  Rb: 'Rb_ONCV_PBE-1.2.upf',
  Re: 'Re.upf',
  Rh: 'Rh_ONCV_PBE_FR-1.0.upf',
  Ru: 'Ru_ONCV_PBE_FR-1.0.upf',
  S: 'S.upf',
  Sb: 'Sb_ONCV_PBE-1.1.upf',
  Sc: 'Sc_ONCV_PBE-1.2.upf',
  Se: 'Se_ONCV_PBE_FR-1.1.upf',
  Si: 'Si.upf',
  Sn: 'Sn_ONCV_PBE-1.1.upf',
  Sr: 'Sr_ONCV_PBE-1.2.upf',
  Ta: 'Ta_ONCV_PBE-1.1.upf',
  Tc: 'Tc_ONCV_PBE-1.0.upf',
  Te: 'Te.PD04.PBE.UPF',
  Ti: 'Ti_ONCV_PBE-1.2.upf',
  Tl: 'Tl_ONCV_PBE-1.0.upf',
  V: 'V.upf',
  W: 'W_ONCV_PBE-1.2.upf',
  Xe: 'Xe.upf',
  Y: 'Y.upf',
  Zn: 'Zn_ONCV_PBE_FR-1.0.upf',
  Zr: 'Zr_ONCV_PBE-1.0.upf',
};

const APNS_ORBITALS_EFFICIENCY_V1: Record<string, string> = {
  Ag: 'Ag_gga_7au_100Ry_4s2p2d1f.orb',
  Al: 'Al_gga_8au_100Ry_2s2p1d.orb',
  Ar: 'Ar_gga_8au_100Ry_2s2p1d.orb',
  As: 'As_gga_8au_100Ry_2s2p1d.orb',
  Au: 'Au_gga_9au_100Ry_4s2p2d1f.orb',
  B: 'B_gga_6au_100Ry_2s2p1d.orb',
  Ba: 'Ba_gga_9au_100Ry_4s2p2d1f.orb',
  Be: 'Be_gga_8au_100Ry_4s1p.orb',
  Bi: 'Bi_gga_10au_100Ry_2s2p2d1f.orb',
  Br: 'Br_gga_10au_100Ry_2s2p1d.orb',
  C: 'C_gga_8au_100Ry_2s2p1d.orb',
  Ca: 'Ca_gga_10au_100Ry_4s2p1d.orb',
  Cd: 'Cd_gga_10au_100Ry_4s2p2d1f.orb',
  Cl: 'Cl_gga_6au_100Ry_2s2p1d.orb',
  Co: 'Co_gga_6au_100Ry_4s2p2d1f.orb',
  Cr: 'Cr_gga_6au_100Ry_4s2p2d1f.orb',
  Cs: 'Cs_gga_10au_100Ry_4s2p1d.orb',
  Cu: 'Cu_gga_9au_150Ry_4s2p2d1f.orb',
  F: 'F_gga_8au_100Ry_2s2p1d.orb',
  Fe: 'Fe_gga_7au_100Ry_4s2p2d1f.orb',
  Ga: 'Ga_gga_7au_100Ry_2s2p2d1f.orb',
  Ge: 'Ge_gga_7au_100Ry_2s2p2d1f.orb',
  H: 'H_gga_6au_100Ry_2s1p.orb',
  He: 'He_gga_10au_100Ry_2s1p.orb',
  Hf: 'Hf_gga_9au_100Ry_4s2p2d1f.orb',
  Hg: 'Hg_gga_6au_100Ry_2s2p2d1f.orb',
  I: 'I_gga_9au_100Ry_2s2p1d.orb',
  In: 'In_gga_8au_100Ry_2s2p2d1f.orb',
  Ir: 'Ir_gga_7au_100Ry_4s2p2d1f.orb',
  K: 'K_gga_10au_100Ry_4s2p1d.orb',
  Kr: 'Kr_gga_8au_100Ry_2s2p1d.orb',
  La: 'La_gga_9au_100Ry_4s2p2d1f.orb',
  Li: 'Li_gga_9au_100Ry_4s1p.orb',
  Mg: 'Mg_gga_9au_100Ry_2s1p.orb',
  Mn: 'Mn_gga_6au_100Ry_4s2p2d1f.orb',
  Mo: 'Mo_gga_7au_100Ry_4s2p2d1f.orb',
  N: 'N_gga_8au_100Ry_2s2p1d.orb',
  Na: 'Na_gga_10au_100Ry_4s2p1d.orb',
  Nb: 'Nb_gga_8au_100Ry_4s2p2d1f.orb',
  Ne: 'Ne_gga_6au_100Ry_2s2p1d.orb',
  Ni: 'Ni_gga_7au_100Ry_4s2p2d1f.orb',
  O: 'O_gga_6au_100Ry_2s2p1d.orb',
  Os: 'Os_gga_7au_100Ry_4s2p2d1f.orb',
  P: 'P_gga_10au_100Ry_2s2p1d.orb',
  Pb: 'Pb_gga_10au_100Ry_2s2p2d1f.orb',
  Pd: 'Pd_gga_7au_100Ry_4s2p2d1f.orb',
  Pt: 'Pt_gga_8au_100Ry_4s2p2d1f.orb',
  Rb: 'Rb_gga_9au_100Ry_4s2p1d.orb',
  Re: 'Re_gga_7au_150Ry_4s2p2d1f.orb',
  Rh: 'Rh_gga_10au_100Ry_4s2p2d1f.orb',
  Ru: 'Ru_gga_7au_100Ry_4s2p2d1f.orb',
  S: 'S_gga_6au_100Ry_2s2p1d.orb',
  Sb: 'Sb_gga_10au_100Ry_2s2p2d1f.orb',
  Sc: 'Sc_gga_8au_100Ry_4s2p2d1f.orb',
  Se: 'Se_gga_8au_100Ry_2s2p1d.orb',
  Si: 'Si_gga_7au_100Ry_2s2p1d.orb',
  Sn: 'Sn_gga_10au_100Ry_2s2p2d1f.orb',
  Sr: 'Sr_gga_10au_100Ry_4s2p1d.orb',
  Ta: 'Ta_gga_9au_100Ry_4s2p2d1f.orb',
  Tc: 'Tc_gga_7au_100Ry_4s2p2d1f.orb',
  Te: 'Te_gga_7au_100Ry_2s2p1d.orb',
  Ti: 'Ti_gga_7au_100Ry_4s2p2d1f.orb',
  Tl: 'Tl_gga_8au_100Ry_2s2p2d1f.orb',
  V: 'V_gga_7au_100Ry_4s2p2d1f.orb',
  W: 'W_gga_8au_100Ry_4s2p2d2f1g.orb',
  Xe: 'Xe_gga_9au_100Ry_2s2p1d.orb',
  Y: 'Y_gga_10au_100Ry_4s2p2d1f.orb',
  Zn: 'Zn_gga_9au_150Ry_4s2p2d1f.orb',
  Zr: 'Zr_gga_10au_100Ry_4s2p2d1f.orb',
};

const APNS_ORBITALS_PRECISION_V1: Record<string, string> = {
  Ag: 'Ag_gga_10au_100Ry_6s3p3d2f.orb',
  Al: 'Al_gga_10au_100Ry_3s3p2d.orb',
  Ar: 'Ar_gga_10au_100Ry_3s3p2d.orb',
  As: 'As_gga_10au_100Ry_3s3p2d.orb',
  Au: 'Au_gga_10au_100Ry_6s3p3d2f.orb',
  B: 'B_gga_10au_100Ry_3s3p2d1f.orb',
  Ba: 'Ba_gga_10au_100Ry_6s3p3d2f.orb',
  Be: 'Be_gga_10au_100Ry_4s2p1d.orb',
  Bi: 'Bi_gga_10au_100Ry_3s3p3d2f.orb',
  Br: 'Br_gga_10au_100Ry_3s3p2d1f.orb',
  C: 'C_gga_10au_100Ry_3s3p2d.orb',
  Ca: 'Ca_gga_10au_100Ry_6s3p2d.orb',
  Cd: 'Cd_gga_10au_100Ry_6s3p3d2f.orb',
  Cl: 'Cl_gga_10au_100Ry_3s3p2d.orb',
  Co: 'Co_gga_10au_100Ry_6s3p3d2f.orb',
  Cr: 'Cr_gga_10au_100Ry_6s3p3d2f.orb',
  Cs: 'Cs_gga_10au_100Ry_3s2p1d.orb',
  Cu: 'Cu_gga_10au_150Ry_6s3p3d2f.orb',
  F: 'F_gga_10au_100Ry_3s3p2d.orb',
  Fe: 'Fe_gga_10au_100Ry_6s3p3d2f.orb',
  Ga: 'Ga_gga_10au_100Ry_3s3p3d2f.orb',
  Ge: 'Ge_gga_10au_100Ry_3s3p3d2f.orb',
  H: 'H_gga_10au_100Ry_3s2p.orb',
  He: 'He_gga_10au_100Ry_3s2p.orb',
  Hf: 'Hf_gga_10au_100Ry_6s3p3d2f.orb',
  Hg: 'Hg_gga_10au_100Ry_3s2p3d.orb',
  I: 'I_gga_10au_100Ry_3s3p2d1f.orb',
  In: 'In_gga_10au_100Ry_3s3p3d2f.orb',
  Ir: 'Ir_gga_10au_100Ry_6s3p3d2f.orb',
  K: 'K_gga_10au_100Ry_3s2p1d.orb',
  Kr: 'Kr_gga_10au_100Ry_3s3p2d.orb',
  La: 'La_gga_10au_100Ry_6s3p3d2f.orb',
  Li: 'Li_gga_10au_100Ry_6s2p.orb',
  Mg: 'Mg_gga_10au_100Ry_3s2p1d.orb',
  Mn: 'Mn_gga_10au_100Ry_6s3p3d2f.orb',
  Mo: 'Mo_gga_10au_100Ry_6s3p3d2f.orb',
  N: 'N_gga_10au_100Ry_3s3p2d.orb',
  Na: 'Na_gga_10au_100Ry_3s2p1d.orb',
  Nb: 'Nb_gga_10au_100Ry_6s3p3d2f.orb',
  Ne: 'Ne_gga_10au_100Ry_3s3p2d.orb',
  Ni: 'Ni_gga_10au_100Ry_6s3p3d2f.orb',
  O: 'O_gga_10au_100Ry_3s3p2d1f.orb',
  Os: 'Os_gga_10au_100Ry_6s3p3d2f.orb',
  P: 'P_gga_10au_100Ry_3s3p2d1f.orb',
  Pb: 'Pb_gga_10au_100Ry_3s3p3d2f.orb',
  Pd: 'Pd_gga_10au_100Ry_6s3p3d2f.orb',
  Pt: 'Pt_gga_10au_100Ry_6s3p3d2f.orb',
  Rb: 'Rb_gga_10au_100Ry_3s2p1d.orb',
  Re: 'Re_gga_10au_150Ry_6s3p3d2f.orb',
  Rh: 'Rh_gga_10au_100Ry_6s3p3d2f.orb',
  Ru: 'Ru_gga_10au_100Ry_6s3p3d2f.orb',
  S: 'S_gga_10au_100Ry_3s3p2d1f.orb',
  Sb: 'Sb_gga_10au_100Ry_3s3p3d2f.orb',
  Sc: 'Sc_gga_10au_100Ry_6s3p3d2f.orb',
  Se: 'Se_gga_10au_100Ry_3s3p2d1f.orb',
  Si: 'Si_gga_10au_100Ry_3s3p2d.orb',
  Sn: 'Sn_gga_10au_100Ry_3s3p3d2f.orb',
  Sr: 'Sr_gga_10au_100Ry_6s3p2d.orb',
  Ta: 'Ta_gga_10au_100Ry_6s3p3d2f.orb',
  Tc: 'Tc_gga_10au_100Ry_6s3p3d2f.orb',
  Te: 'Te_gga_10au_100Ry_3s3p2d1f.orb',
  Ti: 'Ti_gga_10au_100Ry_6s3p3d2f.orb',
  Tl: 'Tl_gga_10au_100Ry_3s3p3d2f.orb',
  V: 'V_gga_10au_100Ry_6s3p3d2f.orb',
  W: 'W_gga_10au_100Ry_6s3p3d3f2g.orb',
  Xe: 'Xe_gga_10au_100Ry_3s3p2d.orb',
  Y: 'Y_gga_10au_100Ry_6s3p3d2f.orb',
  Zn: 'Zn_gga_10au_150Ry_6s3p3d2f.orb',
  Zr: 'Zr_gga_10au_100Ry_6s3p3d2f.orb',
};

const APNS_ORBITALS_V1: Record<AbacusOrbitalLibrary, Record<string, string>> = {
  efficiency: APNS_ORBITALS_EFFICIENCY_V1,
  precision: APNS_ORBITALS_PRECISION_V1,
};

/**
 * ABACUS STRU file parser (basic support)
 */
export class STRUParser extends StructureParser {
  parse(content: string): Structure {
    if (!content.trim()) {
      throw new Error('STRUParser: empty input');
    }
    const rawContent = content;
    
    const lines = content.split(/\r?\n/);
    const structure = new Structure('');
    
    structure.metadata.set('struRawContent', rawContent);

    let latticeConstantBohr: number | null = null;
    let latticeVectors: number[][] | null = null;
    const species: StruSpecies[] = [];
    const numericalOrbitals: StruOrbital[] = [];
    const elementMagnetism = new Map<string, string>();
    const elementBlocks = new Map<string, StruElementBlockMetadata>();
    const atomExtras = new Map<string, StruAtomExtras>();

    let i = 0;
    while (i < lines.length) {
      const rawLine = lines[i];
      const line = this.cleanLine(rawLine);
      if (!line) {
        i++;
        continue;
      }

      const upper = line.toUpperCase();
      if (upper === 'ATOMIC_SPECIES') {
        i++;
        const parsed = this.parseAtomicSpecies(lines, i);
        species.push(...parsed.species);
        i = parsed.nextIndex;
        continue;
      }

      if (upper === 'NUMERICAL_ORBITAL') {
        i++;
        const parsed = this.parseNumericalOrbitals(lines, i, species);
        numericalOrbitals.push(...parsed.orbitals);
        i = parsed.nextIndex;
        continue;
      }

      if (upper === 'LATTICE_CONSTANT') {
        i++;
        while (i < lines.length && !this.cleanLine(lines[i])) {i++;}
        if (i >= lines.length || this.isSectionHeader(this.cleanLine(lines[i]))) {
          throw new Error(`STRUParser line ${i + 1}: missing LATTICE_CONSTANT value`);
        }
        const value = this.parseStrictFloat(this.cleanLine(lines[i]), 'LATTICE_CONSTANT', i + 1);
        latticeConstantBohr = value;
        i++;
        continue;
      }

      if (upper === 'LATTICE_VECTORS') {
        const vectors: number[][] = [];
        i++;
        while (i < lines.length && vectors.length < 3) {
          const vecLine = this.cleanLine(lines[i]);
          if (!vecLine) {
            i++;
            continue;
          }
          const parts = vecLine.split(/\s+/).slice(0, 3);
          if (parts.length === 3) {
            const nums = parts.map((value) => this.parseStrictFloat(value, 'LATTICE_VECTORS', i + 1));
            vectors.push(nums as [number, number, number]);
          } else {
            throw new Error(`STRUParser line ${i + 1}: expected 3 LATTICE_VECTORS values`);
          }
          i++;
        }
        if (vectors.length === 3) {
          latticeVectors = vectors;
        } else {
          throw new Error(`STRUParser line ${i + 1}: LATTICE_VECTORS requires 3 rows`);
        }
        continue;
      }

      if (upper === 'LATTICE_PARAMETERS') {
        i++;
        while (i < lines.length && !this.cleanLine(lines[i])) {i++;}
        if (i >= lines.length || this.isSectionHeader(this.cleanLine(lines[i]))) {
          throw new Error(`STRUParser line ${i + 1}: missing LATTICE_PARAMETERS value`);
        }
        const params = this.cleanLine(lines[i])
          .split(/\s+/)
          .map((value) => this.parseStrictFloat(value, 'LATTICE_PARAMETERS', i + 1));
        structure.metadata.set('struLatticeParameters', params);
        i++;
        continue;
      }

      if (upper === 'ATOMIC_POSITIONS') {
        i++;
        while (i < lines.length && !this.cleanLine(lines[i])) {i++;}
        if (i >= lines.length) {
          break;
        }
        const coordType = this.cleanLine(lines[i]);
        
        // Save ATOMIC_POSITIONS header for format preservation
        structure.metadata.set('struAtomicPositionsHeader', 'ATOMIC_POSITIONS');
        structure.metadata.set('struCoordType', coordType);
        
        i++;

        const coordMode = this.normalizeCoordMode(coordType, i);
        const hasLattice = latticeVectors && latticeConstantBohr !== null;
        let latticeVectorsAng: number[][] | null = null;
        if (hasLattice && latticeVectors && latticeConstantBohr !== null) {
          const latticeConst = latticeConstantBohr;
          latticeVectorsAng = latticeVectors.map((vec) =>
            vec.map((value) => value * latticeConst * BOHR_TO_ANGSTROM)
          );
          structure.isCrystal = true;
          structure.unitCell = UnitCell.fromVectors(latticeVectorsAng);
        }

        while (i < lines.length) {
          const rawElementLine = lines[i];
          const elementLine = this.cleanLine(rawElementLine);
          if (!elementLine) {
            i++;
            continue;
          }
          if (this.isSectionHeader(elementLine)) {
            break;
          }

          const element = parseElement(elementLine.split(/\s+/)[0]);
          i++;
          if (!element || i >= lines.length) {
            throw new Error(`STRUParser line ${i}: invalid element "${elementLine}"`);
          }

          const magnetismRawLine = lines[i];
          const magnetismLine = this.cleanLine(magnetismRawLine);
          elementMagnetism.set(element, magnetismLine);
          i++;
          if (i >= lines.length) {
            throw new Error(`STRUParser line ${i}: missing atom count for ${element}`);
          }

          const countSplit = this.splitComment(lines[i]);
          const countLine = countSplit.content.trim();
          const count = this.parseStrictInteger(countLine, 'atom count', i + 1);
          elementBlocks.set(element, {
            elementLine: rawElementLine,
            magnetismLine: magnetismRawLine,
            countCommentSuffix: countSplit.commentSuffix,
          });
          i++;
          if (count < 0) {
            throw new Error(`STRUParser line ${i}: atom count must be non-negative for ${element}`);
          }

          let atomsRead = 0;
          for (; atomsRead < count && i < lines.length; atomsRead++, i++) {
            const splitPositionLine = this.splitComment(lines[i]);
            const posLine = splitPositionLine.content.trim();
            if (!posLine) {
              atomsRead--;
              continue;
            }
            const parts = posLine.split(/\s+/);
            if (parts.length < 3) {
              throw new Error(`STRUParser line ${i + 1}: expected atom coordinates`);
            }
            let x = this.parseStrictFloat(parts[0], 'atom coordinate', i + 1);
            let y = this.parseStrictFloat(parts[1], 'atom coordinate', i + 1);
            let z = this.parseStrictFloat(parts[2], 'atom coordinate', i + 1);

            let fixed = false;
            let selectiveDynamics: [boolean, boolean, boolean] | undefined;
            const extras = this.parseAtomExtras(parts.slice(3), i + 1, splitPositionLine.commentSuffix);
            if (extras.moveFlags) {
              selectiveDynamics = [
                extras.moveFlags[0] === 1,
                extras.moveFlags[1] === 1,
                extras.moveFlags[2] === 1,
              ];
              fixed = extras.moveFlags.every((flag) => flag === 0);
            }

            if (coordMode.startsWith('direct')) {
              if (latticeVectorsAng) {
                const cart = fractionalToCartesian(x, y, z, latticeVectorsAng);
                x = cart[0];
                y = cart[1];
                z = cart[2];
              } else {
                structure.metadata.set('struRequiresInputLatname', true);
              }
            } else if (coordMode.startsWith('cartesian_au')) {
              x *= BOHR_TO_ANGSTROM;
              y *= BOHR_TO_ANGSTROM;
              z *= BOHR_TO_ANGSTROM;
            } else if (coordMode.startsWith('cartesian_angstrom')) {
              const center = this.getCenterOffset(coordMode, latticeVectorsAng);
              if (center) {
                x += center[0];
                y += center[1];
                z += center[2];
              }
            } else if (coordMode.startsWith('cartesian')) {
              const scale = latticeConstantBohr ? latticeConstantBohr * BOHR_TO_ANGSTROM : 1;
              x *= scale;
              y *= scale;
              z *= scale;
            }

            const atom = new Atom(element, x, y, z, undefined, {
              color: BRIGHT_SCHEME.colors[element] || '#C0C0C0',
              radius: getDefaultAtomRadius(element),
            });
            atom.fixed = fixed;
            atom.selectiveDynamics = selectiveDynamics;
            structure.addAtom(atom);
            atomExtras.set(atom.id, extras);
          }

          if (atomsRead < count) {
            throw new Error(`STRUParser line ${i + 1}: expected ${count} atoms for ${element}`);
          }
        }
        continue;
      }

      i++;
    }

    if (structure.atoms.length === 0) {
      throw new Error('STRUParser: no atomic positions found');
    }

    if (species.length > 0) {
      structure.metadata.set('struAtomicSpecies', species);
    }
    if (numericalOrbitals.length > 0) {
      structure.metadata.set('struNumericalOrbitals', numericalOrbitals);
    }
    if (elementMagnetism.size > 0) {
      structure.metadata.set('struElementMagnetism', elementMagnetism);
    }
    if (elementBlocks.size > 0) {
      structure.metadata.set('struElementBlocks', elementBlocks);
    }
    if (atomExtras.size > 0) {
      structure.metadata.set('struAtomExtras', atomExtras);
    }
    const latticeMetadata: StruLatticeMetadata = {};
    if (latticeConstantBohr !== null) {
      latticeMetadata.latticeConstantBohr = latticeConstantBohr;
    }
    if (latticeVectors) {
      latticeMetadata.latticeVectors = latticeVectors;
    }
    const latticeParameters = structure.metadata.get('struLatticeParameters') as number[] | undefined;
    if (latticeParameters) {
      latticeMetadata.latticeParameters = latticeParameters;
    }
    if (structure.metadata.get('struRequiresInputLatname') === true) {
      latticeMetadata.requiresInputLatname = true;
    }
    structure.metadata.set('struLattice', latticeMetadata);

    return structure;
  }

  serialize(structure: Structure): string {
    // Strategy 1: Use saved raw content and replace only coordinate section
    const savedRawContent = structure.metadata.get('struRawContent') as string | undefined;
    if (!savedRawContent) {
      // Fallback to default generation if no raw content saved
      return this.generateDefaultSTRU(structure);
    }
    
    // Keep file-level data stable, but synchronize species/orbital rows with
    // element additions/removals before replacing coordinates.
    const syncedContent = this.syncCompositionSections(savedRawContent, structure);
    return this.replaceAtomicPositions(syncedContent, structure);
  }

  private generateDefaultSTRU(structure: Structure): string {
    const lines: string[] = [];
    const elements = this.collectElementGroups(structure);

    lines.push('ATOMIC_SPECIES');
    for (const [element] of elements) {
      const mass = this.getAtomicMass(element);
      const pseudopotential = this.getDefaultPseudopotential(element);
      lines.push(`${element}  ${mass.toFixed(3)}  ${pseudopotential}`);
    }
    lines.push('');

    lines.push('NUMERICAL_ORBITAL');
    for (const [element] of elements) {
      const orbital = this.getDefaultNumericalOrbital(element);
      lines.push(orbital);
    }
    lines.push('');

    lines.push('LATTICE_CONSTANT');
    const latticeConstantBohr = ANGSTROM_TO_BOHR;
    lines.push(latticeConstantBohr.toFixed(6));
    lines.push('');

    if (structure.unitCell) {
      lines.push('LATTICE_VECTORS');
      const vectors = structure.unitCell.getLatticeVectors();
      for (const vec of vectors) {
        lines.push(formatCoordinateTriplet(vec, 12));
      }
      lines.push('');
    }

    lines.push('ATOMIC_POSITIONS');
    if (structure.unitCell) {
      lines.push('Direct');
    } else {
      lines.push('Cartesian_angstrom');
    }

    const hasMovementConstraints = this.hasMovementConstraints(structure);
    for (const [element, atoms] of elements) {
      lines.push('');
      lines.push(element);
      lines.push('0.0');
      lines.push(String(atoms.length));

      for (const atom of atoms) {
        let x = atom.x;
        let y = atom.y;
        let z = atom.z;
        if (structure.unitCell) {
          const frac = structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
          x = frac[0];
          y = frac[1];
          z = frac[2];
        }
        const flag = hasMovementConstraints ? this.formatMovementFlags(atom) : null;
        const extras = flag ? `  ${flag}` : '';
        lines.push(`${formatCoordinateTriplet([x, y, z], 12)}${extras}`);
      }
    }

    return lines.join('\n');
  }

  private syncCompositionSections(rawContent: string, structure: Structure): string {
    const withSpecies = this.syncAtomicSpeciesSection(rawContent, structure);
    return this.syncNumericalOrbitalSection(withSpecies, structure);
  }

  private syncAtomicSpeciesSection(rawContent: string, structure: Structure): string {
    const elements = this.collectElementGroups(structure).map(([element]) => element);
    const speciesByElement = this.getSpeciesByElement(structure);
    const rows = elements.map((element) => {
      const existing = speciesByElement.get(element);
      return existing?.rawLine ?? this.formatDefaultSpeciesRow(element);
    });

    const lines = rawContent.split(/\r?\n/);
    const section = this.findSection(lines, 'ATOMIC_SPECIES');
    if (!section) {
      return this.insertSectionBefore(lines, ['NUMERICAL_ORBITAL', 'LATTICE_CONSTANT', 'LATTICE_VECTORS', 'ATOMIC_POSITIONS'], [
        'ATOMIC_SPECIES',
        ...rows,
        '',
      ]);
    }

    const replacement = [lines[section.start]];
    const countInfo = this.getOptionalCountLine(lines, section.start + 1, section.end);
    if (countInfo) {
      replacement.push(`${elements.length}${countInfo.commentSuffix}`);
    }
    replacement.push(...rows);
    replacement.push('');
    return this.replaceLineRange(lines, section.start, section.end, replacement);
  }

  private syncNumericalOrbitalSection(rawContent: string, structure: Structure): string {
    const elements = this.collectElementGroups(structure).map(([element]) => element);
    const orbitalsByElement = this.getOrbitalsByElement(structure);
    const rows = elements.map((element) => {
      const existing = orbitalsByElement.get(element);
      return existing?.rawLine ?? this.getDefaultNumericalOrbital(element);
    });

    const lines = rawContent.split(/\r?\n/);
    const section = this.findSection(lines, 'NUMERICAL_ORBITAL');
    if (!section) {
      return this.insertSectionBefore(lines, ['LATTICE_CONSTANT', 'LATTICE_VECTORS', 'ATOMIC_POSITIONS'], [
        'NUMERICAL_ORBITAL',
        ...rows,
        '',
      ]);
    }

    const replacement = [lines[section.start], ...rows, ''];
    return this.replaceLineRange(lines, section.start, section.end, replacement);
  }

  private replaceAtomicPositions(rawContent: string, structure: Structure): string {
    const lines = rawContent.split(/\r?\n/);
    const resultLines: string[] = [];
    
    // Find ATOMIC_POSITIONS section and rebuild it
    let i = 0;
    let atomsWritten = false;
    
    while (i < lines.length) {
      const rawLine = lines[i];
      const line = this.cleanLine(rawLine);
      const upper = line.toUpperCase();
      
      if (upper === 'ATOMIC_POSITIONS') {
        // Copy ATOMIC_POSITIONS header and coord type
        resultLines.push(rawLine);
        i++;
        
        let coordType = structure.unitCell ? 'Direct' : 'Cartesian_angstrom';

        // Copy coord type line
        if (i < lines.length) {
          const coordLine = this.cleanLine(lines[i]);
          if (coordLine && !this.isSectionHeader(coordLine)) {
            coordType = coordLine;
            resultLines.push(lines[i]);
            i++;
          }
        }
        
        // Skip element blocks until we find next section or EOF
        while (i < lines.length) {
          const checkLine = this.cleanLine(lines[i]);
          if (!checkLine) {
            i++;
            continue;
          }
          if (this.isSectionHeader(checkLine)) {
            break;
          }
          i++;
        }
        
        // Write new atomic positions
        this.writeAtomicPositions(resultLines, structure, coordType);
        atomsWritten = true;
        continue;
      }
      
      resultLines.push(rawLine);
      i++;
    }
    
    // If ATOMIC_POSITIONS section was not found, append it
    if (!atomsWritten) {
      resultLines.push('');
      resultLines.push('ATOMIC_POSITIONS');
      const coordType = structure.unitCell ? 'Direct' : 'Cartesian_angstrom';
      resultLines.push(coordType);
      this.writeAtomicPositions(resultLines, structure, coordType);
    }
    
    return resultLines.join('\n');
  }

  private writeAtomicPositions(lines: string[], structure: Structure, coordType: string): void {
    const elements = this.collectElementGroups(structure);
    const elementMagnetism = structure.metadata.get('struElementMagnetism') as Map<string, string> | undefined;
    const elementBlocks = structure.metadata.get('struElementBlocks') as Map<string, StruElementBlockMetadata> | undefined;
    const atomExtras = structure.metadata.get('struAtomExtras') as Map<string, StruAtomExtras> | undefined;
    const hasMovementConstraints = this.hasMovementConstraints(structure);
    
    for (const [element, atoms] of elements) {
      const elementBlock = elementBlocks?.get(element);
      lines.push('');
      lines.push(elementBlock?.elementLine ?? element);
      lines.push(elementBlock?.magnetismLine ?? elementMagnetism?.get(element) ?? '0.0');
      lines.push(`${atoms.length}${elementBlock?.countCommentSuffix ?? ''}`);

      for (const atom of atoms) {
        const [x, y, z] = this.getOutputCoordinates(atom, structure, coordType);
        const flag = hasMovementConstraints ? this.formatMovementFlags(atom) : null;
        const extras = this.formatAtomExtras(atomExtras?.get(atom.id), flag);
        lines.push(`${formatCoordinateTriplet([x, y, z], 12)}${extras}`);
      }
    }
  }

  private parseAtomicSpecies(lines: string[], startIndex: number): {
    species: StruSpecies[];
    nextIndex: number;
  } {
    const species: StruSpecies[] = [];
    let i = startIndex;
    let skippedCount = false;

    while (i < lines.length) {
      const line = this.cleanLine(lines[i]);
      if (!line) {
        i++;
        continue;
      }
      if (this.isSectionHeader(line)) {
        break;
      }
      if (!skippedCount && /^\d+$/.test(line)) {
        skippedCount = true;
        i++;
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        throw new Error(`STRUParser line ${i + 1}: invalid ATOMIC_SPECIES row "${lines[i]}"`);
      }
      const mass = this.parseStrictFloat(parts[1], 'atomic mass', i + 1);
      species.push({
        label: parts[0],
        mass,
        pseudoFile: parts[2],
        pseudoType: parts[3],
        rawLine: lines[i],
      });
      i++;
    }

    return { species, nextIndex: i };
  }

  private getSpeciesByElement(structure: Structure): Map<string, StruSpecies> {
    const species = structure.metadata.get('struAtomicSpecies') as StruSpecies[] | undefined;
    const result = new Map<string, StruSpecies>();
    for (const item of species ?? []) {
      const element = parseElement(item.label);
      if (element && !result.has(element)) {
        result.set(element, item);
      }
    }
    return result;
  }

  private getOrbitalsByElement(structure: Structure): Map<string, StruOrbital> {
    const orbitals = structure.metadata.get('struNumericalOrbitals') as StruOrbital[] | undefined;
    const result = new Map<string, StruOrbital>();
    for (const item of orbitals ?? []) {
      const element = item.element ? parseElement(item.element) : this.inferElementFromFileName(item.orbitalFile);
      if (element && !result.has(element)) {
        result.set(element, item);
      }
    }
    return result;
  }

  private inferElementFromFileName(fileName: string): string | undefined {
    const baseName = fileName.split(/[\\/]/).pop() ?? fileName;
    const match = /^([A-Z][a-z]?)(?:_|\.|-|$)/.exec(baseName);
    return match ? parseElement(match[1]) : undefined;
  }

  private formatDefaultSpeciesRow(element: string): string {
    const mass = this.getAtomicMass(element);
    const pseudopotential = this.getDefaultPseudopotential(element);
    return `${element}  ${mass.toFixed(3)}  ${pseudopotential}`;
  }

  private findSection(lines: string[], header: string): { start: number; end: number } | null {
    const target = header.toUpperCase();
    const start = lines.findIndex((line) => this.cleanLine(line).toUpperCase() === target);
    if (start < 0) {
      return null;
    }
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const line = this.cleanLine(lines[i]);
      if (line && this.isSectionHeader(line)) {
        end = i;
        break;
      }
    }
    return { start, end };
  }

  private replaceLineRange(lines: string[], start: number, end: number, replacement: string[]): string {
    const next = [...lines.slice(0, start), ...replacement, ...lines.slice(end)];
    return next.join('\n');
  }

  private insertSectionBefore(lines: string[], beforeHeaders: string[], sectionLines: string[]): string {
    const upperHeaders = new Set(beforeHeaders.map((header) => header.toUpperCase()));
    const insertIndex = lines.findIndex((line) => {
      const cleaned = this.cleanLine(line).toUpperCase();
      return upperHeaders.has(cleaned);
    });
    if (insertIndex < 0) {
      return [...sectionLines, ...lines].join('\n');
    }
    return [...lines.slice(0, insertIndex), ...sectionLines, ...lines.slice(insertIndex)].join('\n');
  }

  private getOptionalCountLine(lines: string[], startIndex: number, endIndex: number): {
    commentSuffix: string;
  } | null {
    for (let i = startIndex; i < endIndex; i++) {
      const line = this.cleanLine(lines[i]);
      if (!line) {
        continue;
      }
      if (/^\d+$/.test(line)) {
        return { commentSuffix: this.splitComment(lines[i]).commentSuffix };
      }
      return null;
    }
    return null;
  }

  private parseNumericalOrbitals(lines: string[], startIndex: number, species: StruSpecies[]): {
    orbitals: StruOrbital[];
    nextIndex: number;
  } {
    const orbitals: StruOrbital[] = [];
    let i = startIndex;
    let orbitalIndex = 0;

    while (i < lines.length) {
      const line = this.cleanLine(lines[i]);
      if (!line) {
        i++;
        continue;
      }
      if (this.isSectionHeader(line)) {
        break;
      }
      orbitals.push({
        element: species[orbitalIndex]?.label,
        orbitalFile: line.split(/\s+/)[0],
        rawLine: lines[i],
      });
      orbitalIndex++;
      i++;
    }

    return { orbitals, nextIndex: i };
  }

  private parseAtomExtras(parts: string[], lineNumber: number, commentSuffix: string): StruAtomExtras {
    const extras: StruAtomExtras = {
      originalTokens: [...parts],
      commentSuffix,
    };
    let i = 0;

    if (parts.length >= 3 && this.areMoveFlags(parts.slice(0, 3))) {
      extras.moveFlags = this.parseMoveFlagTuple(parts.slice(0, 3), lineNumber);
      extras.movementStyle = 'bare';
      extras.movementStart = 0;
      i = 3;
    }

    while (i < parts.length) {
      const keyword = parts[i].toLowerCase();
      if (keyword === 'm') {
        this.assertKeywordUnused(extras.moveFlags, 'm', lineNumber);
        extras.moveFlags = this.parseMoveFlagTuple(parts.slice(i + 1, i + 4), lineNumber);
        extras.movementStyle = 'm';
        extras.movementStart = i;
        i += 4;
        continue;
      }
      if (keyword === 'v' || keyword === 'vel' || keyword === 'velocity') {
        this.assertKeywordUnused(extras.velocity, keyword, lineNumber);
        extras.velocity = this.parseNumberTuple(parts.slice(i + 1, i + 4), 3, keyword, lineNumber) as [number, number, number];
        extras.velocityKeyword = keyword;
        i += 4;
        continue;
      }
      if (keyword === 'mag' || keyword === 'magmom') {
        this.assertKeywordUnused(extras.mag, keyword, lineNumber);
        const values = this.readKeywordNumbers(parts, i + 1, keyword, lineNumber);
        if (values.values.length !== 1 && values.values.length !== 3) {
          throw new Error(`STRUParser line ${lineNumber}: ${keyword} requires 1 or 3 values`);
        }
        extras.mag = values.values;
        extras.magKeyword = keyword;
        i = values.nextIndex;
        continue;
      }
      if (keyword === 'angle1') {
        this.assertKeywordUnused(extras.angle1, keyword, lineNumber);
        extras.angle1 = this.parseSingleNumber(parts[i + 1], keyword, lineNumber);
        i += 2;
        continue;
      }
      if (keyword === 'angle2') {
        this.assertKeywordUnused(extras.angle2, keyword, lineNumber);
        extras.angle2 = this.parseSingleNumber(parts[i + 1], keyword, lineNumber);
        i += 2;
        continue;
      }
      if (keyword === 'lambda' || keyword === 'sc') {
        const values = this.readKeywordNumbers(parts, i + 1, keyword, lineNumber);
        if (values.values.length !== 1 && values.values.length !== 3) {
          throw new Error(`STRUParser line ${lineNumber}: ${keyword} requires 1 or 3 values`);
        }
        if (keyword === 'lambda') {
          this.assertKeywordUnused(extras.lambda, keyword, lineNumber);
          extras.lambda = values.values;
        } else {
          this.assertKeywordUnused(extras.sc, keyword, lineNumber);
          extras.sc = values.values;
        }
        i = values.nextIndex;
        continue;
      }

      throw new Error(`STRUParser line ${lineNumber}: unsupported atom keyword "${parts[i]}"`);
    }

    return extras;
  }

  private getOutputCoordinates(atom: Atom, structure: Structure, coordType: string): [number, number, number] {
    const coordMode = this.normalizeCoordMode(coordType, 0);
    if (coordMode.startsWith('direct') && structure.unitCell) {
      return structure.unitCell.cartesianToFractional(atom.x, atom.y, atom.z);
    }
    if (coordMode.startsWith('cartesian_au')) {
      return [atom.x / BOHR_TO_ANGSTROM, atom.y / BOHR_TO_ANGSTROM, atom.z / BOHR_TO_ANGSTROM];
    }
    if (coordMode.startsWith('cartesian_angstrom')) {
      const center = this.getCenterOffset(coordMode, this.getLatticeVectorsAngstrom(structure));
      if (center) {
        return [atom.x - center[0], atom.y - center[1], atom.z - center[2]];
      }
      return [atom.x, atom.y, atom.z];
    }
    if (coordMode.startsWith('cartesian')) {
      const lattice = structure.metadata.get('struLattice') as StruLatticeMetadata | undefined;
      const scale = lattice?.latticeConstantBohr ? lattice.latticeConstantBohr * BOHR_TO_ANGSTROM : 1;
      return [atom.x / scale, atom.y / scale, atom.z / scale];
    }
    return [atom.x, atom.y, atom.z];
  }

  private formatAtomExtras(extras: StruAtomExtras | undefined, fallbackFlags: string | null): string {
    if (extras?.originalTokens) {
      const tokens = [...extras.originalTokens];
      const moveFlags = fallbackFlags?.split(/\s+/);
      if (moveFlags) {
        if (extras.movementStyle === 'm' && extras.movementStart !== undefined) {
          tokens.splice(extras.movementStart, 4, 'm', ...moveFlags);
        } else if (extras.movementStyle === 'bare' && extras.movementStart !== undefined) {
          tokens.splice(extras.movementStart, 3, ...moveFlags);
        } else {
          tokens.unshift(...moveFlags);
        }
      } else if (extras.movementStyle === 'm' && extras.movementStart !== undefined) {
        tokens.splice(extras.movementStart, 4);
      } else if (extras.movementStyle === 'bare' && extras.movementStart !== undefined) {
        tokens.splice(extras.movementStart, 3);
      }
      const tokenText = tokens.length > 0 ? `  ${tokens.join(' ')}` : '';
      return `${tokenText}${extras.commentSuffix ?? ''}`;
    }

    const tokens: string[] = [];
    if (fallbackFlags) {
      const moveFlags = fallbackFlags.split(/\s+/);
      if (extras?.movementStyle === 'm') {
        tokens.push('m', ...moveFlags);
      } else {
        tokens.push(...moveFlags);
      }
    }
    if (!extras) {
      return tokens.length > 0 ? `  ${tokens.join(' ')}` : '';
    }
    if (extras.velocity) {
      tokens.push(extras.velocityKeyword ?? 'v', ...extras.velocity.map((value) => this.formatNumber(value)));
    }
    if (extras.mag) {
      tokens.push(extras.magKeyword ?? 'mag', ...extras.mag.map((value) => this.formatNumber(value)));
    }
    if (extras.angle1 !== undefined) {
      tokens.push('angle1', this.formatNumber(extras.angle1));
    }
    if (extras.angle2 !== undefined) {
      tokens.push('angle2', this.formatNumber(extras.angle2));
    }
    if (extras.lambda) {
      tokens.push('lambda', ...extras.lambda.map((value) => this.formatNumber(value)));
    }
    if (extras.sc) {
      tokens.push('sc', ...extras.sc.map((value) => this.formatNumber(value)));
    }
    return `  ${tokens.join(' ')}`;
  }

  private hasMovementConstraints(structure: Structure): boolean {
    return structure.atoms.some((atom) =>
      atom.fixed || this.hasPartialMovementConstraint(atom)
    );
  }

  private formatMovementFlags(atom: Atom): string {
    let selectiveDynamics: [boolean, boolean, boolean];
    if (atom.fixed) {
      selectiveDynamics = [false, false, false];
    } else if (this.hasPartialMovementConstraint(atom)) {
      selectiveDynamics = atom.selectiveDynamics as [boolean, boolean, boolean];
    } else {
      selectiveDynamics = [true, true, true];
    }
    return selectiveDynamics.map((canMove) => canMove ? '1' : '0').join(' ');
  }

  private hasPartialMovementConstraint(atom: Atom): boolean {
    return atom.selectiveDynamics?.some((canMove) => !canMove) === true
      && atom.selectiveDynamics.some((canMove) => canMove);
  }

  private getLatticeVectorsAngstrom(structure: Structure): number[][] | null {
    if (!structure.unitCell) {
      return null;
    }
    return structure.unitCell.getLatticeVectors();
  }

  private readKeywordNumbers(parts: string[], startIndex: number, keyword: string, lineNumber: number): {
    values: number[];
    nextIndex: number;
  } {
    const values: number[] = [];
    let i = startIndex;
    while (i < parts.length && !this.isAtomExtraKeyword(parts[i])) {
      const value = this.parseStrictFloat(parts[i], keyword, lineNumber);
      values.push(value);
      i++;
    }
    if (values.length === 0) {
      throw new Error(`STRUParser line ${lineNumber}: ${keyword} requires values`);
    }
    return { values, nextIndex: i };
  }

  private parseNumberTuple(parts: string[], count: number, keyword: string, lineNumber: number): number[] {
    if (parts.length < count) {
      throw new Error(`STRUParser line ${lineNumber}: ${keyword} requires ${count} values`);
    }
    return parts.slice(0, count).map((value) => this.parseStrictFloat(value, keyword, lineNumber));
  }

  private parseMoveFlagTuple(parts: string[], lineNumber: number): [number, number, number] {
    if (!this.areMoveFlags(parts)) {
      throw new Error(`STRUParser line ${lineNumber}: movement flags must be three 0/1 values`);
    }
    return parts.slice(0, 3).map((value) => parseInt(value, 10)) as [number, number, number];
  }

  private parseSingleNumber(value: string | undefined, keyword: string, lineNumber: number): number {
    if (value === undefined) {
      throw new Error(`STRUParser line ${lineNumber}: ${keyword} requires a value`);
    }
    return this.parseStrictFloat(value, keyword, lineNumber);
  }

  private assertKeywordUnused(value: unknown, keyword: string, lineNumber: number): void {
    if (value !== undefined) {
      throw new Error(`STRUParser line ${lineNumber}: duplicate ${keyword} keyword`);
    }
  }

  private areMoveFlags(parts: string[]): boolean {
    if (parts.length < 3) {
      return false;
    }
    return parts.slice(0, 3).every((value) => value === '0' || value === '1');
  }

  private isAtomExtraKeyword(value: string): boolean {
    return ['m', 'v', 'vel', 'velocity', 'mag', 'magmom', 'angle1', 'angle2', 'lambda', 'sc'].includes(value.toLowerCase());
  }

  private normalizeCoordMode(coordType: string, lineNumber: number): string {
    const mode = coordType.toLowerCase();
    const validModes = [
      'direct',
      'cartesian',
      'cartesian_au',
      'cartesian_angstrom',
      'cartesian_angstrom_center_xy',
      'cartesian_angstrom_center_xz',
      'cartesian_angstrom_center_yz',
      'cartesian_angstrom_center_xyz',
    ];
    if (!validModes.includes(mode)) {
      const linePrefix = lineNumber > 0 ? ` line ${lineNumber}` : '';
      throw new Error(`STRUParser${linePrefix}: unsupported ATOMIC_POSITIONS coordinate type "${coordType}"`);
    }
    return mode;
  }

  private parseStrictFloat(value: string, label: string, lineNumber: number): number {
    const normalized = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
      throw new Error(`STRUParser line ${lineNumber}: invalid ${label} value "${value}"`);
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error(`STRUParser line ${lineNumber}: invalid ${label} value "${value}"`);
    }
    return parsed;
  }

  private parseStrictInteger(value: string, label: string, lineNumber: number): number {
    const normalized = value.trim();
    if (!/^[+-]?\d+$/.test(normalized)) {
      throw new Error(`STRUParser line ${lineNumber}: invalid ${label} value "${value}"`);
    }
    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(`STRUParser line ${lineNumber}: invalid ${label} value "${value}"`);
    }
    return parsed;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? value.toFixed(1) : String(value);
  }

  private cleanLine(line: string): string {
    if (!line) {return '';}
    return this.splitComment(line).content.trim();
  }

  private splitComment(line: string): SplitCommentLine {
    const hashIndex = line.indexOf('#');
    const slashIndex = line.indexOf('//');
    const indexes = [hashIndex, slashIndex].filter((index) => index >= 0);
    if (indexes.length === 0) {
      return { content: line, commentSuffix: '' };
    }
    const commentIndex = Math.min(...indexes);
    const beforeComment = line.slice(0, commentIndex);
    const trailingWhitespace = beforeComment.match(/\s*$/)?.[0] ?? '';
    return {
      content: beforeComment,
      commentSuffix: `${trailingWhitespace}${line.slice(commentIndex)}`,
    };
  }

  private isSectionHeader(value: string): boolean {
    const upper = value.toUpperCase();
    return [
      'ATOMIC_SPECIES',
      'NUMERICAL_ORBITAL',
      'LATTICE_CONSTANT',
      'LATTICE_VECTORS',
      'LATTICE_PARAMETERS',
      'ATOMIC_POSITIONS',
    ].includes(upper);
  }

  private getCenterOffset(mode: string, vectors: number[][] | null): [number, number, number] | null {
    if (!vectors) {return null;}
    if (mode.includes('center_xyz')) {
      return fractionalToCartesian(0.5, 0.5, 0.5, vectors);
    }
    if (mode.includes('center_xy')) {
      return fractionalToCartesian(0.5, 0.5, 0.0, vectors);
    }
    if (mode.includes('center_xz')) {
      return fractionalToCartesian(0.5, 0.0, 0.5, vectors);
    }
    if (mode.includes('center_yz')) {
      return fractionalToCartesian(0.0, 0.5, 0.5, vectors);
    }
    return null;
  }

  private collectElementGroups(structure: Structure): Array<[string, Atom[]]> {
    const groups = new Map<string, Atom[]>();
    for (const atom of structure.atoms) {
      const list = groups.get(atom.element) || [];
      list.push(atom);
      groups.set(atom.element, list);
    }
    return Array.from(groups.entries());
  }

  private getAtomicMass(element: string): number {
    const info: ElementInfo | undefined = ELEMENT_DATA[element];
    return info?.atomicMass ?? 1.0;
  }

  private getDefaultPseudopotential(element: string): string {
    return APNS_PSEUDOPOTENTIALS_V1[element] ?? `${element}.upf`;
  }

  private getDefaultNumericalOrbital(
    element: string,
    library: AbacusOrbitalLibrary = 'efficiency'
  ): string {
    return APNS_ORBITALS_V1[library][element] ?? `${element}.orb`;
  }
}
