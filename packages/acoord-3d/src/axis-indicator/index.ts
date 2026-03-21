/**
 * Axis indicator stub module.
 * TODO: Implement full axis indicator functionality.
 */

import * as THREE from 'three';

let _visible = true;

export function init(): void {
  // Stub initialization
}

export function update(quaternion: THREE.Quaternion): void {
  // Stub update
}

export function setVisible(visible: boolean): void {
  _visible = visible;
}

export function isVisible(): boolean {
  return _visible;
}

export function dispose(): void {
  // Stub cleanup
}
