import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { PDBParser } from '../../../io/parsers/pdbParser.js';

describe('PDB Parser', () => {
  const parser = new PDBParser();

  const WATER_PDB = `REMARK   water molecule
CRYST1    5.000    5.000    5.000  90.00  90.00  90.00 P 1           1
ATOM      1  O   HOH A   1       0.000   0.000   0.000  1.00  0.00           O
ATOM      2  H   HOH A   1       0.757   0.586   0.000  1.00  0.00           H
ATOM      3  H   HOH A   1      -0.757   0.586   0.000  1.00  0.00           H
END`;

  it('should parse atoms from ATOM records', () => {
    const structure = parser.parse(WATER_PDB);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
  });

  it('should parse unit cell from CRYST1 record', () => {
    const structure = parser.parse(WATER_PDB);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(5.0, 1e-3);
  });

  it('should parse atom coordinates correctly', () => {
    const structure = parser.parse(WATER_PDB);
    expect(structure.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(structure.atoms[1].x).to.be.closeTo(0.757, 1e-3);
    expect(structure.atoms[2].x).to.be.closeTo(-0.757, 1e-3);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_PDB);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-2);
  });
});
