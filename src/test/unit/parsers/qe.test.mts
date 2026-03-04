import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { QEParser } from '../../../io/parsers/qeParser.js';

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
});
