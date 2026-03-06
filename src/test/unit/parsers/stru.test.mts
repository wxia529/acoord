import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
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
});
