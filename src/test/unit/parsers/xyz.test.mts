import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { XYZParser } from '../../../io/parsers/xyzParser.js';

describe('XYZ Parser', () => {
  const parser = new XYZParser();

  const WATER_XYZ = `3
water molecule
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000`;

  it('should parse a simple XYZ file', () => {
    const structure = parser.parse(WATER_XYZ);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse atom coordinates correctly', () => {
    const structure = parser.parse(WATER_XYZ);
    expect(structure.atoms[0].x).to.be.closeTo(0, 1e-6);
    expect(structure.atoms[1].x).to.be.closeTo(0.757, 1e-3);
    expect(structure.atoms[2].x).to.be.closeTo(-0.757, 1e-3);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_XYZ);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(reparsed.atoms[1].x).to.be.closeTo(0.757, 1e-3);
  });

  it('should parse multi-frame XYZ trajectory', () => {
    const traj = `2\nframe 1\nH 0 0 0\nH 1 0 0\n\n2\nframe 2\nH 0 0 0\nH 2 0 0`;
    const frames = parser.parseTrajectory(traj);
    expect(frames).to.have.lengthOf(2);
    expect(frames[1].atoms[1].x).to.be.closeTo(2, 1e-6);
  });
});
