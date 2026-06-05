import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { Atom } from '../../../models/atom.js';
import { STRUParser } from '../../../io/parsers/struParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('STRU Parser', () => {
  const parser = new STRUParser();

  const SILICON_STRU = `ATOMIC_SPECIES
2
Si  28.086  Si_ONCV_PBE-1.0.upf
H   1.008   H_ONCV_PBE-1.0.upf

LATTICE_CONSTANT
1.889726

LATTICE_VECTORS
5.431000  0.000000  0.000000
0.000000  5.431000  0.000000
0.000000  0.000000  5.431000

ATOMIC_POSITIONS
Cartesian
Si
0.0
2
0.000000  0.000000  0.000000  1  1  1
1.357750  1.357750  1.357750  1  1  1
H
0.0
2
2.715500  2.715500  0.000000  1  1  1
0.000000  2.715500  2.715500  1  1  1
`;

  it('should parse unit cell from LATTICE_VECTORS', () => {
    const structure = parser.parse(SILICON_STRU);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should parse atoms correctly', () => {
    const structure = parser.parse(SILICON_STRU);
    expect(structure.atoms).to.have.lengthOf(4);
    const elements = structure.atoms.map(a => a.element);
    expect(elements.filter(e => e === 'Si')).to.have.lengthOf(2);
    expect(elements.filter(e => e === 'H')).to.have.lengthOf(2);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(SILICON_STRU);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
    expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });

  describe('fixture file round-trip (water.stru)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.stru'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse unit cell', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o).to.not.be.undefined;
      expect(o.x).to.be.closeTo(0.0, 1e-3);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    });

    it('should preserve original STRU format blocks', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      
      const serLines = serialized.split('\n');
      
      // Should preserve ATOMIC_SPECIES block format
      expect(serLines[0]).to.equal('ATOMIC_SPECIES');
      expect(serLines[1]).to.equal('2');
      expect(serLines[2]).to.contain('O_ONCV_PBE-1.0.upf');
      
      // Should preserve LATTICE_CONSTANT
      const lcIndex = serLines.findIndex(l => l.includes('LATTICE_CONSTANT'));
      expect(lcIndex).to.be.greaterThan(-1);
      expect(serLines[lcIndex + 1]).to.equal('1.889726');
      
      // Should preserve LATTICE_VECTORS
      const lvIndex = serLines.findIndex(l => l.includes('LATTICE_VECTORS'));
      expect(lvIndex).to.be.greaterThan(-1);
      
      // Should preserve coordinate type
      const apIndex = serLines.findIndex(l => l.includes('ATOMIC_POSITIONS'));
      expect(apIndex).to.be.greaterThan(-1);
      expect(serLines[apIndex + 1]).to.equal('Cartesian');
    });
  });
  
  it('should preserve STRU format on round-trip', () => {
    const struWithCustomBlocks = `ATOMIC_SPECIES
2
O  15.9994  O_ONCV_PBE-1.0.upf
H  1.0079   H_ONCV_PBE-1.0.upf

NUMERICAL_ORBITAL
O.orb
H.orb

LATTICE_CONSTANT
1.889726

LATTICE_VECTORS
10.0  0.0  0.0
0.0  10.0  0.0
0.0  0.0  10.0

ATOMIC_POSITIONS
Cartesian
O
0.0
1
0.0  0.0  0.0  1 1 1
H
0.0
2
0.757  0.586  0.0  1 1 1
-0.757  0.586  0.0  1 1 1
`;
    const original = parser.parse(struWithCustomBlocks);
    const serialized = parser.serialize(original);
    
    const serLines = serialized.split('\n');
    
    // Should preserve NUMERICAL_ORBITAL block
    expect(serLines.some(l => l.includes('NUMERICAL_ORBITAL'))).to.be.true;
    expect(serLines.some(l => l.includes('O.orb'))).to.be.true;
    
    // Should preserve LATTICE_CONSTANT value
    expect(serLines.some(l => l.trim() === '1.889726')).to.be.true;
    
    // Should preserve coordinate type
    const apIndex = serLines.findIndex(l => l.includes('ATOMIC_POSITIONS'));
    expect(serLines[apIndex + 1]).to.equal('Cartesian');
  });

  it('should use APNS pseudopotential and efficiency orbital defaults for generated STRU', () => {
    const structure = new Structure('generated-water');
    structure.addAtom(new Atom('O', 0, 0, 0));
    structure.addAtom(new Atom('H', 0.757, 0.586, 0));

    const serialized = parser.serialize(structure);

    expect(serialized).to.include('O  15.999  O.upf');
    expect(serialized).to.include('H  1.008  H.upf');
    expect(serialized).to.include('O_gga_6au_100Ry_2s2p1d.orb');
    expect(serialized).to.include('H_gga_6au_100Ry_2s1p.orb');
  });

  it('should parse // comments and preserve species and orbital metadata', () => {
    const content = `ATOMIC_SPECIES
Si 28.00 pseudos/Si.upf upf201 // label; mass; pseudo_file; pseudo_type

NUMERICAL_ORBITAL
orbitals/Si.orb // orbital path

LATTICE_CONSTANT
1.889726 // bohr

ATOMIC_POSITIONS
Cartesian_angstrom
Si
0.0
1
0.0 0.0 0.0 1 1 1 // atom
`;

    const structure = parser.parse(content);
    const species = structure.metadata.get('struAtomicSpecies') as Array<{
      label: string;
      mass: number;
      pseudoFile?: string;
      pseudoType?: string;
    }>;
    const orbitals = structure.metadata.get('struNumericalOrbitals') as Array<{
      element?: string;
      orbitalFile: string;
      rawLine: string;
    }>;

    expect(structure.atoms).to.have.lengthOf(1);
    expect(species[0]).to.deep.equal({
      label: 'Si',
      mass: 28,
      pseudoFile: 'pseudos/Si.upf',
      pseudoType: 'upf201',
      rawLine: 'Si 28.00 pseudos/Si.upf upf201 // label; mass; pseudo_file; pseudo_type',
    });
    expect(orbitals[0]).to.deep.equal({
      element: 'Si',
      orbitalFile: 'orbitals/Si.orb',
      rawLine: 'orbitals/Si.orb // orbital path',
    });
  });

  it('should parse Cartesian_angstrom_center_xyz positions relative to cell center', () => {
    const content = `LATTICE_CONSTANT
1.889726

LATTICE_VECTORS
10.0 0.0 0.0
0.0 10.0 0.0
0.0 0.0 10.0

ATOMIC_POSITIONS
Cartesian_angstrom_center_xyz
Si
0.0
1
0.0 0.0 0.0 1 1 1
`;

    const structure = parser.parse(content);
    expect(structure.atoms[0].x).to.be.closeTo(5.0, 1e-5);
    expect(structure.atoms[0].y).to.be.closeTo(5.0, 1e-5);
    expect(structure.atoms[0].z).to.be.closeTo(5.0, 1e-5);
  });

  it('should preserve atom movement, velocity, magnetism, and spin constraint extras', () => {
    const content = `ATOMIC_SPECIES
Fe 55.845 Fe_ONCV_PBE-1.2.upf upf201

LATTICE_CONSTANT
1.889726

LATTICE_VECTORS
2.0 0.0 0.0
0.0 2.0 0.0
0.0 0.0 2.0

ATOMIC_POSITIONS
Direct
Fe
1.0 // element magnetism
2 // atom count
0.0 0.0 0.0 m 0 0 0 mag 1 angle1 90 angle2 0 lambda 0.1 0.2 0.3 sc 0.5 // spin setup
0.5 0.5 0.5 1 1 1 velocity 1.0 2.0 3.0 magmom 0.0 0.0 1.0 # velocity setup
`;

    const structure = parser.parse(content);
    const serialized = parser.serialize(structure);
    const reparsed = parser.parse(serialized);

    expect(structure.atoms[0].fixed).to.equal(true);
    expect(structure.atoms[1].fixed).to.equal(false);
    expect(serialized).to.include('1.0 // element magnetism');
    expect(serialized).to.include('2 // atom count');
    expect(serialized).to.include('m 0 0 0 mag 1 angle1 90 angle2 0 lambda 0.1 0.2 0.3 sc 0.5 // spin setup');
    expect(serialized).to.include('1 1 1 velocity 1.0 2.0 3.0 magmom 0.0 0.0 1.0 # velocity setup');
    expect(reparsed.atoms[0].fixed).to.equal(true);
    expect(reparsed.atoms[1].fixed).to.equal(false);
  });

  it('should only update movement flags and keep magnetic extras text unchanged', () => {
    const content = `ATOMIC_POSITIONS
Cartesian_angstrom
Fe
2.5000 // default mag
2
0 0 0 m 1 1 1 mag 1 angle1 90 angle2 0 lambda 0.10 sc 0.5 // first
1 1 1 0 0 0 magmom 0 0 1 velocity 1 2 3 // second
`;

    const structure = parser.parse(content);
    structure.atoms[0].fixed = true;
    structure.atoms[1].fixed = false;

    const serialized = parser.serialize(structure);

    expect(serialized).to.include('2.5000 // default mag');
    expect(serialized).to.include('0.000000000000  0.000000000000  0.000000000000  m 0 0 0 mag 1 angle1 90 angle2 0 lambda 0.10 sc 0.5 // first');
    expect(serialized).to.include('1.000000000000  1.000000000000  1.000000000000  1 1 1 magmom 0 0 1 velocity 1 2 3 // second');
  });

  it('should throw descriptive errors for malformed atom rows', () => {
    const content = `ATOMIC_POSITIONS
Cartesian_angstrom
O
0.0
1
0.0 0.0
`;

    expect(() => parser.parse(content)).to.throw(/STRUParser line 6: expected atom coordinates/);
  });

  it('should reject numeric tokens with trailing text', () => {
    const content = `ATOMIC_POSITIONS
Cartesian_angstrom
O
0.0
1
0.0abc 0.0 0.0 1 1 1
`;

    expect(() => parser.parse(content)).to.throw(/STRUParser line 6: invalid atom coordinate value "0.0abc"/);
  });

  it('should reject missing lattice section values', () => {
    const content = `LATTICE_CONSTANT

ATOMIC_POSITIONS
Cartesian_angstrom
O
0.0
1
0.0 0.0 0.0 1 1 1
`;

    expect(() => parser.parse(content)).to.throw(/missing LATTICE_CONSTANT value/);
  });

  it('should reject unsupported coordinate modes', () => {
    const content = `ATOMIC_POSITIONS
Spherical
O
0.0
1
0.0 0.0 0.0 1 1 1
`;

    expect(() => parser.parse(content)).to.throw(/unsupported ATOMIC_POSITIONS coordinate type "Spherical"/);
  });

  it('should mark Direct coordinates without lattice vectors as requiring INPUT latname context', () => {
    const content = `LATTICE_CONSTANT
10.2

ATOMIC_POSITIONS
Direct
Si
0.0
1
0.25 0.25 0.25 1 1 1
`;

    const structure = parser.parse(content);
    const lattice = structure.metadata.get('struLattice') as { requiresInputLatname?: boolean };

    expect(structure.metadata.get('struRequiresInputLatname')).to.equal(true);
    expect(lattice.requiresInputLatname).to.equal(true);
    expect(structure.unitCell).to.equal(undefined);
    expect(structure.atoms[0].x).to.equal(0.25);
  });

  it('should synchronize pseudo and orbital rows when elements are added or removed', () => {
    const content = `ATOMIC_SPECIES
2 // legacy count
O 15.999 custom/O.UPF upf201 // keep oxygen pseudo
H 1.008 custom/H.UPF upf201 // remove hydrogen pseudo

NUMERICAL_ORBITAL
custom/O.orb // keep oxygen orbital
custom/H.orb // remove hydrogen orbital

ATOMIC_POSITIONS
Cartesian_angstrom
O
0.0
1
0.0 0.0 0.0 1 1 1
H
0.0
1
1.0 0.0 0.0 1 1 1
`;

    const structure = parser.parse(content);
    const hydrogen = structure.atoms.find((atom) => atom.element === 'H');
    expect(hydrogen).to.not.equal(undefined);
    structure.removeAtom(hydrogen!.id);
    structure.addAtom(new Atom('C', 2, 0, 0));

    const serialized = parser.serialize(structure);

    expect(serialized).to.include('2 // legacy count');
    expect(serialized).to.include('O 15.999 custom/O.UPF upf201 // keep oxygen pseudo');
    expect(serialized).to.include('custom/O.orb // keep oxygen orbital');
    expect(serialized).to.include('C  12.011  C.upf');
    expect(serialized).to.include('C_gga_8au_100Ry_2s2p1d.orb');
    expect(serialized).to.not.include('custom/H.UPF');
    expect(serialized).to.not.include('custom/H.orb');
  });

  it('should backfill missing pseudo and orbital rows for existing elements', () => {
    const content = `ATOMIC_SPECIES
O 15.999 custom/O.UPF

NUMERICAL_ORBITAL
custom/O.orb

ATOMIC_POSITIONS
Cartesian_angstrom
O
0.0
1
0.0 0.0 0.0 1 1 1
H
0.0
1
1.0 0.0 0.0 1 1 1
`;

    const structure = parser.parse(content);
    const serialized = parser.serialize(structure);

    expect(serialized).to.include('O 15.999 custom/O.UPF');
    expect(serialized).to.include('custom/O.orb');
    expect(serialized).to.include('H  1.008  H.upf');
    expect(serialized).to.include('H_gga_6au_100Ry_2s1p.orb');
  });
});
