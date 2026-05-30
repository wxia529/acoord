import type { WebviewToExtensionMessage } from '../shared/protocol.js';

type WebviewCommand = WebviewToExtensionMessage['command'];

const DOCUMENT_MUTATION_COMMANDS = new Set<WebviewCommand>([
  'addAtom',
  'applyDisplaySettings',
  'calculateBonds',
  'centerToUnitCell',
  'changeAtoms',
  'clearBonds',
  'clearUnitCell',
  'copyAtoms',
  'createBond',
  'deleteAtom',
  'deleteAtoms',
  'deleteBond',
  'moveAtom',
  'moveGroup',
  'pasteSelection',
  'rotateGroup',
  'setAtomColor',
  'setAtomFixed',
  'setAtomRadius',
  'setAtomsPositions',
  'setBondColor',
  'setBondLength',
  'setBondRadius',
  'setCovalentRadius',
  'setGlobalBondRadius',
  'setUnitCell',
  'toggleUnitCell',
  'updateAtom',
]);

/**
 * Returns true when a webview command is allowed to mark the custom document
 * dirty in VS Code.
 */
export function isDocumentMutationMessage(message: WebviewToExtensionMessage): boolean {
  return DOCUMENT_MUTATION_COMMANDS.has(message.command);
}
