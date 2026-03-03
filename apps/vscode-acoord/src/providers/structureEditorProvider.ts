import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Structure } from '../models/structure';
import { UnitCell } from '../models/unitCell';
import { FileManager } from '../io/fileManager';
import { ThreeJSRenderer } from '../renderers/threejsRenderer';
import { Atom } from '../models/atom';
import { parseElement } from '../utils/elementData';
import { ConfigManager } from '../config/configManager';
import { DisplayConfig, DisplaySettings } from '../config/types';
import { UndoManager } from './undoManager';
import { TrajectoryManager } from './trajectoryManager';
import { StructureDocumentManager } from './structureDocumentManager';

/**
 * Custom document representing a structure file opened in the editor
 */
export class StructureDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri) {}

  dispose(): void {
    // No additional resources to release beyond what the provider tracks
  }
}

class EditorSession {
  constructor(
    readonly key: string,
    readonly webviewPanel: vscode.WebviewPanel,
    readonly renderer: ThreeJSRenderer,
    readonly trajectoryManager: TrajectoryManager,
    readonly undoManager: UndoManager,
    displaySettings?: DisplaySettings
  ) {
    this.displaySettings = displaySettings;
  }

  displaySettings?: DisplaySettings;
}

/**
 * Custom editor provider for structure files
 */
