import { expect } from 'chai';
import { Bond } from '../../../models/bond.js';
import { DEFAULT_BOND_RADIUS } from '../../../config/defaults.js';

describe('Bond', () => {
  it('normalizes atom ids in constructor', () => {
    const bond = new Bond('atom_b', 'atom_a');
    expect(bond.atomId1).to.equal('atom_a');
    expect(bond.atomId2).to.equal('atom_b');
  });

  it('uses default radius when not provided', () => {
    const bond = new Bond('atom_a', 'atom_b');
    expect(bond.radius).to.equal(DEFAULT_BOND_RADIUS);
  });

  it('supports custom radius and color', () => {
    const bond = new Bond('atom_a', 'atom_b', undefined, { radius: 0.23, color: '#00FF00' });
    expect(bond.radius).to.equal(0.23);
    expect(bond.color).to.equal('#00FF00');
  });

  it('clone returns an independent copy', () => {
    const bond = new Bond('atom_a', 'atom_b', undefined, { radius: 0.21, color: '#112233' });
    const cloned = bond.clone();

    expect(cloned).to.not.equal(bond);
    expect(cloned.id).to.equal(bond.id);
    expect(cloned.atomId1).to.equal(bond.atomId1);
    expect(cloned.atomId2).to.equal(bond.atomId2);
    expect(cloned.radius).to.equal(bond.radius);
    expect(cloned.color).to.equal(bond.color);
  });

  it('toJSON returns serializable bond data', () => {
    const bond = new Bond('atom_a', 'atom_b', 'bond_id_1', { radius: 0.19, color: '#ABCDEF' });
    expect(bond.toJSON()).to.deep.equal({
      id: 'bond_id_1',
      atomId1: 'atom_a',
      atomId2: 'atom_b',
      radius: 0.19,
      color: '#ABCDEF',
    });
  });
});
