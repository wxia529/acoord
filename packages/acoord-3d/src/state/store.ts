// =============================================================================
// Domain-specific stores for acoord-3d
// =============================================================================

import type { Structure, LightConfig, Atom } from '../types/wire.js';

// ─────────────────────────────────────────────────────────────────────────────
// Structure Store
// ─────────────────────────────────────────────────────────────────────────────
export interface StructureState {
  currentStructure: Structure | null;
  currentSelectedAtom: Atom | null;
  currentSelectedBondKey: string | null;
}

export const defaultStructureStore: StructureState = {
  currentStructure: null,
  currentSelectedAtom: null,
  currentSelectedBondKey: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Selection Store
// ─────────────────────────────────────────────────────────────────────────────
export interface SelectionState {
  selectedAtomIds: string[];
  selectedBondKeys: string[];
}

export const defaultSelectionStore: SelectionState = {
  selectedAtomIds: [],
  selectedBondKeys: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Display Store
// ─────────────────────────────────────────────────────────────────────────────
export interface DisplayState {
  showAxes: boolean;
  backgroundColor: string;
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: 'solid' | 'dashed';
  currentRadiusByElement: Record<string, number>;
  atomSizeElementExpanded: boolean;
  shininess: number;
  manualScale: number;
  autoScaleEnabled: boolean;
  currentRadiusScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  scaleAtomsWithLattice: boolean;
  projectionMode: 'orthographic' | 'perspective';
  supercell: [number, number, number];
  unitCellEditing: boolean;
  currentColorScheme: string;
  currentColorByElement: Record<string, string>;
}

export const defaultDisplayStore: DisplayState = {
  showAxes: true,
  backgroundColor: '#0d1015',
  unitCellColor: '#FF6600',
  unitCellThickness: 1,
  unitCellLineStyle: 'solid',
  currentRadiusByElement: {},
  atomSizeElementExpanded: false,
  shininess: 50,
  manualScale: 1,
  autoScaleEnabled: false,
  currentRadiusScale: 1,
  bondThicknessScale: 1,
  viewZoom: 1,
  scaleAtomsWithLattice: false,
  projectionMode: 'orthographic',
  supercell: [1, 1, 1],
  unitCellEditing: false,
  currentColorScheme: '',
  currentColorByElement: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Lighting Store
// ─────────────────────────────────────────────────────────────────────────────
export interface LightingState {
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  keyLight: LightConfig;
  fillLight: LightConfig;
  rimLight: LightConfig;
}

export const defaultLightingStore: LightingState = {
  lightingEnabled: true,
  ambientIntensity: 0.5,
  ambientColor: '#ffffff',
  keyLight: { intensity: 0.7, x: 0, y: 0, z: 10, color: '#CCCCCC' },
  fillLight: { intensity: 0, x: -10, y: -5, z: 5, color: '#ffffff' },
  rimLight: { intensity: 0, x: 0, y: 5, z: -10, color: '#ffffff' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Interaction Store
// ─────────────────────────────────────────────────────────────────────────────
export type BoxSelectionMode = 'atoms' | 'bonds' | 'both';
export type ToolType = 'select' | 'add' | 'delete';

export interface InteractionState {
  isDragging: boolean;
  dragAtomId: string | null;
  lastDragWorld: { x: number; y: number; z: number } | null;
  dragPlaneNormal: { x: number; y: number; z: number } | null;
  rotationAxis: string;
  rotationInProgress: boolean;
  groupMoveActive: boolean;
  renderAtomOffsets: Record<string, [number, number, number]>;
  shouldFitCamera: boolean;
  addingAtomElement: string | null;
  boxSelectionMode: BoxSelectionMode;
  currentTool: ToolType;
  rightDragType: 'none' | 'camera' | 'rotate' | 'move';
  rightDragStart: { x: number; y: number } | null;
  rightDragMoved: boolean;
  rightDragRotationBase: { id: string; pos: [number, number, number] }[] | null;
  rightDragRotationPivot: [number, number, number] | null;
  rightDragRotationAccumulatedDelta: { x: number; y: number } | null;
  rightDragLastDelta: { x: number; y: number } | null;
}

export const defaultInteractionStore: InteractionState = {
  isDragging: false,
  dragAtomId: null,
  lastDragWorld: null,
  dragPlaneNormal: null,
  rotationAxis: 'z',
  rotationInProgress: false,
  groupMoveActive: false,
  renderAtomOffsets: {},
  shouldFitCamera: true,
  addingAtomElement: null,
  boxSelectionMode: 'atoms',
  currentTool: 'select',
  rightDragType: 'none',
  rightDragStart: null,
  rightDragMoved: false,
  rightDragRotationBase: null,
  rightDragRotationPivot: null,
  rightDragRotationAccumulatedDelta: null,
  rightDragLastDelta: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Trajectory Store
// ─────────────────────────────────────────────────────────────────────────────
export interface TrajectoryState {
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
  trajectoryPlaying: boolean;
  trajectoryPlaybackFps: number;
}

export const defaultTrajectoryStore: TrajectoryState = {
  trajectoryFrameIndex: 0,
  trajectoryFrameCount: 1,
  trajectoryPlaying: false,
  trajectoryPlaybackFps: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Adsorption Store
// ─────────────────────────────────────────────────────────────────────────────
export interface AdsorptionState {
  adsorptionReferenceId: string | null;
  adsorptionAdsorbateIds: string[];
}

export const defaultAdsorptionStore: AdsorptionState = {
  adsorptionReferenceId: null,
  adsorptionAdsorbateIds: [],
};
