// Display Configuration Types
// Defines all interfaces for the display configuration system

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface LightConfig {
  intensity: number;
  color: string;
  position: Position3D;
}

// Display Settings - Core configuration data
// This is the extension-side runtime type that extends the wire type
import type { WireDisplaySettings } from '../shared/protocol';

export interface DisplaySettings extends Required<WireDisplaySettings> {
  // Make all wire fields required in the extension
  showAxes: boolean;
  backgroundColor: string;
  unitCellColor: string;
  unitCellThickness: number;
  unitCellLineStyle: 'solid' | 'dashed';
  atomSizeUseDefaultSettings: boolean;
  atomSizeGlobal: number;
  atomSizeByElement: Record<string, number>;
  atomSizeByAtom: Record<string, number>;
  manualScale: number;
  autoScaleEnabled: boolean;
  atomSizeScale: number;
  bondThicknessScale: number;
  viewZoom: number;
  scaleAtomsWithLattice: boolean;
  projectionMode: 'orthographic' | 'perspective';
  lightingEnabled: boolean;
  ambientIntensity: number;
  ambientColor: string;
  shininess: number;
  keyLight: {
    intensity: number;
    color: string;
    x: number;
    y: number;
    z: number;
  };
  fillLight: {
    intensity: number;
    color: string;
    x: number;
    y: number;
    z: number;
  };
  rimLight: {
    intensity: number;
    color: string;
    x: number;
    y: number;
    z: number;
  };
}

// Display Configuration Object
export interface DisplayConfig {
  id: string;
  name: string;
  description?: string;
  isPreset: boolean;
  isReadOnly: boolean;
  version: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  settings: DisplaySettings;
}

// Configuration Manifest
export interface ConfigManifest {
  version: string;
  schemaVersion: number;
  lastUpdated: string;
  configs: ConfigMeta[];
}

export interface ConfigMeta {
  id: string;
  name: string;
  isPreset: boolean;
  version: number;
  schemaVersion: number;
  updatedAt: number;
}

// Export Package for Import/Export
export interface ConfigExportPackage {
  version: string;
  exportedAt: string;
  exportedFrom: string;
  configs: DisplayConfig[];
}

// Configuration Change Event
export interface ConfigChangeEvent {
  type: 'loaded' | 'saved' | 'deleted' | 'imported' | 'migrated';
  configId: string;
  timestamp: number;
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Migration Interface
export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate: (config: DisplayConfig) => Promise<DisplayConfig>;
}