export class StructureEditorProvider implements vscode.CustomEditorProvider<StructureDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructureDocument> |
      vscode.CustomDocumentContentChangeEvent<StructureDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  private sessions = new Map<string, EditorSession>();

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigManager
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<StructureDocument> {
    return new StructureDocument(uri);
  }

  async resolveCustomEditor(
    document: StructureDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri.fsPath;

    // Initialize config manager if needed
    await this.configManager.initialize();

    // Try to load structure from file
    let frames: Structure[];
    try {
      frames = await StructureDocumentManager.load(document.uri);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load structure: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    if (!frames || frames.length === 0) {
      vscode.window.showErrorMessage('Failed to load structure: no frame found.');
      return;
    }
    const initialFrameIndex = TrajectoryManager.defaultFrameIndex(frames);

    // Store references
    const key = uri;
    const traj = new TrajectoryManager(frames, initialFrameIndex);

    const renderer = new ThreeJSRenderer(traj.activeStructure);
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);

    // Load default display config
    const defaultConfig = this.configManager.getCurrentConfig();
    const session = new EditorSession(
      key,
      webviewPanel,
      renderer,
      traj,
      new UndoManager(),
      defaultConfig?.settings
    );
    this.sessions.set(key, session);

    // Setup webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview);

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message, key, webviewPanel),
      undefined,
      this.context.subscriptions
    );

    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (savedDoc) => {
        if (savedDoc.uri.fsPath !== key) {
          return;
        }
        try {
          const content = savedDoc.getText();
          const updatedFrames = FileManager.loadStructures(key, content);
          if (!updatedFrames || updatedFrames.length === 0) {
            return;
          }
          const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
          session.trajectoryManager.set(updatedFrames, idx);
          session.undoManager.clear();
          renderer.setStructure(updatedFrames[idx]);
          renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
          renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(session);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Initial render
    this.renderStructure(session);

    // Cleanup on close
    webviewPanel.onDidDispose(() => {
      this.sessions.delete(key);
      saveListener.dispose();
    });
  }

  private async handleWebviewMessage(
    message: any,
    key: string,
    _webviewPanel: vscode.WebviewPanel
  ) {
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }

    if (await this.handleCoreCommands(message, session)) {
      return;
    }
    if (await this.handleSelectionAndCellCommands(message, session)) {
      return;
    }
    if (await this.handleAtomEditCommands(message, session)) {
      return;
    }
    if (await this.handleBondCommands(message, session)) {
      return;
    }
    if (await this.handleDocumentCommands(message, session)) {
      return;
    }
    await this.handleDisplayConfigCommands(message, session);
  }

  private async handleCoreCommands(message: any, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;

    switch (message.command) {
      case 'getState':
        this.renderStructure(session);
        return true;

      case 'setTrajectoryFrame': {
        if (traj.frameCount <= 1) {
          return true;
        }
        const requestedIndex = Number(message.frameIndex);
        if (!Number.isFinite(requestedIndex)) {
          return true;
        }
        const nextIndex = Math.max(0, Math.min(traj.frameCount - 1, Math.floor(requestedIndex)));
        traj.setActiveIndex(nextIndex);
        const nextStructure = traj.activeStructure;
        renderer.setStructure(nextStructure);
        renderer.setShowUnitCell(!!nextStructure.unitCell);
        renderer.setTrajectoryFrameInfo(nextIndex, traj.frameCount);
        renderer.deselectAtom();
        renderer.deselectBond();
        undo.clear();
        this.renderStructure(session);
        return true;
      }

      case 'beginDrag':
        if (message.atomId && !traj.isEditing) {
          const editStructure = traj.beginEdit();
          undo.push(editStructure);
        }
        return true;

      case 'undo':
        this.undoLastEdit(session);
        return true;

      default:
        return false;
    }
  }

  private async handleSelectionAndCellCommands(message: any, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;

    switch (message.command) {
      case 'selectAtom': {
        if (message.atomId) {
          if (message.add) {
            const current = renderer.getState().selectedAtomIds || [];
            const exists = current.includes(message.atomId);
            const next = exists
              ? current.filter((id) => id !== message.atomId)
              : [...current, message.atomId];
            renderer.setSelection(next);
          } else {
            renderer.selectAtom(message.atomId);
          }
          renderer.deselectBond();
          this.renderStructure(session);
        }
        return true;
      }

      case 'setSelection': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        renderer.setSelection(ids);
        renderer.deselectBond();
        this.renderStructure(session);
        return true;
      }

      case 'selectBond': {
        const bondKey = typeof message.bondKey === 'string' && message.bondKey.trim()
          ? message.bondKey.trim()
          : undefined;
        if (message.add && bondKey) {
          const current = renderer.getState().selectedBondKeys || [];
          const next = current.includes(bondKey)
            ? current.filter((k) => k !== bondKey)
            : [...current, bondKey];
          renderer.setBondSelection(next);
        } else {
          renderer.selectBond(bondKey);
        }
        this.renderStructure(session);
        return true;
      }

      case 'setBondSelection': {
        const keys: string[] = Array.isArray(message.bondKeys)
          ? message.bondKeys.filter((k: unknown) => typeof k === 'string')
          : [];
        renderer.setBondSelection(keys);
        this.renderStructure(session);
        return true;
      }

      case 'toggleUnitCell': {
        renderer.setShowUnitCell(!renderer.getState().showUnitCell);
        this.renderStructure(session);
        return true;
      }

      case 'setUnitCell': {
        const params = message.params || {};
        const a = Number(params.a);
        const b = Number(params.b);
        const c = Number(params.c);
        const alpha = Number(params.alpha);
        const beta = Number(params.beta);
        const gamma = Number(params.gamma);
        const isValid =
          [a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value)) &&
          a > 0 &&
          b > 0 &&
          c > 0 &&
          alpha > 0 &&
          beta > 0 &&
          gamma > 0 &&
          alpha < 180 &&
          beta < 180 &&
          gamma < 180;

        if (!isValid) {
          vscode.window.showErrorMessage('Invalid lattice parameters.');
          return true;
        }

        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        const oldCell = editStructure.unitCell;
        const nextCell = new UnitCell(a, b, c, alpha, beta, gamma);
        if (message.scaleAtoms && oldCell) {
          for (const atom of editStructure.atoms) {
            const frac = oldCell.cartesianToFractional(atom.x, atom.y, atom.z);
            const cart = nextCell.fractionalToCartesian(frac[0], frac[1], frac[2]);
            atom.setPosition(cart[0], cart[1], cart[2]);
          }
        }
        editStructure.unitCell = nextCell;
        editStructure.isCrystal = true;
        if (!editStructure.supercell) {
          editStructure.supercell = [1, 1, 1];
        }
        renderer.setStructure(editStructure);
        renderer.setShowUnitCell(true);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'clearUnitCell': {
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        editStructure.unitCell = undefined;
        editStructure.isCrystal = false;
        editStructure.supercell = [1, 1, 1];
        renderer.setStructure(editStructure);
        renderer.setShowUnitCell(false);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'centerToUnitCell': {
        const centerStructure = traj.activeStructure;
        if (!centerStructure.unitCell) {
          vscode.window.showErrorMessage('Centering requires a unit cell.');
          return true;
        }
        if (centerStructure.atoms.length === 0) {
          return true;
        }
        const confirm = await vscode.window.showWarningMessage(
          'Center all atoms in the unit cell? This will move every atom.',
          { modal: true },
          'Center'
        );
        if (confirm !== 'Center') {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const atom of editStructure.atoms) {
          cx += atom.x;
          cy += atom.y;
          cz += atom.z;
        }
        const count = editStructure.atoms.length;
        const geomCenter: [number, number, number] = [cx / count, cy / count, cz / count];
        const vectors = editStructure.unitCell!.getLatticeVectors();
        const cellCenter: [number, number, number] = [
          0.5 * (vectors[0][0] + vectors[1][0] + vectors[2][0]),
          0.5 * (vectors[0][1] + vectors[1][1] + vectors[2][1]),
          0.5 * (vectors[0][2] + vectors[1][2] + vectors[2][2]),
        ];
        const dx = cellCenter[0] - geomCenter[0];
        const dy = cellCenter[1] - geomCenter[1];
        const dz = cellCenter[2] - geomCenter[2];
        editStructure.translate(dx, dy, dz);
        renderer.setStructure(editStructure);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'setSupercell': {
        const sc = Array.isArray(message.supercell) ? message.supercell : [1, 1, 1];
        const nx = Math.max(1, Math.floor(Number(sc[0]) || 1));
        const ny = Math.max(1, Math.floor(Number(sc[1]) || 1));
        const nz = Math.max(1, Math.floor(Number(sc[2]) || 1));
        const scStructure = traj.activeStructure;
        if (!scStructure.unitCell) {
          scStructure.supercell = [1, 1, 1];
        } else {
          scStructure.supercell = [nx, ny, nz];
        }
        renderer.setStructure(scStructure);
        this.renderStructure(session);
        return true;
      }

      default:
        return false;
    }
  }

  private async handleAtomEditCommands(message: any, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;

    switch (message.command) {
      case 'addAtom': {
        const element = parseElement(String(message.element || ''));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        const atom = new Atom(
          element,
          message.x || 0,
          message.y || 0,
          message.z || 0
        );
        undo.push(editStructure);
        editStructure.addAtom(atom);
        renderer.setStructure(editStructure);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'deleteAtom': {
        if (message.atomId) {
          const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
          undo.push(editStructure);
          editStructure.removeAtom(message.atomId);
          renderer.setStructure(editStructure);
          renderer.deselectAtom();
          renderer.deselectBond();
          traj.commitEdit();
          this.renderStructure(session);
        }
        return true;
      }

      case 'deleteAtoms': {
        const ids: string[] = Array.isArray(message.atomIds)
          ? Array.from(
            new Set(
              message.atomIds.filter(
                (id: unknown): id is string => typeof id === 'string' && id.length > 0
              )
            )
          )
          : [];
        if (ids.length === 0) {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        for (const atomId of ids) {
          editStructure.removeAtom(atomId);
        }
        renderer.setStructure(editStructure);
        renderer.deselectAtom();
        renderer.deselectBond();
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'moveAtom': {
        if (message.atomId) {
          const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
          const atom = editStructure.getAtom(message.atomId);
          if (atom) {
            atom.setPosition(message.x, message.y, message.z);
            renderer.setStructure(editStructure);
            if (!message.preview) {
              traj.commitEdit();
              this.renderStructure(session);
            }
          }
        }
        return true;
      }

      case 'moveGroup': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length > 0) {
          const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
          for (const id of ids) {
            const atom = editStructure.getAtom(id);
            if (atom) {
              atom.setPosition(atom.x + message.dx, atom.y + message.dy, atom.z + message.dz);
            }
          }
          renderer.setStructure(editStructure);
          if (!message.preview) {
            traj.commitEdit();
            this.renderStructure(session);
          }
        }
        return true;
      }

      case 'setAtomsPositions': {
        const updates: Array<{ id: string; x: number; y: number; z: number }> =
          Array.isArray(message.atomPositions) ? message.atomPositions : [];
        if (updates.length === 0) {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        for (const update of updates) {
          const atom = editStructure.getAtom(update.id);
          if (atom) {
            atom.setPosition(update.x, update.y, update.z);
          }
        }
        renderer.setStructure(editStructure);
        if (!message.preview) {
          traj.commitEdit();
          this.renderStructure(session);
        }
        return true;
      }

      case 'endDrag':
        if (traj.isEditing) {
          traj.commitEdit();
        }
        this.renderStructure(session);
        return true;

      case 'setBondLength': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length >= 2 && typeof message.length === 'number') {
          const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
          const atomA = editStructure.getAtom(ids[0]);
          const atomB = editStructure.getAtom(ids[1]);
          if (atomA && atomB) {
            undo.push(editStructure);
            const dx = atomB.x - atomA.x;
            const dy = atomB.y - atomA.y;
            const dz = atomB.z - atomA.z;
            const current = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (current > 1e-6) {
              const scale = message.length / current;
              atomB.setPosition(
                atomA.x + dx * scale,
                atomA.y + dy * scale,
                atomA.z + dz * scale
              );
              renderer.setStructure(editStructure);
              traj.commitEdit();
              this.renderStructure(session);
            }
          }
        }
        return true;
      }

      case 'copyAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0) {
          return true;
        }
        const offset = message.offset || { x: 0.5, y: 0.5, z: 0.5 };
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        for (const id of ids) {
          const atom = editStructure.getAtom(id);
          if (!atom) {
            continue;
          }
          const copy = new Atom(
            atom.element,
            atom.x + (offset.x || 0),
            atom.y + (offset.y || 0),
            atom.z + (offset.z || 0)
          );
          editStructure.addAtom(copy);
        }
        renderer.setStructure(editStructure);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'changeAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0 || !message.element) {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        const element = parseElement(String(message.element));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          traj.commitEdit();
          return true;
        }
        for (const id of ids) {
          const atom = editStructure.getAtom(id);
          if (atom) {
            atom.element = element;
          }
        }
        renderer.setStructure(editStructure);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'setAtomColor': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        const color = typeof message.color === 'string' ? message.color.trim() : '';
        if (ids.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        for (const id of ids) {
          const atom = editStructure.getAtom(id);
          if (atom) {
            atom.color = color;
          }
        }
        renderer.setStructure(editStructure);
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'updateAtom': {
        if (message.atomId) {
          const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
          const atom = editStructure.getAtom(message.atomId);
          if (atom) {
            undo.push(editStructure);
            if (message.element) {
              const element = parseElement(String(message.element));
              if (!element) {
                vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
              } else {
                atom.element = element;
              }
            }
            if (
              typeof message.x === 'number' &&
              typeof message.y === 'number' &&
              typeof message.z === 'number'
            ) {
              atom.setPosition(message.x, message.y, message.z);
            }
            renderer.setStructure(editStructure);
            traj.commitEdit();
            this.renderStructure(session);
          }
        }
        return true;
      }

      default:
        return false;
    }
  }

  private async handleBondCommands(message: any, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;

    switch (message.command) {
      case 'createBond': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length < 2) {
          return true;
        }
        const atomId1 = ids[0];
        const atomId2 = ids[1];
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        if (!editStructure.getAtom(atomId1) || !editStructure.getAtom(atomId2) || atomId1 === atomId2) {
          traj.commitEdit();
          return true;
        }
        undo.push(editStructure);
        editStructure.addManualBond(atomId1, atomId2);
        renderer.setStructure(editStructure);
        renderer.selectBond(Structure.bondKey(atomId1, atomId2));
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'deleteBond': {
        const selectedPairs: Array<[string, string]> = [];
        if (Array.isArray(message.bondKeys)) {
          for (const bk of message.bondKeys) {
            if (typeof bk !== 'string') {
              continue;
            }
            const pair = Structure.bondKeyToPair(bk);
            if (pair) {
              selectedPairs.push(pair);
            }
          }
        }

        if (selectedPairs.length === 0) {
          let pair: [string, string] | null = null;
          if (typeof message.bondKey === 'string') {
            pair = Structure.bondKeyToPair(message.bondKey);
          }
          if (!pair) {
            const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
            if (ids.length >= 2) {
              pair = Structure.normalizeBondPair(ids[0], ids[1]);
            }
          }
          if (pair) {
            selectedPairs.push(pair);
          }
        }

        if (selectedPairs.length === 0) {
          return true;
        }
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        for (const pair of selectedPairs) {
          editStructure.removeBond(pair[0], pair[1]);
        }
        renderer.setStructure(editStructure);
        renderer.deselectBond();
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      case 'recalculateBonds': {
        const editStructure = traj.isEditing ? traj.activeStructure : traj.beginEdit();
        undo.push(editStructure);
        editStructure.manualBonds = [];
        editStructure.suppressedAutoBonds = [];
        renderer.setStructure(editStructure);
        renderer.deselectBond();
        traj.commitEdit();
        this.renderStructure(session);
        return true;
      }

      default:
        return false;
    }
  }

  private async handleDocumentCommands(message: any, session: EditorSession): Promise<boolean> {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;

    switch (message.command) {
      case 'saveStructure':
        await this.saveStructure(session);
        return true;

      case 'saveStructureAs':
        await this.handleSaveStructureAs(session);
        return true;

      case 'saveRenderedImage': {
        const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
        const imageMatch = dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!imageMatch || !imageMatch[1]) {
          const reason = 'Failed to export image: invalid PNG data.';
          vscode.window.showErrorMessage(reason);
          session.webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
          return true;
        }

        const rawName =
          typeof message.suggestedName === 'string' && message.suggestedName.trim()
            ? message.suggestedName.trim()
            : `structure-hd-${Date.now()}.png`;
        const fileName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
        const saveUri = await vscode.window.showSaveDialog({
          saveLabel: 'Save HD Image',
          defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(session.key)), fileName),
          filters: {
            'PNG Image': ['png'],
          },
        });

        if (!saveUri) {
          return true;
        }

        try {
          const bytes = Buffer.from(imageMatch[1], 'base64');
          await vscode.workspace.fs.writeFile(saveUri, bytes);
          const savedName = path.basename(saveUri.fsPath);
          vscode.window.showInformationMessage(`Image exported to ${savedName}`);
          session.webviewPanel.webview.postMessage({
            command: 'imageSaved',
            data: { fileName: savedName },
          });
        } catch (error) {
          const reason = `Failed to export image: ${error instanceof Error ? error.message : String(error)}`;
          vscode.window.showErrorMessage(reason);
          session.webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
        }
        return true;
      }

      case 'openSource':
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(session.key));
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open source: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        return true;

      case 'reloadStructure': {
        try {
          const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(session.key));
          const content = new TextDecoder().decode(fileContent);
          const updatedFrames = FileManager.loadStructures(session.key, content);
          if (!updatedFrames || updatedFrames.length === 0) {
            return true;
          }
          const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
          traj.set(updatedFrames, idx);
          undo.clear();
          renderer.setStructure(updatedFrames[idx]);
          renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
          renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(session);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        return true;
      }

      default:
        return false;
    }
  }

  private async handleDisplayConfigCommands(message: any, session: EditorSession): Promise<boolean> {
    switch (message.command) {
      case 'getDisplayConfigs':
        await this.handleGetDisplayConfigs(session.webviewPanel);
        return true;

      case 'loadDisplayConfig':
        await this.handleLoadDisplayConfig(message.configId, session);
        return true;

      case 'promptSaveDisplayConfig':
        await this.handlePromptSaveDisplayConfig(message, session);
        return true;

      case 'saveDisplayConfig':
        await this.handleSaveDisplayConfig(message, session.webviewPanel, session.key);
        return true;

      case 'getCurrentDisplaySettings':
        await this.handleGetCurrentDisplaySettings(session.webviewPanel, session.key);
        return true;

      case 'updateDisplaySettings':
        this.handleUpdateDisplaySettings(message.settings, session.key);
        return true;

      case 'exportDisplayConfigs':
        await this.handleExportDisplayConfigs(session.webviewPanel);
        return true;

      case 'importDisplayConfigs':
        await this.handleImportDisplayConfigs(session.webviewPanel);
        return true;

      case 'confirmDeleteDisplayConfig':
        await this.handleConfirmDeleteDisplayConfig(message.configId as string, session.webviewPanel);
        return true;

      case 'deleteDisplayConfig':
        await this.handleDeleteDisplayConfig(message.configId as string, session.webviewPanel);
        return true;

      default:
        return false;
    }
  }

  private undoLastEdit(session: EditorSession) {
    const { renderer, trajectoryManager: traj, undoManager: undo } = session;
    if (undo.isEmpty) {
      return;
    }
    const previous = undo.pop();
    if (!previous) {
      return;
    }
    traj.updateActiveFrame(previous);
    renderer.setStructure(previous);
    renderer.setShowUnitCell(!!previous.unitCell);
    renderer.deselectAtom();
    renderer.deselectBond();
    this.renderStructure(session);
  }

  private renderStructure(session: EditorSession) {
    const { renderer, trajectoryManager: traj, webviewPanel } = session;
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);
    const message = renderer.getRenderMessage();

    // Include current display settings in render message
    if (session.displaySettings) {
      message.displaySettings = session.displaySettings;
    }

    webviewPanel.webview.postMessage(message);
  }

  private async saveStructure(session: EditorSession) {
    const { key, trajectoryManager: traj } = session;
    try {
      await StructureDocumentManager.save(key, traj.activeStructure, traj.frames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleSaveStructureAs(session: EditorSession) {
    const { key, trajectoryManager: traj } = session;
    const structureToSave = traj.activeStructure;
    const trajectoryFrames = traj.frames;

    const formatOptions = [
      { id: 'cif', label: 'CIF (.cif)' },
      { id: 'xyz', label: 'XYZ (.xyz)' },
      { id: 'xdatcar', label: 'XDATCAR (.xdatcar)' },
      { id: 'poscar', label: 'POSCAR' },
      { id: 'vasp', label: 'VASP (.vasp)' },
      { id: 'pdb', label: 'PDB (.pdb)' },
      { id: 'gjf', label: 'Gaussian input (.gjf)' },
      { id: 'inp', label: 'ORCA input (.inp)' },
      { id: 'in', label: 'QE input (.in)' },
      { id: 'stru', label: 'ABACUS STRU (.stru)' },
    ];
    const selected = await vscode.window.showQuickPick(formatOptions, {
      placeHolder: 'Select export format',
      matchOnDescription: true,
      ignoreFocusOut: true,
    });
    if (!selected) {
      return;
    }
    const selectedFormat = selected.id;
    let exportFrames: Structure[] = [structureToSave];
    if ((selectedFormat === 'xyz' || selectedFormat === 'xdatcar') && trajectoryFrames.length > 1) {
      const chosen = await StructureDocumentManager.pickTrajectoryExportFrames(
        trajectoryFrames,
        structureToSave,
        traj.activeIndex,
        selectedFormat.toUpperCase()
      );
      if (!chosen) {
        return;
      }
      exportFrames = chosen;
    }

    const defaultFileName = StructureDocumentManager.defaultSaveAsFileName(key, selectedFormat);
    const isPoscarFormat = ['poscar', 'vasp'].includes(selectedFormat.toLowerCase());
    const saveOptions: vscode.SaveDialogOptions = {
      saveLabel: 'Save Structure As',
      defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(key)), defaultFileName),
    };
    if (!isPoscarFormat) {
      saveOptions.filters = {
        'Structure Files': [selectedFormat],
      };
    }

    const uri = await vscode.window.showSaveDialog(saveOptions);
    if (!uri) {
      return;
    }
    try {
      await StructureDocumentManager.saveAs(uri, exportFrames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const csp = `default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src ${webview.cspSource}`;
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview', 'styles.css')
    );
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'webview.js')
    );

    const templatePath = path.join(this.context.extensionPath, 'media', 'webview', 'index.html');
    let html = fs.readFileSync(templatePath, 'utf8');
    html = html.replace(/\{\{csp\}\}/g, csp);
    html = html.replace(/\{\{stylesUri\}\}/g, styleUri.toString());
    html = html.replace(/\{\{webviewUri\}\}/g, webviewUri.toString());
    return html;
  }

  saveCustomDocument(
    document: StructureDocument,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<void> {
    const session = this.sessions.get(document.uri.fsPath);
    return session ? this.saveStructure(session) : Promise.resolve();
  }

  async saveCustomDocumentAs(
    document: StructureDocument,
    destination: vscode.Uri,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const session = this.sessions.get(document.uri.fsPath);
    if (!session) {
      return;
    }
    const traj = session.trajectoryManager;
    const format = FileManager.resolveFormat(destination.fsPath, 'xyz');
    try {
      let exportFrames: Structure[] = [traj.activeStructure];
      if ((format === 'xyz' || format === 'xdatcar') && traj.frameCount > 1) {
        const chosen = await StructureDocumentManager.pickTrajectoryExportFrames(
          traj.frames,
          traj.activeStructure,
          traj.activeIndex,
          format.toUpperCase()
        );
        if (!chosen) {
          return;
        }
        exportFrames = chosen;
      }
      await StructureDocumentManager.saveAs(destination, exportFrames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to export structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  revertCustomDocument(
    document: StructureDocument,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<void> {
    return Promise.resolve();
  }

  backupCustomDocument(
    document: vscode.CustomDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellationToken: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    const backupUri = context.destination;
    return Promise.resolve({
      id: backupUri.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(backupUri, { useTrash: false });
        } catch {
          // Ignore delete errors for missing or already-removed backups.
        }
      },
    });
  }

  // === Display Configuration Methods ===

  async notifyConfigChange(config: DisplayConfig): Promise<void> {
    // Only notify the currently active webview panel.
    // Broadcasting to all panels would overwrite per-editor config choices.
    for (const session of this.sessions.values()) {
      if (session.webviewPanel.active) {
        session.displaySettings = config.settings;
        session.webviewPanel.webview.postMessage({
          command: 'displayConfigChanged',
          config: config
        });
        return;
      }
    }
    // Fallback: if no panel is active, notify the most recently opened one
    const sessions = Array.from(this.sessions.values());
    if (sessions.length > 0) {
      const session = sessions[sessions.length - 1];
      session.displaySettings = config.settings;
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigChanged',
        config: config
      });
    }
  }

  async getCurrentDisplaySettings(): Promise<DisplaySettings | null> {
    // Get settings from the first available webview
    for (const session of this.sessions.values()) {
      if (session.displaySettings) {
        return session.displaySettings;
      }
    }
    return null;
  }

  private async handleGetDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      const configs = await this.configManager.listConfigs();
      webviewPanel.webview.postMessage({
        command: 'displayConfigsLoaded',
        presets: configs.presets,
        user: configs.user
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleLoadDisplayConfig(configId: string, session: EditorSession): Promise<void> {
    try {
      const config = await this.configManager.loadConfig(configId);
      session.displaySettings = config.settings;
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigLoaded',
        config: config
      });
    } catch (error) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleSaveDisplayConfig(
    message: any,
    webviewPanel: vscode.WebviewPanel,
    key: string
  ): Promise<void> {
    try {
      const config = await this.configManager.saveUserConfig(
        message.name,
        message.settings,
        message.description,
        message.existingId
      );
      webviewPanel.webview.postMessage({
        command: 'displayConfigSaved',
        config: config
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handlePromptSaveDisplayConfig(
    message: any,
    session: EditorSession
  ): Promise<void> {
    const messageSettings = message.settings as DisplaySettings | undefined;
    const settings = messageSettings || session.displaySettings;
    if (!settings) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: 'No display settings available to save'
      });
      return;
    }

    const name = await vscode.window.showInputBox({
      prompt: 'Enter configuration name',
      placeHolder: 'My Display Config'
    });
    if (!name) { return; }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter description (optional)',
      placeHolder: 'Description of this configuration'
    });

    try {
      const config = await this.configManager.saveUserConfig(
        name,
        settings,
        description || undefined
      );
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigSaved',
        config: config
      });
      await this.handleGetDisplayConfigs(session.webviewPanel);
    } catch (error) {
      session.webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleGetCurrentDisplaySettings(
    webviewPanel: vscode.WebviewPanel,
    key: string
  ): Promise<void> {
    const settings = this.sessions.get(key)?.displaySettings;
    if (settings) {
      webviewPanel.webview.postMessage({
        command: 'currentDisplaySettings',
        settings: settings
      });
    }
  }

  private handleUpdateDisplaySettings(settings: DisplaySettings, key: string): void {
    const session = this.sessions.get(key);
    if (session) {
      session.displaySettings = settings;
    }
  }

  private async handleExportDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      const configs = await this.configManager.listConfigs();
      const allConfigs = [...configs.presets, ...configs.user];
      const items = allConfigs.map(c => ({
        label: c.name,
        description: c.isPreset ? 'Preset' : 'User Config',
        picked: false,
        id: c.id
      }));

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select configurations to export'
      });

      if (!selected || selected.length === 0) { return; }
      await this.configManager.exportConfigs(selected.map(s => s.id!));
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleImportDisplayConfigs(webviewPanel: vscode.WebviewPanel): Promise<void> {
    try {
      await this.configManager.importConfigs();
      // Refresh the config list in the webview after import
      await this.handleGetDisplayConfigs(webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleConfirmDeleteDisplayConfig(configId: string, webviewPanel: vscode.WebviewPanel): Promise<void> {
    if (!configId) { return; }
    try {
      const configs = await this.configManager.listConfigs();
      const target = configs.user.find((c) => c.id === configId);
      if (!target) {
        vscode.window.showErrorMessage('Only user configurations can be deleted');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete "${target.name}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') { return; }

      await this.handleDeleteDisplayConfig(configId, webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }

  private async handleDeleteDisplayConfig(configId: string, webviewPanel: vscode.WebviewPanel): Promise<void> {
    if (!configId) { return; }
    try {
      await this.configManager.deleteConfig(configId);
      // Refresh the config list in the webview after deletion
      await this.handleGetDisplayConfigs(webviewPanel);
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'displayConfigError',
        error: String(error)
      });
    }
  }
}
