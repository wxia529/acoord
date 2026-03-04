import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { ORCAParser } from '../../../io/parsers/orcaParser.js';

describe('ORCA Parser', () => {
  const parser = new ORCAParser();

  const WATER_ORCA = `! B3LYP def2-SVP
%maxcore 4096

* xyz 0 1
O   0.000   0.000   0.000
H   0.757   0.586   0.000
H  -0.757   0.586   0.000
*`;

  it('should parse atoms from * xyz block', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse charge and multiplicity', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.metadata.get('charge')).to.equal(0);
    expect(structure.metadata.get('multiplicity')).to.equal(1);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_ORCA);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(reparsed.atoms[1].x).to.be.closeTo(0.757, 1e-3);
  });

  it('should throw on missing * xyz block', () => {
    expect(() => parser.parse('! just a comment\n')).to.throw(/missing/i);
  });
});
