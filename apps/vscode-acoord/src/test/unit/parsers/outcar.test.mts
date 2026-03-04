import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { OUTCARParser } from '../../../io/parsers/outcarParser.js';

describe('OUTCAR Parser', () => {
  const parser = new OUTCARParser();

  // Minimal OUTCAR with one ionic step
  const OUTCAR_CONTENT = `
 TITEL  = PAW_PBE Fe 06Sep2000
 VRHFIN =Fe: d6 s2
   ions per type = 2
 POMASS =  55.845
 NIONS  =       2

  direct lattice vectors                 reciprocal lattice vectors
    2.866000000  0.000000000  0.000000000     0.348919  0.000000  0.000000
    0.000000000  2.866000000  0.000000000     0.000000  0.348919  0.000000
    0.000000000  0.000000000  2.866000000     0.000000  0.000000  0.348919

 POSITION                                       TOTAL-FORCE (eV/Angst)
 -----------------------------------------------------------------------------------
      0.00000      0.00000      0.00000         0.000000      0.000000      0.000000
      1.43300      1.43300      1.43300         0.000000      0.000000      0.000000
 -----------------------------------------------------------------------------------
`;

  it('should parse atoms from POSITION block', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[0].element).to.equal('Fe');
  });

  it('should parse lattice vectors', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(2.866, 1e-3);
  });

  it('should throw on serialize (read-only format)', () => {
    const structure = parser.parse(OUTCAR_CONTENT);
    expect(() => parser.serialize(structure)).to.throw(/not supported/i);
  });
});
