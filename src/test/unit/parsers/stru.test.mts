import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { STRUParser } from '../../../io/parsers/struParser.js';

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
});
