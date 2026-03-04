// Shared type declarations for the ACoord webview
//
// Data types that travel over postMessage are defined once in the shared
// protocol and re-exported here under their short names so the rest of
// the webview code can keep using `Atom`, `Bond`, etc. unchanged.

import type {
  WireAtom,
  WireBond,
  WireUnitCellEdge,
  WireUnitCellParams,
  WireUnitCell,
  WireLightConfig,
  WireDisplaySettings,
  WireConfigEntry,
  WireRenderData,
} from '../../../src/shared/protocol';

// Re-export wire types under the short names used throughout the webview.
export type Atom = WireAtom;
export type Bond = WireBond;
export type UnitCellEdge = WireUnitCellEdge;
export type UnitCellParams = WireUnitCellParams;
export type UnitCell = WireUnitCell;
export type LightConfig = WireLightConfig;
export type DisplaySettings = WireDisplaySettings;
export type ConfigEntry = WireConfigEntry;

/**
 * `Structure` is the data shape stored by the webview after receiving a
 * render message.  It is now identical to `WireRenderData`.
 */
export type Structure = WireRenderData;

export interface AvailableConfigs {
  presets: ConfigEntry[];
  user: ConfigEntry[];
}

export interface AppState {
  currentStructure: Structure | null;
  currentSelectedAtom: Atom | null;
  currentSelectedBondKey: string | null;
  selectedBondKeys: string[];
  selectedAtomIds: string[];
  isDragging: boolean;
  dragAtomId: string | null;
  adsorptionReferenceId: string | null;
  adsorptionAdsorbateIds: string[];
  manualScale: number;
  autoScaleEnabled: boolean;
  atomSizeScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  projectionMode: string;
  scaleAtomsWithLattice: boolean;
  supercell: [number, number, number];
  unitCellEditing: boolean;
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
  groupMoveActive: boolean;
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
  trajectoryPlaying: boolean;
  trajectoryPlaybackFps: number;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;
  rotationInProgress: boolean;

  // Display settings
  showAxes: boolean;
  backgroundColor: string;
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: string;
  atomSizeUseDefaultSettings: boolean;
  atomSizeGlobal: number;
  atomSizeByElement: Record<string, number>;
  atomSizeByAtom: Record<string, number>;
  atomSizeElementExpanded: boolean;
  shininess: number;

  // Lighting settings
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  keyLight: LightConfig;
  fillLight: LightConfig;
  rimLight: LightConfig;

  // Configuration management
  currentConfigId: string;
  currentConfigName: string;
  availableConfigs: AvailableConfigs;
  isLoadingConfig: boolean;

  // Methods
  extractDisplaySettings(): DisplaySettings;
  applyDisplaySettings(settings: DisplaySettings): void;
}

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

// =============================================================================
// Domain-specific context interfaces (replacing the monolithic AppCallbacks)
// =============================================================================

/** VSCode communication context */
export interface VscodeContext {
  vscode: VsCodeApi;
}

/** Error handling context */
export interface ErrorContext {
  setError: (message: string) => void;
}

/** Rendering and UI update context */
export interface RendererContext {
  renderer: import('./renderer').RendererApi;
  rerenderCurrentStructure: () => void;
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}

/** Atom size management context */
export interface AtomSizeContext {
  clampAtomSize: (value: unknown, fallback: number) => number;
  getBaseAtomId: (atomId: string) => string;
  getCurrentStructureAtoms: () => Atom[];
  getAvailableElements: () => string[];
  hasAtomSizeOverride: (atomId: string) => boolean;
  hasElementSizeOverride: (element: string) => boolean;
  getAtomSizeForAtomId: (atomId: string) => number;
  getAtomSizeForElement: (element: string) => number;
  getFallbackRadiusForAtom: (atom: Atom | null) => number;
  cleanupAtomSizeOverrides: () => void;
  ATOM_SIZE_MIN: number;
  ATOM_SIZE_MAX: number;
}

/** Selection management context */
export interface SelectionContext {
  getSelectedBondKeys: () => string[];
  setSelectedBondSelection: (keys: string[], syncBackend: boolean) => void;
}

/** Transformation operations context */
export interface TransformContext {
  applyBondAngle: (targetDeg: number) => void;
  applyRotation: (angleDeg: number, preview: boolean) => void;
  applyAdsorptionDistance: (target: number, preview: boolean) => void;
  updateMeasurements: () => void;
  updateAdsorptionUI: () => void;
  resetRotationBase?: () => void;
}

/** Atom editing context */
export interface EditContext {
  normalizeHexColor: (value: string) => string | null;
  applySelectedAtomChanges: () => void;
  deleteSelectedAtoms?: () => boolean;
}

export interface RendererHandlers {
  setError: (message: string) => void;
  setStatus: (message: string) => void;
}

export interface UiHooks {
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}

/**
 * Legacy monolithic callbacks interface.
 * @deprecated Use domain-specific contexts (VscodeContext, RendererContext, etc.) instead.
 */
export interface AppCallbacks
  extends VscodeContext,
    ErrorContext,
    RendererContext,
    AtomSizeContext,
    SelectionContext,
    TransformContext,
    EditContext {
  /** @deprecated Access state directly or through specific store modules */
  state: AppState;
}
