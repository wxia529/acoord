import { StructureRenderer } from './renderer.js';
import { type StoreProvider, setStoreProvider } from '../state/provider.js';
import type { RendererHandlers } from './types.js';
import type * as THREE from 'three';

export interface CreateRendererOptions {
  canvas: HTMLCanvasElement;
  providers?: StoreProvider;
  onError?: (message: string) => void;
  onStatus?: (message: string) => void;
  onCameraChange?: (quaternion: THREE.Quaternion) => void;
}

/**
 * Creates a new structure renderer instance.
 * 
 * @param options - Renderer configuration options
 * @returns A new StructureRenderer instance
 * 
 * @example
 * ```typescript
 * const renderer = createRenderer({
 *   canvas: document.getElementById('canvas'),
 *   providers: {
 *     structure: structureStore,
 *     display: displayStore,
 *     lighting: lightingStore,
 *   },
 *   onCameraChange: (quat) => axisIndicator.update(quat),
 * });
 * ```
 */
export function createRenderer(options: CreateRendererOptions) {
  // Inject custom state provider if provided
  if (options.providers) {
    setStoreProvider(options.providers);
  }
  
  const handlers: RendererHandlers = {
    setError: options.onError || console.error,
    setStatus: options.onStatus || (() => {}),
  };
  
  const renderer = new StructureRenderer(handlers);
  renderer.init(options.canvas);
  
  // Setup camera change callback
  if (options.onCameraChange) {
    renderer.addOnCameraMove(() => {
      const camera = renderer.getCamera();
      options.onCameraChange!(camera.quaternion);
    });
  }
  
  return renderer;
}
