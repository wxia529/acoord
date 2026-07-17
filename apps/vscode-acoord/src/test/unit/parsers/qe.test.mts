import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UnitCell } from '../../../models/unitCell.js';
import { QEParser } from '../../../io/parsers/qeParser.js';
import { FileManager } from '../../../io/fileManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('QE Parser', () => {
  const parser = new QEParser();

  const SILICON_QE = `&CONTROL
  calculation = 'scf'
/
&SYSTEM
  ibrav = 0
  nat = 2
  ntyp = 1
/
&ELECTRONS
/
ATOMIC_SPECIES
Si  28.086  Si.pbe-n-kjpaw_psl.1.0.0.UPF

CELL_PARAMETERS angstrom
  2.715  2.715  0.000
  0.000  2.715  2.715
  2.715  0.000  2.715

ATOMIC_POSITIONS crystal
Si  0.00  0.00  0.00
Si  0.25  0.25  0.25
`;

  it('should parse unit cell from CELL_PARAMETERS block', () => {
    const structure = parser.parse(SILICON_QE);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should parse atoms from ATOMIC_POSITIONS block', () => {
    const structure = parser.parse(SILICON_QE);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Si');
    expect(structure.atoms[1].element).to.equal('Si');
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(SILICON_QE);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(2);
    expect(reparsed.atoms[0].element).to.equal('Si');
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should omit position flags when all atoms are unconstrained', () => {
    const qeWithUnconstrainedFlags = `&CONTROL
  calculation = 'relax'
/
&SYSTEM
  ibrav = 0
  nat = 2
  ntyp = 1
/
ATOMIC_SPECIES
C  12.011  C.UPF
ATOMIC_POSITIONS angstrom
C  0.0  0.0  0.0  1 1 1
C  1.0  0.0  0.0  1 1 1
`;
    const structure = parser.parse(qeWithUnconstrainedFlags);
    const serialized = parser.serialize(structure);

    expect(serialized).to.not.match(/\s[01]\s+[01]\s+[01]\s*$/m);
  });

  it('should preserve partial position constraints', () => {
    const qeWithPartialFlags = `&CONTROL
  calculation = 'relax'
/
&SYSTEM
  ibrav = 0
  nat = 2
  ntyp = 1
/
ATOMIC_SPECIES
C  12.011  C.UPF
ATOMIC_POSITIONS angstrom
C  0.0  0.0  0.0  0 1 1
C  1.0  0.0  0.0  1 1 1
`;
    const structure = parser.parse(qeWithPartialFlags);
    const serialized = parser.serialize(structure);
    const reparsed = parser.parse(serialized);

    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, true, true]);
    expect(serialized).to.match(/C\s+0\.0000000000\s+0\.0000000000\s+0\.0000000000\s+0 1 1/);
    expect(serialized).to.match(/C\s+1\.0000000000\s+0\.0000000000\s+0\.0000000000\s+1 1 1/);
    expect(reparsed.atoms[0].selectiveDynamics).to.deep.equal([false, true, true]);
  });

  describe('fixture file round-trip (water.qe.in)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.qe.in'), 'utf-8');

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
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o.x).to.be.closeTo(0.0, 1e-6);
      expect(o.y).to.be.closeTo(0.0, 1e-6);
    });

    it('should serialize → re-parse to equivalent structure', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
    });

    it('should preserve original namelist blocks (format preservation)', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      
      const serLines = serialized.split('\n');
      
      // CONTROL block should be preserved
      expect(serLines[0]).to.equal('&CONTROL');
      expect(serLines[1]).to.contain('calculation');
      
      // SYSTEM block should be preserved with updated nat
      const systemBlockStart = serLines.findIndex(l => l.trim() === '&SYSTEM');
      expect(systemBlockStart).to.be.greaterThan(-1);
      
      // ATOMIC_SPECIES block should be preserved
      const speciesStart = serLines.findIndex(l => l.trim() === 'ATOMIC_SPECIES');
      expect(speciesStart).to.be.greaterThan(-1);
    });
  });
  
  it('should preserve namelist format on round-trip', () => {
    const qeWithCustomSettings = `&CONTROL
  calculation = 'relax',
  prefix = 'my_calc',
  outdir = './tmp'
/
&SYSTEM
  ibrav = 0,
  nat = 2,
  ntyp = 1,
  ecutwfc = 60,
  ecutrho = 480
/
&ELECTRONS
  conv_thr = 1.0d-10,
  mixing_beta = 0.7
/
ATOMIC_SPECIES
C  12.011  C.pbe-n-kjpaw_psl.1.0.0.UPF

CELL_PARAMETERS angstrom
  5.0  0.0  0.0
  0.0  5.0  0.0
  0.0  0.0  5.0

ATOMIC_POSITIONS angstrom
C  0.000  0.000  0.000
C  1.500  1.500  1.500
`;
    const original = parser.parse(qeWithCustomSettings);
    const serialized = parser.serialize(original);
    
    const serLines = serialized.split('\n');
    
    // Should preserve CONTROL block content
    expect(serLines[1]).to.contain("calculation = 'relax'");
    expect(serLines[2]).to.contain("prefix = 'my_calc'");
    
    // Should preserve SYSTEM block with updated nat
    const systemLine = serLines.find(l => /^\s*nat\s*=/.test(l));
    expect(systemLine).to.contain('2');
    
    // Should preserve ELECTRONS block
    expect(serLines.some(l => l.includes('conv_thr = 1.0d-10'))).to.be.true;
  });

  it('should parse crystal positions when CELL_PARAMETERS follows K_POINTS', () => {
    const content = `&SYSTEM
  ibrav = 0, nat = 2, ntyp = 1
/
ATOMIC_SPECIES
C 12.011 C.UPF
ATOMIC_POSITIONS crystal
C 0.3603648913 0.3233062313 0.2863270320
C 0.2978614679 0.2594211832 0.2865551020
K_POINTS automatic
3 3 2 0 0 0
CELL_PARAMETERS angstrom
15.8895369240 -0.0014097270 0.0
-0.0016210060 16.5755316410 0.0
0.0 0.0 30.0
`;
    const structure = parser.parse(content);

    expect(structure.atoms).to.have.lengthOf(2);
    const fx = 0.3603648913;
    const fy = 0.3233062313;
    const fz = 0.2863270320;
    const expected = structure.unitCell?.fractionalToCartesian(fx, fy, fz);
    expect(expected).to.not.equal(undefined);
    if (!expected) {
      throw new Error('expected parsed QE unit cell');
    }
    expect(structure.atoms[0].x).to.be.closeTo(expected[0], 1e-9);
    expect(structure.atoms[0].y).to.be.closeTo(expected[1], 1e-9);
    expect(structure.atoms[0].z).to.be.closeTo(expected[2], 1e-9);
  });

  it('should preserve Cartesian positions through a crystal-coordinate round-trip', () => {
    const original = parser.parse(SILICON_QE);
    const before = original.atoms.map((atom) => atom.getPosition());
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(serialized).to.include('ATOMIC_POSITIONS angstrom');
    for (let i = 0; i < before.length; i++) {
      expect(reparsed.atoms[i].x).to.be.closeTo(before[i][0], 1e-9);
      expect(reparsed.atoms[i].y).to.be.closeTo(before[i][1], 1e-9);
      expect(reparsed.atoms[i].z).to.be.closeTo(before[i][2], 1e-9);
    }
  });

  it('should export QE positions as explicitly selected crystal coordinates', () => {
    const original = parser.parse(SILICON_QE);
    const serialized = FileManager.saveStructure(original, 'in', { qePositionUnit: 'crystal' });
    const reparsed = parser.parse(serialized);

    expect(serialized).to.include('ATOMIC_POSITIONS crystal');
    expect(serialized).to.match(/Si\s+0\.2500000000\s+0\.2500000000\s+0\.2500000000/);
    for (let i = 0; i < original.atoms.length; i++) {
      const before = original.atoms[i].getPosition();
      const after = reparsed.atoms[i].getPosition();
      for (let component = 0; component < 3; component++) {
        expect(after[component]).to.be.closeTo(before[component], 1e-9);
      }
    }
  });

  it('should reject crystal-coordinate export without a unit cell', () => {
    const structure = new Structure('molecule');
    structure.addAtom(new Atom('H', 0, 0, 0, undefined, { color: '#FFFFFF', radius: 0.3 }));

    expect(() => parser.serializeWithPositionUnit(structure, 'crystal'))
      .to.throw(/has no unit cell/);
  });

  it('should parse QE algebraic coordinate expressions', () => {
    const content = `&SYSTEM
  ibrav = 1, celldm(1) = 10.0, nat = 1, ntyp = 1
/
ATOMIC_SPECIES
C 12.011 C.UPF
ATOMIC_POSITIONS crystal
C 1/3 1/2*3^(-1/2) 1-3/4
`;
    const structure = parser.parse(content);
    const a = 10 * 0.529177210903;

    expect(structure.unitCell?.a).to.be.closeTo(a, 1e-9);
    expect(structure.atoms[0].x).to.be.closeTo(a / 3, 1e-9);
    expect(structure.atoms[0].y).to.be.closeTo(a / (2 * Math.sqrt(3)), 1e-9);
    expect(structure.atoms[0].z).to.be.closeTo(a / 4, 1e-9);
  });

  it('should derive alat from an explicit angstrom cell when needed', () => {
    const content = `&SYSTEM
  ibrav = 0, nat = 1, ntyp = 1
/
ATOMIC_SPECIES
C 12.011 C.UPF
ATOMIC_POSITIONS alat
C 0.5 0.25 0.1
CELL_PARAMETERS angstrom
4.0 0.0 0.0
0.0 5.0 0.0
0.0 0.0 6.0
`;
    const structure = parser.parse(content);

    expect(structure.atoms[0].getPosition()).to.deep.equal([2, 1, 0.4]);
  });

  it('should normalize bohr cells and positions without changing geometry', () => {
    const content = `&SYSTEM
  ibrav = 0, nat = 1, ntyp = 1
/
ATOMIC_SPECIES
C 12.011 C.UPF
ATOMIC_POSITIONS bohr
C 1.0 2.0 3.0
CELL_PARAMETERS bohr
10.0 0.0 0.0
0.0 11.0 0.0
0.0 0.0 12.0
`;
    const original = parser.parse(content);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(serialized).to.include('ATOMIC_POSITIONS angstrom');
    expect(serialized).to.include('CELL_PARAMETERS angstrom');
    const before = original.atoms[0].getPosition();
    const after = reparsed.atoms[0].getPosition();
    for (let i = 0; i < 3; i++) {
      expect(after[i]).to.be.closeTo(before[i], 1e-9);
    }
  });

  it('should support all documented explicit ibrav variants', () => {
    const variants = [1, 2, 3, -3, 4, 5, -5, 6, 7, 8, 9, -9, 91, 10, 11, 12, -12, 13, -13, 14];
    for (const ibrav of variants) {
      const content = `&SYSTEM
  ibrav = ${ibrav}, celldm(1) = 10.0, celldm(2) = 1.1,
  celldm(3) = 1.2, celldm(4) = 0.1, celldm(5) = 0.2, celldm(6) = 0.3,
  nat = 1, ntyp = 1
/
ATOMIC_SPECIES
Si 28.085 Si.UPF
ATOMIC_POSITIONS crystal
Si 0.1 0.2 0.3
`;
      const structure = parser.parse(content);
      expect(structure.unitCell, `ibrav=${ibrav}`).to.be.instanceOf(UnitCell);
      expect(structure.atoms[0].getPosition().every(Number.isFinite), `ibrav=${ibrav}`).to.be.true;
      const expected = structure.unitCell?.fractionalToCartesian(0.1, 0.2, 0.3);
      expect(expected, `ibrav=${ibrav}`).to.not.equal(undefined);
      if (expected) {
        const actual = structure.atoms[0].getPosition();
        for (let i = 0; i < 3; i++) {
          expect(actual[i], `ibrav=${ibrav}, component=${i}`).to.be.closeTo(expected[i], 1e-9);
        }
      }
    }
  });

  it('should preserve distinct species labels, masses, and pseudopotentials', () => {
    const content = `&SYSTEM
  ibrav = 1, A = 4.0, nat = 2, ntyp = 2
/
ATOMIC_SPECIES

! magnetic sublattices
Fe1 55.000 Fe1.custom.UPF
Fe2 57.000 Fe2.custom.UPF
ATOMIC_POSITIONS crystal
Fe1 0 0 0
Fe2 0.5 0.5 0.5
`;
    const structure = parser.parse(content);
    const serialized = parser.serialize(structure);

    expect(structure.atoms[0].sourceLabel).to.equal('Fe1');
    expect(structure.atoms[1].sourceLabel).to.equal('Fe2');
    expect(serialized).to.include('Fe1  55.000  Fe1.custom.UPF');
    expect(serialized).to.include('Fe2  57.000  Fe2.custom.UPF');
    expect(serialized).to.include('! magnetic sublattices');
    expect(serialized).to.match(/ibrav\s*=\s*0/i);
    expect(serialized).to.include('CELL_PARAMETERS angstrom');
  });

  it('should update inline nat and ntyp assignments after structural edits', () => {
    const structure = parser.parse(SILICON_QE.replace('nat = 2', 'ibrav = 0, nat = 2, ntyp = 1'));
    structure.addAtom(new Atom('C', 1, 1, 1, undefined, { color: '#909090', radius: 0.7 }));
    const serialized = parser.serialize(structure);

    expect(serialized).to.match(/nat\s*=\s*3/i);
    expect(serialized).to.match(/ntyp\s*=\s*2/i);
  });
});
