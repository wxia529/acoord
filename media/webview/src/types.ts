// Shared type declarations for the ACoord webview

export interface Atom {
  id: string;
  element: string;
  color: string;
  position: [number, number, number];
  radius: number;
  selected?: boolean;
  selectable?: boolean;
}

export interface Bond {
  key?: string;
  atomId1?: string;
  atomId2?: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
  color1?: string;
  color2?: string;
  selected?: boolean;
}

export interface UnitCellEdge {
  start: [number, number, number];
  end: [number, number, number];
}

export interface UnitCellParams {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface UnitCell {
  edges: UnitCellEdge[];
}

export interface Structure {
  atoms: Atom[];
  bonds?: Bond[];
  renderAtoms?: Atom[];
  renderBonds?: Bond[];
  unitCell?: UnitCell;
  unitCellParams?: UnitCellParams;
  selectedAtomId?: string;
  selectedAtomIds?: string[];
  selectedBondKeys?: string[];
  selectedBondKey?: string;
  supercell?: [number, number, number];
  trajectoryFrameIndex?: number;
  trajectoryFrameCount?: number;
}

export interface LightConfig {
  intensity: number;
  color: string;
  x: number;
  y: number;
  z: number;
  position?: { x: number; y: number; z: number };
}

export interface NormalizedLightConfig {
  intensity: number;
  color: string;
  position: { x: number; y: number; z: number };
}

export interface DisplaySettings {
  showAxes?: boolean;
  backgroundColor?: string;
  unitCellColor?: string;
  unitCellThickness?: number;
  unitCellLineStyle?: string;
  atomSizeUseDefaultSettings?: boolean;
  atomSizeGlobal?: number;
  atomSizeByElement?: Record<string, number>;
  atomSizeByAtom?: Record<string, number>;
  manualScale?: number;
  autoScaleEnabled?: boolean;
  atomSizeScale?: number;
  bondThicknessScale?: number;
  viewZoom?: number;
  scaleAtomsWithLattice?: boolean;
  projectionMode?: string;
  lightingEnabled?: boolean;
  ambientIntensity?: number;
  ambientColor?: string;
  shininess?: number;
  keyLight?: LightConfig | NormalizedLightConfig;
  fillLight?: LightConfig | NormalizedLightConfig;
  rimLight?: LightConfig | NormalizedLightConfig;
}

export interface ConfigEntry {
  id: string;
  name: string;
  description?: string;
  settings?: DisplaySettings;
}

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

export interface RendererHandlers {
  setError: (message: string) => void;
  setStatus: (message: string) => void;
}

export interface UiHooks {
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}

export interface AppCallbacks {
  vscode: VsCodeApi;
  state: AppState;
  renderer: import('./renderer').RendererApi;
  setError: (message: string) => void;
  rerenderCurrentStructure: () => void;
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
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
  getSelectedBondKeys: () => string[];
  setSelectedBondSelection: (keys: string[], syncBackend: boolean) => void;
  normalizeHexColor: (value: string) => string | null;
  applySelectedAtomChanges: () => void;
  applyBondAngle: (targetDeg: number) => void;
  applyRotation: (angleDeg: number, preview: boolean) => void;
  applyAdsorptionDistance: (target: number, preview: boolean) => void;
  updateMeasurements: () => void;
  updateAdsorptionUI: () => void;
  resetRotationBase?: () => void;
  deleteSelectedAtoms?: () => boolean;
}
