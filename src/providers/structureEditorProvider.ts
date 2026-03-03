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

/**
 * Custom editor provider for structure files
 */
export class StructureEditorProvider implements vscode.CustomEditorProvider<StructureDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructureDocument> |
      vscode.CustomDocumentContentChangeEvent<StructureDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  private webviewPanels = new Map<string, vscode.WebviewPanel>();
  private renderers = new Map<string, ThreeJSRenderer>();
  private trajectoryManagers = new Map<string, TrajectoryManager>();
  private undoManagers = new Map<string, UndoManager>();
  private displaySettings = new Map<string, DisplaySettings>();

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
    this.trajectoryManagers.set(key, traj);
    this.undoManagers.set(key, new UndoManager());
    this.webviewPanels.set(key, webviewPanel);

    const renderer = new ThreeJSRenderer(traj.activeStructure);
    renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);
    this.renderers.set(key, renderer);

    // Load default display config
    const defaultConfig = this.configManager.getCurrentConfig();
    if (defaultConfig) {
      this.displaySettings.set(key, defaultConfig.settings);
    }

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
          const t = this.trajectoryManagers.get(key);
          if (t) { t.set(updatedFrames, idx); }
          this.undoManagers.get(key)?.clear();
          renderer.setStructure(updatedFrames[idx]);
          renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
          renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    // Initial render
    this.renderStructure(key, webviewPanel);

    // Cleanup on close
    webviewPanel.onDidDispose(() => {
      this.webviewPanels.delete(key);
      this.renderers.delete(key);
      this.trajectoryManagers.delete(key);
      this.undoManagers.delete(key);
      this.displaySettings.delete(key);
      saveListener.dispose();
    });
  }

  private async handleWebviewMessage(
    message: any,
    key: string,
    webviewPanel: vscode.WebviewPanel
  ) {
    const renderer = this.renderers.get(key);
    const traj = this.trajectoryManagers.get(key);
    const undo = this.undoManagers.get(key);
    if (!renderer || !traj) {
      return;
    }
    const structure = traj.activeStructure;

    switch (message.command) {
      case 'getState':
        this.renderStructure(key, webviewPanel);
        break;

      case 'setTrajectoryFrame': {
        if (traj.frameCount <= 1) {
          break;
        }
        const requestedIndex = Number(message.frameIndex);
        if (!Number.isFinite(requestedIndex)) {
          break;
        }
        const nextIndex = Math.max(0, Math.min(traj.frameCount - 1, Math.floor(requestedIndex)));
        traj.setActiveIndex(nextIndex);
        const nextStructure = traj.activeStructure;
        renderer.setStructure(nextStructure);
        renderer.setShowUnitCell(!!nextStructure.unitCell);
        renderer.setTrajectoryFrameInfo(nextIndex, traj.frameCount);
        renderer.deselectAtom();
        renderer.deselectBond();
        undo?.clear();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'beginDrag':
        if (message.atomId) {
          undo?.push(structure);
        }
        break;

      case 'addAtom': {
        const element = parseElement(String(message.element || ''));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          break;
        }
        const atom = new Atom(
          element,
          message.x || 0,
          message.y || 0,
          message.z || 0
        );
        undo?.push(structure);
        structure.addAtom(atom);
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'deleteAtom': {
        if (message.atomId) {
          undo?.push(structure);
          structure.removeAtom(message.atomId);
          renderer.setStructure(structure);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        }
        break;
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
          break;
        }
        undo?.push(structure);
        for (const atomId of ids) {
          structure.removeAtom(atomId);
        }
        renderer.setStructure(structure);
        renderer.deselectAtom();
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

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
          this.renderStructure(key, webviewPanel);
        }
        break;
      }

      case 'setSelection': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        renderer.setSelection(ids);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
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
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setBondSelection': {
        const keys: string[] = Array.isArray(message.bondKeys)
          ? message.bondKeys.filter((k: unknown) => typeof k === 'string')
          : [];
        renderer.setBondSelection(keys);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'toggleUnitCell': {
        renderer.setShowUnitCell(
          !renderer.getState().showUnitCell
        );
        this.renderStructure(key, webviewPanel);
        break;
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
          break;
        }

        undo?.push(structure);
        const oldCell = structure.unitCell;
        const nextCell = new UnitCell(a, b, c, alpha, beta, gamma);
        if (message.scaleAtoms && oldCell) {
          for (const atom of structure.atoms) {
            const frac = oldCell.cartesianToFractional(atom.x, atom.y, atom.z);
            const cart = nextCell.fractionalToCartesian(frac[0], frac[1], frac[2]);
            atom.setPosition(cart[0], cart[1], cart[2]);
          }
        }
        structure.unitCell = nextCell;
        structure.isCrystal = true;
        if (!structure.supercell) {
          structure.supercell = [1, 1, 1];
        }
        renderer.setStructure(structure);
        renderer.setShowUnitCell(true);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'clearUnitCell': {
        undo?.push(structure);
        structure.unitCell = undefined;
        structure.isCrystal = false;
        structure.supercell = [1, 1, 1];
        renderer.setStructure(structure);
        renderer.setShowUnitCell(false);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'centerToUnitCell': {
        if (!structure.unitCell) {
          vscode.window.showErrorMessage('Centering requires a unit cell.');
          break;
        }
        if (structure.atoms.length === 0) {
          break;
        }
        const confirm = await vscode.window.showWarningMessage(
          'Center all atoms in the unit cell? This will move every atom.',
          { modal: true },
          'Center'
        );
        if (confirm !== 'Center') {
          break;
        }
        undo?.push(structure);
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const atom of structure.atoms) {
          cx += atom.x;
          cy += atom.y;
          cz += atom.z;
        }
        const count = structure.atoms.length;
        const geomCenter: [number, number, number] = [cx / count, cy / count, cz / count];
        const vectors = structure.unitCell.getLatticeVectors();
        const cellCenter: [number, number, number] = [
          0.5 * (vectors[0][0] + vectors[1][0] + vectors[2][0]),
          0.5 * (vectors[0][1] + vectors[1][1] + vectors[2][1]),
          0.5 * (vectors[0][2] + vectors[1][2] + vectors[2][2]),
        ];
        const dx = cellCenter[0] - geomCenter[0];
        const dy = cellCenter[1] - geomCenter[1];
        const dz = cellCenter[2] - geomCenter[2];
        structure.translate(dx, dy, dz);
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setSupercell': {
        const sc = Array.isArray(message.supercell) ? message.supercell : [1, 1, 1];
        const nx = Math.max(1, Math.floor(Number(sc[0]) || 1));
        const ny = Math.max(1, Math.floor(Number(sc[1]) || 1));
        const nz = Math.max(1, Math.floor(Number(sc[2]) || 1));
        if (!structure.unitCell) {
          structure.supercell = [1, 1, 1];
        } else {
          structure.supercell = [nx, ny, nz];
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'moveAtom': {
        if (message.atomId) {
          const atom = structure.getAtom(message.atomId);
          if (atom) {
            atom.setPosition(message.x, message.y, message.z);
            renderer.setStructure(structure);
            if (!message.preview) {
              this.renderStructure(key, webviewPanel);
            }
          }
        }
        break;
      }

      case 'moveGroup': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length > 0) {
          for (const id of ids) {
            const atom = structure.getAtom(id);
            if (atom) {
              atom.setPosition(atom.x + message.dx, atom.y + message.dy, atom.z + message.dz);
            }
          }
          renderer.setStructure(structure);
          if (!message.preview) {
            this.renderStructure(key, webviewPanel);
          }
        }
        break;
      }

      case 'setAtomsPositions': {
        const updates: Array<{ id: string; x: number; y: number; z: number }> =
          Array.isArray(message.atomPositions) ? message.atomPositions : [];
        if (updates.length === 0) {
          break;
        }
        for (const update of updates) {
          const atom = structure.getAtom(update.id);
          if (atom) {
            atom.setPosition(update.x, update.y, update.z);
          }
        }
        renderer.setStructure(structure);
        if (!message.preview) {
          this.renderStructure(key, webviewPanel);
        }
        break;
      }

      case 'endDrag': {
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setBondLength': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length >= 2 && typeof message.length === 'number') {
          const atomA = structure.getAtom(ids[0]);
          const atomB = structure.getAtom(ids[1]);
          if (atomA && atomB) {
            undo?.push(structure);
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
              renderer.setStructure(structure);
              this.renderStructure(key, webviewPanel);
            }
          }
        }
        break;
      }

      case 'copyAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0) {
          break;
        }
        const offset = message.offset || { x: 0.5, y: 0.5, z: 0.5 };
        undo?.push(structure);
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (!atom) {
            continue;
          }
          const copy = new Atom(
            atom.element,
            atom.x + (offset.x || 0),
            atom.y + (offset.y || 0),
            atom.z + (offset.z || 0)
          );
          structure.addAtom(copy);
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'changeAtoms': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length === 0 || !message.element) {
          break;
        }
        undo?.push(structure);
        const element = parseElement(String(message.element));
        if (!element) {
          vscode.window.showErrorMessage(`Unknown element: ${message.element}`);
          break;
        }
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (atom) {
            atom.element = element;
          }
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'setAtomColor': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        const color = typeof message.color === 'string' ? message.color.trim() : '';
        if (ids.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
          break;
        }
        undo?.push(structure);
        for (const id of ids) {
          const atom = structure.getAtom(id);
          if (atom) {
            atom.color = color;
          }
        }
        renderer.setStructure(structure);
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'createBond': {
        const ids: string[] = Array.isArray(message.atomIds) ? message.atomIds : [];
        if (ids.length < 2) {
          break;
        }
        const atomId1 = ids[0];
        const atomId2 = ids[1];
        if (!structure.getAtom(atomId1) || !structure.getAtom(atomId2) || atomId1 === atomId2) {
          break;
        }
        undo?.push(structure);
        structure.addManualBond(atomId1, atomId2);
        renderer.setStructure(structure);
        renderer.selectBond(Structure.bondKey(atomId1, atomId2));
        this.renderStructure(key, webviewPanel);
        break;
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
          break;
        }
        undo?.push(structure);
        for (const pair of selectedPairs) {
          structure.removeBond(pair[0], pair[1]);
        }
        renderer.setStructure(structure);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'recalculateBonds': {
        undo?.push(structure);
        structure.manualBonds = [];
        structure.suppressedAutoBonds = [];
        renderer.setStructure(structure);
        renderer.deselectBond();
        this.renderStructure(key, webviewPanel);
        break;
      }

      case 'updateAtom': {
        if (message.atomId) {
          const atom = structure.getAtom(message.atomId);
          if (atom) {
            undo?.push(structure);
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
            renderer.setStructure(structure);
            this.renderStructure(key, webviewPanel);
          }
        }
        break;
      }

      case 'undo': {
        this.undoLastEdit(key, webviewPanel);
        break;
      }

      case 'saveStructure': {
        await this.saveStructure(key);
        break;
      }

      case 'saveStructureAs': {
        await this.handleSaveStructureAs(key, webviewPanel);
        break;
      }

      case 'saveRenderedImage': {
        const dataUrl = typeof message.dataUrl === 'string' ? message.dataUrl : '';
        const imageMatch = dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!imageMatch || !imageMatch[1]) {
          const reason = 'Failed to export image: invalid PNG data.';
          vscode.window.showErrorMessage(reason);
          webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
          break;
        }

        const rawName =
          typeof message.suggestedName === 'string' && message.suggestedName.trim()
            ? message.suggestedName.trim()
            : `structure-hd-${Date.now()}.png`;
        const fileName = rawName.toLowerCase().endsWith('.png') ? rawName : `${rawName}.png`;
        const saveUri = await vscode.window.showSaveDialog({
          saveLabel: 'Save HD Image',
          defaultUri: vscode.Uri.joinPath(vscode.Uri.file(path.dirname(key)), fileName),
          filters: {
            'PNG Image': ['png'],
          },
        });

        if (!saveUri) {
          break;
        }

        try {
          const bytes = Buffer.from(imageMatch[1], 'base64');
          await vscode.workspace.fs.writeFile(saveUri, bytes);
          const savedName = path.basename(saveUri.fsPath);
          vscode.window.showInformationMessage(`Image exported to ${savedName}`);
          webviewPanel.webview.postMessage({
            command: 'imageSaved',
            data: { fileName: savedName },
          });
        } catch (error) {
          const reason = `Failed to export image: ${error instanceof Error ? error.message : String(error)}`;
          vscode.window.showErrorMessage(reason);
          webviewPanel.webview.postMessage({ command: 'imageSaveFailed', data: { reason } });
        }
        break;
      }

      case 'openSource': {
        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(key));
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open source: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'reloadStructure': {
        try {
          const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(key));
          const content = new TextDecoder().decode(fileContent);
          const updatedFrames = FileManager.loadStructures(key, content);
          if (!updatedFrames || updatedFrames.length === 0) {
            break;
          }
          const idx = TrajectoryManager.defaultFrameIndex(updatedFrames);
          traj.set(updatedFrames, idx);
          undo?.clear();
          renderer.setStructure(updatedFrames[idx]);
          renderer.setTrajectoryFrameInfo(idx, updatedFrames.length);
          renderer.setShowUnitCell(!!updatedFrames[idx].unitCell);
          renderer.deselectAtom();
          renderer.deselectBond();
          this.renderStructure(key, webviewPanel);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        break;
      }

      case 'getDisplayConfigs': {
        await this.handleGetDisplayConfigs(webviewPanel);
        break;
      }

      case 'loadDisplayConfig': {
        await this.handleLoadDisplayConfig(message.configId, webviewPanel, key);
        break;
      }

      case 'saveDisplayConfig': {
        await this.handleSaveDisplayConfig(message, webviewPanel, key);
        break;
      }

      case 'getCurrentDisplaySettings': {
        await this.handleGetCurrentDisplaySettings(webviewPanel, key);
        break;
      }

      case 'updateDisplaySettings': {
        this.handleUpdateDisplaySettings(message.settings, key);
        break;
      }
    }
  }

  private undoLastEdit(key: string, webviewPanel: vscode.WebviewPanel) {
    const undo = this.undoManagers.get(key);
    const renderer = this.renderers.get(key);
    const traj = this.trajectoryManagers.get(key);
    if (!undo || undo.isEmpty || !renderer || !traj) {
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
    this.renderStructure(key, webviewPanel);
  }

  private renderStructure(
    key: string,
    webviewPanel: vscode.WebviewPanel
  ) {
    const renderer = this.renderers.get(key);
    const traj = this.trajectoryManagers.get(key);
    if (renderer && traj) {
      renderer.setTrajectoryFrameInfo(traj.activeIndex, traj.frameCount);
      const message = renderer.getRenderMessage();

      // Include current display settings in render message
      const displaySettings = this.displaySettings.get(key);
      if (displaySettings) {
        message.displaySettings = displaySettings;
      }

      webviewPanel.webview.postMessage(message);
    }
  }

  private async saveStructure(key: string) {
    const traj = this.trajectoryManagers.get(key);
    if (!traj) {
      return;
    }
    try {
      await StructureDocumentManager.save(key, traj.activeStructure, traj.frames);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleSaveStructureAs(key: string, _webviewPanel: vscode.WebviewPanel) {
    const traj = this.trajectoryManagers.get(key);
    if (!traj) {
      return;
    }
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
    return this.saveStructure(document.uri.fsPath);
  }

  async saveCustomDocumentAs(
    document: StructureDocument,
    destination: vscode.Uri,
    _cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    const traj = this.trajectoryManagers.get(document.uri.fsPath);
    if (!traj) {
      return;
    }
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
    for (const [key, webviewPanel] of this.webviewPanels) {
      if (webviewPanel.active) {
        this.displaySettings.set(key, config.settings);
        webviewPanel.webview.postMessage({
          command: 'displayConfigChanged',
          config: config
        });
        return;
      }
    }
    // Fallback: if no panel is active, notify the most recently opened one
    const entries = Array.from(this.webviewPanels.entries());
    if (entries.length > 0) {
      const [key, webviewPanel] = entries[entries.length - 1];
      this.displaySettings.set(key, config.settings);
      webviewPanel.webview.postMessage({
        command: 'displayConfigChanged',
        config: config
      });
    }
  }

  async getCurrentDisplaySettings(): Promise<DisplaySettings | null> {
    // Get settings from the first available webview
    for (const [, settings] of this.displaySettings) {
      return settings;
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

  private async handleLoadDisplayConfig(
    configId: string,
    webviewPanel: vscode.WebviewPanel,
    key: string
  ): Promise<void> {
    try {
      const config = await this.configManager.loadConfig(configId);
      this.displaySettings.set(key, config.settings);
      webviewPanel.webview.postMessage({
        command: 'displayConfigLoaded',
        config: config
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
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

  private async handleGetCurrentDisplaySettings(
    webviewPanel: vscode.WebviewPanel,
    key: string
  ): Promise<void> {
    const settings = this.displaySettings.get(key);
    if (settings) {
      webviewPanel.webview.postMessage({
        command: 'currentDisplaySettings',
        settings: settings
      });
    }
  }

  private handleUpdateDisplaySettings(settings: DisplaySettings, key: string): void {
    this.displaySettings.set(key, settings);
  }
}
