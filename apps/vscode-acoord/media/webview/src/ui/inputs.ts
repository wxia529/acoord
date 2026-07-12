import { structureStore, selectionStore } from '../state';
import { getAtomById } from '../utils/measurements';
import { getAdsorptionReference } from '../utils/transformations';
import type { Atom } from '../types';
import { formatSelectedAtomIndices } from '../utils/atomSelection';

export function updatePropertiesPanel(): void {
  const noSelection = document.getElementById('properties-no-selection');
  const singleAtom = document.getElementById('properties-single-atom');
  const multiAtom = document.getElementById('properties-multi-atom');
  const singleBond = document.getElementById('properties-single-bond');

  if (!noSelection || !singleAtom || !multiAtom || !singleBond) { return; }

  const selectedAtomIds = selectionStore.selectedAtomIds || [];
  const selectedBondKeys = selectionStore.selectedBondKeys || [];
  const selectedAtoms = selectedAtomIds.map(getAtomById).filter((atom): atom is Atom => atom !== null);
  const selectionIndices = document.getElementById('selected-atom-indices') as HTMLInputElement | null;
  const zeroBasedSelectionIndices = document.getElementById('selected-atom-indices-zero') as HTMLInputElement | null;
  const copySelectionButton = document.getElementById('btn-copy-atom-indices') as HTMLButtonElement | null;
  const copyZeroBasedButton = document.getElementById('btn-copy-atom-indices-zero') as HTMLButtonElement | null;
  const atomIds = structureStore.currentStructure?.atoms.map((atom) => atom.id) ?? [];
  const formattedSelection = formatSelectedAtomIndices(atomIds, selectedAtomIds);
  const zeroBasedSelection = formatSelectedAtomIndices(atomIds, selectedAtomIds, 0);
  if (selectionIndices) selectionIndices.value = formattedSelection;
  if (zeroBasedSelectionIndices) zeroBasedSelectionIndices.value = zeroBasedSelection;
  if (copySelectionButton) copySelectionButton.disabled = formattedSelection.length === 0;
  if (copyZeroBasedButton) copyZeroBasedButton.disabled = zeroBasedSelection.length === 0;
  const realAtomCount = selectedAtoms.filter((atom) => !atom.role || atom.role === 'real').length;
  const dummySelection = document.getElementById('dummy-atom-selection');
  const dummyButton = document.getElementById('btn-insert-dummy') as HTMLButtonElement | null;
  const centerMode = document.getElementById('dummy-center-mode') as HTMLSelectElement | null;
  if (dummySelection) {
    dummySelection.textContent = selectedAtomIds.length === 0
      ? 'Select one or more atoms'
      : `Selected: ${selectedAtomIds.length} (${realAtomCount} real)`;
  }
  if (dummyButton) dummyButton.disabled = selectedAtomIds.length === 0;
  if (centerMode) {
    const massOption = centerMode.querySelector('option[value="mass"]') as HTMLOptionElement | null;
    if (massOption) massOption.disabled = realAtomCount === 0;
    if (realAtomCount === 0 && centerMode.value === 'mass') centerMode.value = 'geometry';
  }

  noSelection.style.display = 'none';
  singleAtom.style.display = 'none';
  multiAtom.style.display = 'none';
  singleBond.style.display = 'none';

  if (selectedAtomIds.length === 1) {
    singleAtom.style.display = 'block';
  } else if (selectedAtomIds.length > 1) {
    multiAtom.style.display = 'block';
    const countEl = document.getElementById('multi-atom-count');
    const breakdownEl = document.getElementById('multi-atom-breakdown');
    if (countEl) {
      countEl.textContent = String(selectedAtomIds.length);
    }
    if (breakdownEl) {
      const elementCounts = new Map<string, number>();
      for (const atomId of selectedAtomIds) {
        const atom = getAtomById(atomId);
        if (atom) {
          const count = elementCounts.get(atom.element) || 0;
          elementCounts.set(atom.element, count + 1);
        }
      }
      const parts = Array.from(elementCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([element, count]) => `${element}: ${count}`);
      breakdownEl.textContent = parts.join(', ');
    }
  } else if (selectedBondKeys.length === 1) {
    singleBond.style.display = 'block';
  } else {
    noSelection.style.display = 'block';
  }
}

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
  const fx = document.getElementById('sel-fx') as HTMLInputElement | null;
  const fy = document.getElementById('sel-fy') as HTMLInputElement | null;
  const fz = document.getElementById('sel-fz') as HTMLInputElement | null;
  const disabled = !atom;
  if (el) el.disabled = disabled || atom?.role === 'ghost';
  if (x) x.disabled = disabled;
  if (y) y.disabled = disabled;
  if (z) z.disabled = disabled;
  if (fx) fx.disabled = disabled || !atom?.fractionalPosition;
  if (fy) fy.disabled = disabled || !atom?.fractionalPosition;
  if (fz) fz.disabled = disabled || !atom?.fractionalPosition;
  if (!atom) {
    if (el) el.value = '';
    if (x) x.value = '';
    if (y) y.value = '';
    if (z) z.value = '';
    if (fx) fx.value = '';
    if (fy) fy.value = '';
    if (fz) fz.value = '';
    return;
  }
  if (el) el.value = atom.displayLabel ?? atom.element;
  if (x) x.value = atom.position[0].toFixed(4);
  if (y) y.value = atom.position[1].toFixed(4);
  if (z) z.value = atom.position[2].toFixed(4);
  if (fx) fx.value = atom.fractionalPosition?.[0].toFixed(6) ?? '';
  if (fy) fy.value = atom.fractionalPosition?.[1].toFixed(6) ?? '';
  if (fz) fz.value = atom.fractionalPosition?.[2].toFixed(6) ?? '';
}

