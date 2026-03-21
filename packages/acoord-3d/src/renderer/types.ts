import type * as THREE from 'three';
import type { Structure, Atom } from '../types/wire.js';

export interface RendererHandlers {
  setError: (message: string) => void;
  setStatus: (message: string) => void;
}

export interface UiHooks {
  updateCounts: (atomCount: number, bondCount: number) => void;
  updateAtomList: (atoms: Atom[], selectedIds: string[], selectedId: string | null) => void;
}

export interface RendererApi {
  init(canvas: HTMLCanvasElement): void;
  renderStructure(structure: Structure, hooks?: Partial<UiHooks>, options?: { fitCamera?: boolean }): void;
  fitCamera(): void;
  setProjectionMode(mode: 'orthographic' | 'perspective'): void;
  snapCameraToAxis(axis: string): void;
  getScale(): number;
  getRaycaster(): THREE.Raycaster;
  getMouse(): THREE.Vector2;
  getCamera(): THREE.Camera;
  getAtomMeshes(): Map<string, THREE.Mesh>;
  getBondMeshes(): THREE.Mesh[];
  getDragPlane(): THREE.Plane;
  setControlsEnabled(enabled: boolean): void;
  setOnCameraMove(callback: (() => void) | null): void;
  updateLighting(): void;
  updateDisplaySettings(): void;
  exportHighResolutionImage(options?: { scale?: number }): { dataUrl: string; width: number; height: number } | null;
  updateAtomPosition(atomId: string, position: THREE.Vector3): void;
  markDirty(): void;
  rotateCameraBy(axis: string, angleDeg: number): void;
  dispose(): void;
}
