// ============================================================================
// acoord-3d - Atomic structure 3D rendering engine
// ============================================================================

export { createRenderer } from './renderer/factory.js';
export type { 
  RendererApi, 
  RendererHandlers, 
  UiHooks 
} from './renderer/types.js';

export type { StoreProvider } from './state/provider.js';
export { 
  setStoreProvider, 
  getStructureStore, 
  getDisplayStore, 
  getLightingStore 
} from './state/provider.js';

export type {
  StructureState,
  DisplayState,
  LightingState,
  SelectionState,
  InteractionState,
} from './state/store.js';

export type {
  Atom,
  Bond,
  Structure,
  UnitCell,
  UnitCellEdge,
  UnitCellParams,
  LightConfig,
  DisplaySettings,
} from './types/wire.js';

export { debounce, throttle } from './utils/performance.js';
