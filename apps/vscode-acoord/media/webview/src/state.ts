import type { AppState, LightConfig, DisplaySettings, AvailableConfigs } from './types';

/** Default display settings used when a loaded config omits a field. */
const DISPLAY_DEFAULTS: Required<DisplaySettings> = {
  showAxes: true,
  backgroundColor: '#0d1015',
  unitCellColor: '#FF6600',
  unitCellThickness: 1,
  unitCellLineStyle: 'solid',
  atomSizeUseDefaultSettings: true,
  atomSizeGlobal: 0.3,
  atomSizeByElement: {},
  atomSizeByAtom: {},
  manualScale: 1,
  autoScaleEnabled: false,
  atomSizeScale: 1,
  bondThicknessScale: 1,
  viewZoom: 1,
  scaleAtomsWithLattice: false,
  projectionMode: 'orthographic',
  lightingEnabled: true,
  ambientIntensity: 0.5,
  ambientColor: '#ffffff',
  shininess: 50,
  keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
  fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
  rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
};

function flattenLight(light: LightConfig | { intensity: number; color: string; position: { x: number; y: number; z: number } }): LightConfig {
  const pos = (light as { position?: { x: number; y: number; z: number } }).position;
  if (pos && typeof pos.x === 'number') {
    return { intensity: light.intensity, color: light.color, x: pos.x, y: pos.y, z: pos.z };
  }
  const flat = light as LightConfig;
  return { intensity: flat.intensity, color: flat.color, x: flat.x ?? 0, y: flat.y ?? 0, z: flat.z ?? 0 };
}

export const state: AppState = {
  currentStructure: null,
  currentSelectedAtom: null,
  currentSelectedBondKey: null,
  selectedBondKeys: [],
  selectedAtomIds: [],
  isDragging: false,
  dragAtomId: null,
  adsorptionReferenceId: null,
  adsorptionAdsorbateIds: [],
  manualScale: 1,
  autoScaleEnabled: false,
  atomSizeScale: 1,
  bondThicknessScale: 1,
  viewZoom: 1,
  projectionMode: 'orthographic',
  scaleAtomsWithLattice: false,
  supercell: [1, 1, 1],
  unitCellEditing: false,
  renderAtomOffsets: {},
  shouldFitCamera: true,
  groupMoveActive: false,
  trajectoryFrameIndex: 0,
  trajectoryFrameCount: 1,
  trajectoryPlaying: false,
  trajectoryPlaybackFps: 8,
  lastDragWorld: null,
  dragPlaneNormal: null,
  rotationAxis: 'z',
  rotationInProgress: false,

  // Display settings
  showAxes: true,
  backgroundColor: '#0d1015',
  unitCellColor: '#FF6600',
  unitCellThickness: 1,
  unitCellLineStyle: 'solid',
  atomSizeUseDefaultSettings: true,
  atomSizeGlobal: 0.3,
  atomSizeByElement: {},
  atomSizeByAtom: {},
  atomSizeElementExpanded: false,
  shininess: 50,

  // Lighting settings
  lightingEnabled: true,
  ambientIntensity: 0.5,
  ambientColor: '#ffffff',
  keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
  fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
  rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },

  // Configuration management
  currentConfigId: 'preset-default',
  currentConfigName: 'Default',
  availableConfigs: { presets: [], user: [] },
  isLoadingConfig: false,

  extractDisplaySettings(): DisplaySettings {
    const flattenToSettings = (light: LightConfig | undefined): LightConfig => {
      if (!light) return { intensity: 0, color: '#ffffff', x: 0, y: 0, z: 0 };
      return { intensity: light.intensity, color: light.color, x: light.x, y: light.y, z: light.z };
    };

    return {
      showAxes: this.showAxes,
      backgroundColor: this.backgroundColor,
      unitCellColor: this.unitCellColor,
      unitCellThickness: this.unitCellThickness,
      unitCellLineStyle: this.unitCellLineStyle,
      atomSizeUseDefaultSettings: this.atomSizeUseDefaultSettings,
      atomSizeGlobal: this.atomSizeGlobal,
      atomSizeByElement: this.atomSizeByElement,
      atomSizeByAtom: this.atomSizeByAtom,
      manualScale: this.manualScale,
      autoScaleEnabled: this.autoScaleEnabled,
      atomSizeScale: this.atomSizeScale,
      bondThicknessScale: this.bondThicknessScale,
      viewZoom: this.viewZoom,
      scaleAtomsWithLattice: this.scaleAtomsWithLattice,
      projectionMode: this.projectionMode,
      lightingEnabled: this.lightingEnabled,
      ambientIntensity: this.ambientIntensity,
      ambientColor: this.ambientColor,
      shininess: this.shininess,
      keyLight: flattenToSettings(this.keyLight),
      fillLight: flattenToSettings(this.fillLight),
      rimLight: flattenToSettings(this.rimLight),
    };
  },

  applyDisplaySettings(settings: DisplaySettings): void {
    if (!settings) return;
    const d = DISPLAY_DEFAULTS;
    this.showAxes = settings.showAxes ?? d.showAxes;
    this.backgroundColor = settings.backgroundColor ?? d.backgroundColor;
    this.unitCellColor = settings.unitCellColor ?? d.unitCellColor;
    this.unitCellThickness = settings.unitCellThickness ?? d.unitCellThickness;
    this.unitCellLineStyle = settings.unitCellLineStyle ?? d.unitCellLineStyle;
    this.atomSizeUseDefaultSettings = settings.atomSizeUseDefaultSettings ?? d.atomSizeUseDefaultSettings;
    this.atomSizeGlobal = settings.atomSizeGlobal ?? d.atomSizeGlobal;
    this.atomSizeByElement = settings.atomSizeByElement ?? d.atomSizeByElement;
    this.atomSizeByAtom = settings.atomSizeByAtom ?? d.atomSizeByAtom;
    this.manualScale = settings.manualScale ?? d.manualScale;
    this.autoScaleEnabled = settings.autoScaleEnabled ?? d.autoScaleEnabled;
    this.atomSizeScale = settings.atomSizeScale ?? d.atomSizeScale;
    this.bondThicknessScale = settings.bondThicknessScale ?? d.bondThicknessScale;
    this.viewZoom = settings.viewZoom ?? d.viewZoom;
    this.scaleAtomsWithLattice = settings.scaleAtomsWithLattice ?? d.scaleAtomsWithLattice;
    this.projectionMode = settings.projectionMode ?? d.projectionMode;
    this.lightingEnabled = settings.lightingEnabled ?? d.lightingEnabled;
    this.ambientIntensity = settings.ambientIntensity ?? d.ambientIntensity;
    this.ambientColor = settings.ambientColor ?? d.ambientColor;
    this.shininess = settings.shininess ?? d.shininess;
    this.keyLight = settings.keyLight ? flattenLight(settings.keyLight) : { ...d.keyLight };
    this.fillLight = settings.fillLight ? flattenLight(settings.fillLight) : { ...d.fillLight };
    this.rimLight = settings.rimLight ? flattenLight(settings.rimLight) : { ...d.rimLight };
  },
};
