import { expect } from 'chai';
import {
  DEFAULT_BOND_THICKNESS_ANGSTROM,
  normalizeBondThickness,
  areBondThicknessesMixed,
} from '../../../../media/webview/src/utils/bondThickness.js';

describe('webview bondThickness utils', () => {
  it('normalizes invalid thickness to default thickness', () => {
    expect(normalizeBondThickness(Number.NaN)).to.equal(DEFAULT_BOND_THICKNESS_ANGSTROM);
    expect(normalizeBondThickness(0)).to.equal(DEFAULT_BOND_THICKNESS_ANGSTROM);
  });

  it('preserves positive thickness values', () => {
    expect(normalizeBondThickness(0.08)).to.equal(0.08);
  });

  it('detects mixed thickness values with tolerance', () => {
    expect(areBondThicknessesMixed([0.04, 0.0400000001], 1e-6)).to.equal(false);
    expect(areBondThicknessesMixed([0.04, 0.05], 1e-6)).to.equal(true);
  });
});