export function updateAtomColorPreview(): void {
  const atomColorPicker = document.getElementById('atom-color-picker') as HTMLInputElement | null;
  const atomColorText = document.getElementById('atom-color-text') as HTMLInputElement | null;
  const toolbarColorPicker = document.getElementById('toolbar-color-picker') as HTMLInputElement | null;
  if (!atomColorPicker || !atomColorText) { return; }

  let previewColor: string | null = null;
  if (structureStore.currentSelectedAtom && structureStore.currentSelectedAtom.color) {
    previewColor = normalizeHexColor(structureStore.currentSelectedAtom.color);
  }
  if (!previewColor && selectionStore.selectedAtomIds && selectionStore.selectedAtomIds.length > 0) {
    const focusAtomId = selectionStore.selectedAtomIds[selectionStore.selectedAtomIds.length - 1];
    const atom = getAtomById(focusAtomId);
    if (atom && atom.color) {
      previewColor = normalizeHexColor(atom.color);
    }
  }
  if (!previewColor) { return; }
  atomColorPicker.value = previewColor;
  atomColorText.value = previewColor;
  if (toolbarColorPicker) toolbarColorPicker.value = previewColor;
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

export function applySelectedAtomChanges(
  vscode: { postMessage: (msg: unknown) => void },
  coordinateMode: 'cartesian' | 'fractional' = 'cartesian'
): void {
  if (!structureStore.currentSelectedAtom) return;
  const el = (document.getElementById('sel-element') as HTMLInputElement | null)?.value.trim() ?? '';
  if (coordinateMode === 'fractional') {
    const fx = parseFloat((document.getElementById('sel-fx') as HTMLInputElement | null)?.value ?? '');
    const fy = parseFloat((document.getElementById('sel-fy') as HTMLInputElement | null)?.value ?? '');
    const fz = parseFloat((document.getElementById('sel-fz') as HTMLInputElement | null)?.value ?? '');
    if (!Number.isFinite(fx) || !Number.isFinite(fy) || !Number.isFinite(fz)) return;
    vscode.postMessage({
      command: 'updateAtom',
      atomId: structureStore.currentSelectedAtom.id,
      element: el || structureStore.currentSelectedAtom.element,
      fractionalPosition: [fx, fy, fz],
    });
    return;
  }

  const x = parseFloat((document.getElementById('sel-x') as HTMLInputElement | null)?.value ?? '');
  const y = parseFloat((document.getElementById('sel-y') as HTMLInputElement | null)?.value ?? '');
  const z = parseFloat((document.getElementById('sel-z') as HTMLInputElement | null)?.value ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  vscode.postMessage({
    command: 'updateAtom',
    atomId: structureStore.currentSelectedAtom.id,
    element: el || structureStore.currentSelectedAtom.element,
    x, y, z,
  });
}
