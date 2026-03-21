// Type definitions for acoord-3d
// Re-export types from vscode-acoord shared protocol

export interface WireAtom {
  id: string;
  element: string;
  color: string;
  position: [number, number, number];
  radius: number;
  selected?: boolean;
  selectable?: boolean;
  fixed?: boolean;
}

export interface WireBond {
  key: string;
  atomId1: string;
  atomId2: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
  color1?: string;
  color2?: string;
  selected?: boolean;
  periodicStub?: true;
}

export interface WireUnitCellEdge {
  start: [number, number, number];
  end: [number, number, number];
  radius?: number;
  color?: string;
}

export interface WireUnitCell {
  corners?: [number, number, number][];
  edges: WireUnitCellEdge[];
}

export interface WireUnitCellParams {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}

export interface WireLightConfig {
  intensity: number;
  color: string;
  x: number;
  y: number;
  z: number;
}

export type BondSchemeId = 'all' | 'no-sf-shell';

export interface WireDisplaySettings {
  showAxes?: boolean;
  backgroundColor?: string;
  unitCellColor?: string;
  unitCellThickness?: number;
  unitCellLineStyle?: 'solid' | 'dashed';
  currentColorScheme?: string;
  currentRadiusScale?: number;
  currentColorByElement?: Record<string, string>;
  currentRadiusByElement?: Record<string, number>;
  manualScale?: number;
  autoScaleEnabled?: boolean;
  bondThicknessScale?: number;
  bondScheme?: BondSchemeId;
  viewZoom?: number;
  scaleAtomsWithLattice?: boolean;
  projectionMode?: 'orthographic' | 'perspective';
  lightingEnabled?: boolean;
  ambientIntensity?: number;
  ambientColor?: string;
  shininess?: number;
  keyLight?: WireLightConfig;
  fillLight?: WireLightConfig;
  rimLight?: WireLightConfig;
}

export interface WireRenderData {
  atoms: WireAtom[];
  bonds: WireBond[];
  renderAtoms: WireAtom[];
  renderBonds: WireBond[];
  unitCell: WireUnitCell | null;
  unitCellParams: WireUnitCellParams | null;
  supercell: [number, number, number];
  selectedAtomId?: string;
  selectedAtomIds: string[];
  selectedBondKey?: string;
  selectedBondKeys: string[];
  trajectoryFrameIndex: number;
  trajectoryFrameCount: number;
}

// Type aliases for backward compatibility
export type Atom = WireAtom;
export type Bond = WireBond;
export type UnitCellEdge = WireUnitCellEdge;
export type UnitCellParams = WireUnitCellParams;
export type UnitCell = WireUnitCell;
export type LightConfig = WireLightConfig;
export type DisplaySettings = WireDisplaySettings;
export type Structure = WireRenderData;

export interface UiHooks {
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}
