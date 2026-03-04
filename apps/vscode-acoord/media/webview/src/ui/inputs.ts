import { state } from '../state';
import { getAtomById } from '../utils/measurements';
import { getAdsorptionReference } from '../utils/transformations';
import type { Atom } from '../types';

export function normalizeHexColor(value: string): string | null {
  if (typeof value !== 'string') { return null; }
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) { return null; }
  return trimmed.toUpperCase();
}

export function updateSelectedInputs(atom: Atom | null): void {
  const el = document.getElementById('sel-element') as HTMLInputElement | null;
  const x = document.getElementById('sel-x') as HTMLInputElement | null;
  const y = document.getElementById('sel-y') as HTMLInputElement | null;
  const z = document.getElementById('sel-z') as HTMLInputElement | null;
  const disabled = !atom;
  if (el) el.disabled = disabled;
  if (x) x.disabled = disabled;
  if (y) y.disabled = disabled;
  if (z) z.disabled = disabled;
  if (!atom) {
    if (el) el.value = '';
    if (x) x.value = '';
    if (y) y.value = '';
    if (z) z.value = '';
    return;
  }
  if (el) el.value = atom.element;
  if (x) x.value = atom.position[0].toFixed(4);
  if (y) y.value = atom.position[1].toFixed(4);
  if (z) z.value = atom.position[2].toFixed(4);
}

export function updateAtomColorPreview(): void {
  const atomColorPicker = document.getElementById('atom-color-picker') as HTMLInputElement | null;
  const atomColorText = document.getElementById('atom-color-text') as HTMLInputElement | null;
  if (!atomColorPicker || !atomColorText) { return; }

  let previewColor: string | null = null;
  if (state.currentSelectedAtom && state.currentSelectedAtom.color) {
    previewColor = normalizeHexColor(state.currentSelectedAtom.color);
  }
  if (!previewColor && state.selectedAtomIds && state.selectedAtomIds.length > 0) {
    const focusAtomId = state.selectedAtomIds[state.selectedAtomIds.length - 1];
    const atom = getAtomById(focusAtomId);
    if (atom && atom.color) {
      previewColor = normalizeHexColor(atom.color);
    }
  }
  if (!previewColor) { return; }
  atomColorPicker.value = previewColor;
  atomColorText.value = previewColor;
}

export function updateAdsorptionUI(): void {
  const refEl = document.getElementById('adsorption-ref') as HTMLElement | null;
  const distEl = document.getElementById('adsorption-distance') as HTMLElement | null;
  const slider = document.getElementById('adsorption-slider') as HTMLInputElement | null;
  const input = document.getElementById('adsorption-input') as HTMLInputElement | null;
  const ref = getAdsorptionReference();
  if (!ref) {
    if (refEl) refEl.textContent = '--';
    if (distEl) distEl.textContent = '--';
    if (slider) slider.value = '0';
    if (input) input.value = '';
    return;
  }
  if (refEl) refEl.textContent = ref.reference.element + ' vs ' + ref.anchor.element;
  if (distEl) distEl.textContent = ref.distance.toFixed(4);
  if (slider) slider.value = ref.distance.toFixed(2);
  if (input) input.value = ref.distance.toFixed(4);
}

export function applySelectedAtomChanges(vscode: { postMessage: (msg: unknown) => void }): void {
  if (!state.currentSelectedAtom) return;
  const el = (document.getElementById('sel-element') as HTMLInputElement | null)?.value.trim() ?? '';
  const x = parseFloat((document.getElementById('sel-x') as HTMLInputElement | null)?.value ?? '');
  const y = parseFloat((document.getElementById('sel-y') as HTMLInputElement | null)?.value ?? '');
  const z = parseFloat((document.getElementById('sel-z') as HTMLInputElement | null)?.value ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  vscode.postMessage({
    command: 'updateAtom',
    atomId: state.currentSelectedAtom.id,
    element: el || state.currentSelectedAtom.element,
    x, y, z,
  });
}