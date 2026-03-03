/**
 * View tab module.
 *
 * Wires: Projection selector, Axis View buttons (a/b/c/-a/-b/-c).
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { state } from './state';
import { renderer } from './renderer';
import type { AppCallbacks } from './types';

export function setup(_cb: AppCallbacks): void {
  // ── Projection select ──────────────────────────────────────────────────────

  const projSelect = document.getElementById('proj-select') as HTMLSelectElement | null;
  const setProjection = (mode: string) => {
    const next = mode === 'orthographic' ? 'orthographic' : 'perspective';
    state.projectionMode = next;
    if (projSelect) { projSelect.value = next; }
    renderer.setProjectionMode(next);
    renderer.fitCamera();
  };

  if (projSelect) {
    projSelect.onchange = (event: Event) => { setProjection((event.target as HTMLSelectElement).value); };
  }
  setProjection(state.projectionMode || 'perspective');

  // ── Axis view buttons ──────────────────────────────────────────────────────

  for (const axis of ['a', 'b', 'c', '-a', '-b', '-c']) {
    const id = 'btn-view-' + (axis.startsWith('-') ? 'n' + axis.slice(1) : axis);
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => { renderer.snapCameraToAxis(axis); });
    }
  }
}
