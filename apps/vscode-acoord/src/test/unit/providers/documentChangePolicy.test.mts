import { expect } from 'chai';
import { isDocumentMutationMessage } from '../../../providers/documentChangePolicy.js';
import type { WebviewToExtensionMessage } from '../../../shared/protocol.js';

describe('documentChangePolicy', () => {
  it('treats initialization and view-only commands as non-mutating', () => {
    const messages: WebviewToExtensionMessage[] = [
      { command: 'getState' },
      { command: 'getColorSchemes' },
      { command: 'loadColorScheme', schemeId: 'bright' },
      { command: 'updateDisplaySettings', settings: {} },
      { command: 'setTrajectoryFrame', frameIndex: 0 },
      { command: 'selectAtom', atomId: 'atom_1' },
      { command: 'setSelection', atomIds: ['atom_1'] },
      { command: 'setBondScheme', scheme: 'all' },
      { command: 'saveRenderedImage', dataUrl: 'data:image/png;base64,', suggestedName: 'preview.png' },
    ];

    for (const message of messages) {
      expect(isDocumentMutationMessage(message), message.command).to.equal(false);
    }
  });

  it('treats structure edits as mutating', () => {
    const messages: WebviewToExtensionMessage[] = [
      { command: 'addAtom', element: 'C', x: 0, y: 0, z: 0 },
      { command: 'deleteAtoms', atomIds: ['atom_1'] },
      { command: 'moveAtom', atomId: 'atom_1', x: 1, y: 2, z: 3 },
      { command: 'setAtomsPositions', atomPositions: [{ id: 'atom_1', x: 1, y: 2, z: 3 }] },
      { command: 'setAtomColor', atomIds: ['atom_1'], color: '#ffffff' },
      { command: 'createBond', atomIds: ['atom_1', 'atom_2'] },
      { command: 'calculateBonds' },
      { command: 'setUnitCell', params: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 } },
    ];

    for (const message of messages) {
      expect(isDocumentMutationMessage(message), message.command).to.equal(true);
    }
  });
});
