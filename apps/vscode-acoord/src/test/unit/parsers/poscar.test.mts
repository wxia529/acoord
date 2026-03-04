import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { POSCARParser } from '../../../io/parsers/poscarParser.js';

describe('POSCAR Parser', () => {
  it('should parse a simple POSCAR file', () => {
    const content = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Direct
0.0 0.0 0.0
0.5 0.5 0.5`;

    const parser = new POSCARParser();
    const structure = parser.parse(content);

    expect(structure.name).to.equal('Simple BCC Iron');
    expect(structure.isCrystal).to.be.true;
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.atoms[0].element).to.equal('Fe');
  });

  it('should parse selective dynamics', () => {
    const content = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Selective dynamics
Direct
0.0 0.0 0.0 T T T
0.5 0.5 0.5 T T F`;

    const parser = new POSCARParser();
    const structure = parser.parse(content);

    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
    expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
  });

  it('should round-trip selective dynamics', () => {
    const parser = new POSCARParser();

    const original = `Simple BCC Iron
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Selective dynamics
Direct
0.0 0.0 0.0 T T T
0.5 0.5 0.5 T T F`;

    const structure = parser.parse(original);
    const serialized = parser.serialize(structure);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms[0].selectiveDynamics).to.deep.equal([true, true, true]);
    expect(reparsed.atoms[1].selectiveDynamics).to.deep.equal([true, true, false]);
  });
});