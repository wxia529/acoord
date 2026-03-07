import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UnitCell } from '../../../models/unitCell.js';

describe('Periodic Bonds - Out-of-Cell Atoms', () => {
  it('should form bonds with atoms outside the left boundary (close distance)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    // Atom outside left (fx = -0.1, wrapped to 0.9)
    const atom_out_left = new Atom('H', -0.5, 2.5, 2.5);
    // Atom inside cell (fx = 0.92)
    const atom_in = new Atom('H', 4.6, 2.5, 2.5);
    
    structure.addAtom(atom_out_left);
    structure.addAtom(atom_in);

    const bonds = structure.getPeriodicBonds();
    
    // Should form a bond because the atoms are close (0.1 Angstrom apart)
    // even though atom_out_left is outside the primary cell.
    // The bond is formed through the periodic image [-1, 0, 0].
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image).to.deep.equal([-1, 0, 0]);
  });

  it('should form bonds with atoms outside the right boundary (close distance)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    // Atom inside cell (fx = 0.08)
    const atom_in = new Atom('H', 0.4, 2.5, 2.5);
    // Atom outside right (fx = 1.1, wrapped to 0.1)
    const atom_out_right = new Atom('H', 5.5, 2.5, 2.5);
    
    structure.addAtom(atom_in);
    structure.addAtom(atom_out_right);

    const bonds = structure.getPeriodicBonds();
    
    // Should form a bond because the atoms are close (0.1 Angstrom apart)
    // even though atom_out_right is outside the primary cell.
    // The bond is formed through the periodic image [-1, 0, 0] (bringing
    // atom_out_right from x=5.5 to x=0.5, close to atom_in at x=0.4).
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image).to.deep.equal([-1, 0, 0]);
  });

  it('should form bonds across periodic boundary when both atoms are inside', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    // Atom near left boundary (fx = 0.02)
    const atom_left = new Atom('H', 0.1, 2.5, 2.5);
    // Atom near right boundary (fx = 0.98)
    const atom_right = new Atom('H', 4.9, 2.5, 2.5);
    
    structure.addAtom(atom_left);
    structure.addAtom(atom_right);

    const bonds = structure.getPeriodicBonds();
    
    // Should form a periodic bond across the boundary
    expect(bonds).to.have.lengthOf(1);
    expect(bonds[0].image).to.deep.equal([-1, 0, 0]);
  });

  it('should NOT form bonds with atoms far outside the cell (too far to bond)', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    // Atom inside cell
    const atom_in = new Atom('H', 2.5, 2.5, 2.5);
    // Atom far outside left (fx = -4.5, equivalent to fx = 0.5)
    const atom_far_left = new Atom('H', -22.5, 2.5, 2.5);
    
    structure.addAtom(atom_in);
    structure.addAtom(atom_far_left);

    const bonds = structure.getPeriodicBonds();
    
    // Should NOT form bonds because the atoms are too far apart
    // (20 Angstroms distance in Cartesian space)
    // Even though wrapped coordinates would be close, we don't form bonds
    // with atoms that are multiple unit cells away
    expect(bonds).to.have.lengthOf(0);
  });

  it('should handle atoms exactly on the boundary', () => {
    const structure = new Structure('test', true);
    structure.unitCell = new UnitCell(5, 5, 5, 90, 90, 90);

    // Atom at fx = 0.0 (left boundary)
    const atom_at_origin = new Atom('H', 0, 2.5, 2.5);
    // Atom at fx = 0.5 (middle)
    const atom_middle = new Atom('H', 2.5, 2.5, 2.5);
    
    structure.addAtom(atom_at_origin);
    structure.addAtom(atom_middle);

    const bonds = structure.getPeriodicBonds();
    
    // atom_at_origin is at the boundary (fx = 0.0), should be considered inside
    // No bond expected due to distance (2.5 Angstroms > bond threshold)
    expect(bonds).to.have.lengthOf(0);
  });
});
