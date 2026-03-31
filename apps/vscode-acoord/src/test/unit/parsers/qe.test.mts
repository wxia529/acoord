import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { QEParser } from '../../../io/parsers/qeParser.js';

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
});
