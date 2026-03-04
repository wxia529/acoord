import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { CIFParser } from '../../../io/parsers/cifParser.js';

describe('CIF Parser', () => {
  const parser = new CIFParser();

  const SIMPLE_CIF = `data_NaCl
_cell_length_a   5.6402
_cell_length_b   5.6402
_cell_length_c   5.6402
_cell_angle_alpha  90.0
_cell_angle_beta   90.0
_cell_angle_gamma  90.0

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na1 Na 0.0 0.0 0.0
Cl1 Cl 0.5 0.5 0.5`;

  it('should parse unit cell parameters', () => {
    const structure = parser.parse(SIMPLE_CIF);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(5.6402, 1e-3);
    expect(structure.unitCell!.alpha).to.be.closeTo(90, 1e-3);
  });

  it('should parse atoms from loop_', () => {
    const structure = parser.parse(SIMPLE_CIF);
    expect(structure.atoms.length).to.be.greaterThanOrEqual(2);
    const elements = structure.atoms.map(a => a.element);
    expect(elements).to.include('Na');
    expect(elements).to.include('Cl');
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(SIMPLE_CIF);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    expect(reparsed.atoms.length).to.equal(original.atoms.length);
  });
});
