import { expect } from 'chai';
import { formatSelectedAtomIndices } from '../../../../media/webview/src/utils/atomSelection.js';

describe('webview atom selection index format', () => {
  const atoms = Array.from({ length: 10 }, (_, index) => `atom_${index + 1}`);

  it('uses 1-based structure order and merges long consecutive ranges', () => {
    expect(formatSelectedAtomIndices(atoms, ['atom_1', 'atom_2', 'atom_5', 'atom_6', 'atom_7', 'atom_8']))
      .to.equal('1,2,5-8');
  });

  it('sorts by structure order, removes duplicates, and uses no spaces', () => {
    expect(formatSelectedAtomIndices(atoms, ['atom_9', 'atom_3', 'atom_3', 'atom_1']))
      .to.equal('1,3,9');
  });

  it('supports compact zero-based indices', () => {
    expect(formatSelectedAtomIndices(atoms, ['atom_1', 'atom_2', 'atom_5', 'atom_6', 'atom_7'], 0))
      .to.equal('0,1,4-6');
  });
});
