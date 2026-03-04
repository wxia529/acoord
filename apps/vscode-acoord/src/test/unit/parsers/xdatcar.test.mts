import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { XDATCARParser } from '../../../io/parsers/xdatcarParser.js';

describe('XDATCAR Parser', () => {
  const parser = new XDATCARParser();

  const XDATCAR_CONTENT = `Simple BCC Iron MD
1.0
2.866 0.0 0.0
0.0 2.866 0.0
0.0 0.0 2.866
Fe
2
Direct configuration=     1
0.0 0.0 0.0
0.5 0.5 0.5
Direct configuration=     2
0.01 0.0 0.0
0.51 0.5 0.5`;

  it('should parse the last frame', () => {
    const structure = parser.parse(XDATCAR_CONTENT);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Fe');
    expect(structure.isCrystal).to.be.true;
  });

  it('should parse trajectory into multiple frames', () => {
    const frames = parser.parseTrajectory(XDATCAR_CONTENT);
    expect(frames).to.have.lengthOf(2);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(XDATCAR_CONTENT);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(2);
    expect(reparsed.atoms[0].element).to.equal('Fe');
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });
});
