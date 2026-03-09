/**
 * View tab module.
 *
 * Wires: Projection selector, Axis View buttons (a/b/c/-a/-b/-c),
 *        Rotation panel (tilt/rotate/roll buttons + angle input).
 *
 * setup() must be called once during app initialisation.
 */
import { displayStore } from './state';
import { renderer } from './renderer';

export function setup(): void {
  // ── Projection select ──────────────────────────────────────────────────────

  const projSelect = document.getElementById('proj-select') as HTMLSelectElement | null;
  const setProjection = (mode: string) => {
    const next = mode === 'orthographic' ? 'orthographic' : 'perspective';
    displayStore.projectionMode = next;
    if (projSelect) { projSelect.value = next; }
    renderer.setProjectionMode(next);
    renderer.fitCamera();
  };

  if (projSelect) {
    projSelect.addEventListener('change', (event: Event) => { setProjection((event.target as HTMLSelectElement).value); });
  }
  setProjection(displayStore.projectionMode || 'perspective');

  // ── Axis view buttons ──────────────────────────────────────────────────────

  for (const axis of ['a', 'b', 'c', '-a', '-b', '-c']) {
    const id = 'btn-view-' + (axis.startsWith('-') ? 'n' + axis.slice(1) : axis);
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => { renderer.snapCameraToAxis(axis); });
    }
  }

  for (const axis of ['a', 'b', 'c']) {
    const btn = document.getElementById(`btn-toolbar-view-${axis}`) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => { renderer.snapCameraToAxis(axis); });
    }
  }

  // ── Rotation panel ─────────────────────────────────────────────────────────

  const angleInput = document.getElementById('rot-angle') as HTMLInputElement | null;

  const getAngle = (): number => {
    const v = parseFloat(angleInput?.value ?? '15');
    return Number.isFinite(v) && v > 0 ? v : 15;
  };

  const rotButtons: Array<[string, string]> = [
    ['btn-rot-tilt-up',   'tiltUp'],
    ['btn-rot-tilt-down', 'tiltDown'],
    ['btn-rot-left',      'rotateLeft'],
    ['btn-rot-right',     'rotateRight'],
    ['btn-rot-roll-ccw',  'rollCCW'],
    ['btn-rot-roll-cw',   'rollCW'],
  ];

  for (const [id, axis] of rotButtons) {
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => { renderer.rotateCameraBy(axis, getAngle()); });
    }
  }
}
