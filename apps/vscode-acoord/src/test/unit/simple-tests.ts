import { Structure } from '../../models/structure';
import { Atom } from '../../models/atom';
import { UnitCell } from '../../models/unitCell';

export function testStructureCreation(): void {
  const structure = new Structure('test');
  console.log('Structure name:', structure.name);
  console.log('Structure isCrystal:', structure.isCrystal);
  console.log('Structure atoms count:', structure.atoms.length);
}

export function testAtomAddition(): void {
  const structure = new Structure('test');
  const atom = new Atom('H', 0, 0, 0);
  structure.addAtom(atom);

  console.log('Atom added:', atom.element);
  console.log('Atom position:', atom.x, atom.y, atom.z);
  console.log('Total atoms:', structure.atoms.length);

  const retrievedAtom = structure.getAtom(atom.id);
  console.log('Retrieved atom matches:', retrievedAtom === atom);
}

export function testUnitCell(): void {
  const cell = new UnitCell(2, 2, 2, 90, 90, 90);
  const vectors = cell.getLatticeVectors();

  console.log('Unit cell parameters:', cell.a, cell.b, cell.c);
  console.log('Lattice vectors:', vectors);
  console.log('Volume:', cell.getVolume());
}

export function testBondDetection(): void {
  const structure = new Structure('water');

  const h1 = new Atom('H', -0.75, 0, 0);
  const o = new Atom('O', 0, 0, 0);
  const h2 = new Atom('H', 0.75, 0, 0);

  structure.addAtom(h1);
  structure.addAtom(o);
  structure.addAtom(h2);

  const bonds = structure.getBonds();
  console.log('Bonds detected:', bonds.length);

  for (const bond of bonds) {
    const atom1 = structure.getAtom(bond.atomId1);
    const atom2 = structure.getAtom(bond.atomId2);
    console.log(`Bond: ${atom1?.element} - ${atom2?.element}, distance: ${bond.distance.toFixed(3)}`);
  }
}

export function runAllTests(): void {
  console.log('\n=== Running Unit Tests ===\n');
  testStructureCreation();
  console.log();
  testAtomAddition();
  console.log();
  testUnitCell();
  console.log();
  testBondDetection();
  console.log('\n=== All Tests Passed ===\n');
}

if (require.main === module) {
  runAllTests();
}