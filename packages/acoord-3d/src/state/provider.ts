import type { 
  StructureState, 
  DisplayState, 
  LightingState,
} from './store.js';

import {
  defaultStructureStore,
  defaultDisplayStore,
  defaultLightingStore,
} from './store.js';

export interface StoreProvider {
  structure: StructureState;
  display: DisplayState;
  lighting: LightingState;
}

let _customProvider: StoreProvider | null = null;

/**
 * Sets a custom store provider for dependency injection.
 * This allows external state management (e.g., VS Code webview).
 * 
 * @param provider - Custom store provider
 */
export function setStoreProvider(provider: StoreProvider): void {
  _customProvider = provider;
}

export function getStructureStore(): StructureState {
  return _customProvider?.structure ?? defaultStructureStore;
}

export function getDisplayStore(): DisplayState {
  return _customProvider?.display ?? defaultDisplayStore;
}

export function getLightingStore(): LightingState {
  return _customProvider?.lighting ?? defaultLightingStore;
}
