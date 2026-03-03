import { state } from './state';
import { renderer } from './renderer';
import * as configHandler from './configHandler';
import * as appTrajectory from './appTrajectory';
import { setup as setupEdit } from './appEdit';
import { setup as setupLattice, updateLatticeUI, updateAtomSizePanel } from './appLattice';
import { setup as setupView } from './appView';
import { setup as setupTools } from './appTools';
import { init as initInteraction } from './interaction';
import { initVscode as initInteractionConfigVscode } from './interactionConfig';
import { updateConfigSelector } from './interactionConfig';
import type { Atom, Structure, VsCodeApi, AppCallbacks } from './types';

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
let renderStatus = 'Ready.';
let statusSelectionLock = false;
let lastStatusSelectedId: string | null = null;
const ATOM_SIZE_MIN = 0.1;
const ATOM_SIZE_MAX = 2.0;

function setError(message: string): void {
  const banner = document.getElementById('error-banner') as HTMLElement | null;
  if (!banner) { return; }
  banner.textContent = message || '';
  banner.style.display = message ? 'block' : 'none';
}

function setStatus(message: string): void {
  renderStatus = message || 'Ready.';
  updateStatusBar();
}

function updateStatusBar(force?: boolean): void {
  const statusEl = document.getElementById('status-text') as HTMLElement | null;
  if (!statusEl) return;
  const selected = state.currentSelectedAtom;
  const selectedId = selected ? selected.id : null;
  if (!force && statusSelectionLock && selectedId === lastStatusSelectedId) {
    return;
  }
  if (!selected) {
    statusEl.textContent = renderStatus;
    lastStatusSelectedId = null;
    return;
  }

  const cart = selected.position || [0, 0, 0];
  const cartText = `Cart: ${cart[0].toFixed(4)}, ${cart[1].toFixed(4)}, ${cart[2].toFixed(4)}`;
  const frac = getFractionalCoords(cart, state.currentStructure && state.currentStructure.unitCellParams);
  const fracText = frac
    ? ` | Frac: ${frac[0].toFixed(4)}, ${frac[1].toFixed(4)}, ${frac[2].toFixed(4)}`
    : '';
  statusEl.textContent = `${renderStatus} | Selected: ${selected.element} | ${cartText}${fracText}`;
  lastStatusSelectedId = selectedId;
}

function syncStatusSelectionLock(): void {
  const selection = document.getSelection();
  const statusBar = document.getElementById('status-bar') as HTMLElement | null;
  if (!selection || !statusBar || selection.isCollapsed) {
    statusSelectionLock = false;
    return;
  }
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  statusSelectionLock =
    (!!anchor && statusBar.contains(anchor)) ||
    (!!focus && statusBar.contains(focus));
}

function getFractionalCoords(
  cart: [number, number, number],
  cell: { a: number; b: number; c: number; alpha: number; beta: number; gamma: number } | null | undefined
): [number, number, number] | null {
  if (!cell) return null;
  const a = Number(cell.a);
  const b = Number(cell.b);
  const c = Number(cell.c);
  const alpha = Number(cell.alpha) * Math.PI / 180;
  const beta = Number(cell.beta) * Math.PI / 180;
  const gamma = Number(cell.gamma) * Math.PI / 180;
  if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) return null;
  const sinGamma = Math.sin(gamma);
  if (Math.abs(sinGamma) < 1e-8) return null;

  const cosAlpha = Math.cos(alpha);
  const cosBeta = Math.cos(beta);
  const cosGamma = Math.cos(gamma);

  const ax = a, ay = 0, az = 0;
  const bx = b * cosGamma, by = b * sinGamma, bz = 0;
  const cx = c * cosBeta;
  const cy = c * (cosAlpha - cosBeta * cosGamma) / sinGamma;
  const czSquared = c * c - cx * cx - cy * cy;
  if (czSquared <= 0) return null;
  const cz = Math.sqrt(czSquared);

  const matrix: [[number, number, number], [number, number, number], [number, number, number]] = [
    [ax, bx, cx],
    [ay, by, cy],
    [az, bz, cz],
  ];
  const inverse = invert3x3(matrix);
  if (!inverse) return null;
  const fx = inverse[0][0] * cart[0] + inverse[0][1] * cart[1] + inverse[0][2] * cart[2];
  const fy = inverse[1][0] * cart[0] + inverse[1][1] * cart[1] + inverse[1][2] * cart[2];
  const fz = inverse[2][0] * cart[0] + inverse[2][1] * cart[1] + inverse[2][2] * cart[2];
  return [fx, fy, fz];
}

function invert3x3(
  m: [[number, number, number], [number, number, number], [number, number, number]]
): [[number, number, number], [number, number, number], [number, number, number]] | null {
  const a = m[0][0], b = m[0][1], c = m[0][2];
  const d = m[1][0], e = m[1][1], f = m[1][2];
  const g = m[2][0], h = m[2][1], i = m[2][2];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
}

function normalizeSliderValue(
  rawValue: unknown,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined
): number | null {
  let value = Number(rawValue);
  if (!Number.isFinite(value)) { return null; }
  if (Number.isFinite(min)) { value = Math.max(min!, value); }
  if (Number.isFinite(max)) { value = Math.min(max!, value); }
  if (Number.isFinite(step) && step! > 0) {
    const base = Number.isFinite(min) ? min! : 0;
    value = base + Math.round((value - base) / step!) * step!;
    if (Number.isFinite(min)) { value = Math.max(min!, value); }
    if (Number.isFinite(max)) { value = Math.min(max!, value); }
    const stepText = String(step);
    const dot = stepText.indexOf('.');
    if (dot >= 0) {
      const digits = stepText.length - dot - 1;
      value = Number(value.toFixed(Math.min(6, digits)));
    }
  }
  return value;
}

function startInlineSliderEdit(valueElement: HTMLElement, slider: HTMLInputElement): void {
  if (valueElement.dataset['inlineEditing'] === 'true' || slider.disabled) { return; }
  const originalText = valueElement.textContent || '';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'inline-slider-editor';
  input.value = slider.value;
  if (slider.min !== '') input.min = slider.min;
  if (slider.max !== '') input.max = slider.max;
  if (slider.step !== '') input.step = slider.step;

  valueElement.dataset['inlineEditing'] = 'true';
  valueElement.textContent = '';
  valueElement.appendChild(input);
  input.focus();
  input.select();

  const finishEdit = (apply: boolean) => {
    if (valueElement.dataset['inlineEditing'] !== 'true') { return; }
    delete valueElement.dataset['inlineEditing'];
    valueElement.textContent = originalText;
    if (!apply) { return; }
    const minVal = Number.parseFloat(slider.min);
    const maxVal = Number.parseFloat(slider.max);
    const stepVal = Number.parseFloat(slider.step);
    const nextValue = normalizeSliderValue(
      input.value,
      Number.isFinite(minVal) ? minVal : undefined,
      Number.isFinite(maxVal) ? maxVal : undefined,
      Number.isFinite(stepVal) ? stepVal : undefined
    );
    if (!Number.isFinite(nextValue)) { return; }
    slider.value = String(nextValue);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  };

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEdit(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finishEdit(false);
    }
  });
  input.addEventListener('blur', () => finishEdit(true));
}

function setupInlineSliderValueEditing(): void {
  const valueElements = Array.from(document.querySelectorAll('span[id$="-value"]')) as HTMLElement[];
  for (const valueElement of valueElements) {
    if (!valueElement.id || valueElement.dataset['inlineSliderBound'] === 'true') { continue; }
    const sliderId = valueElement.id.replace(/-value$/, '-slider');
    const slider = document.getElementById(sliderId) as HTMLInputElement | null;
    if (!slider || slider.tagName.toLowerCase() !== 'input' || slider.type !== 'range') { continue; }
    valueElement.dataset['inlineSliderBound'] = 'true';
    valueElement.classList.add('inline-slider-value');
    valueElement.addEventListener('dblclick', (event: Event) => {
      event.preventDefault();
      startInlineSliderEdit(valueElement, slider);
    });
  }
}

function updateCounts(atomCount: number, bondCount: number): void {
  const atomCountEl = document.getElementById('atom-count') as HTMLElement | null;
  const bondCountEl = document.getElementById('bond-count') as HTMLElement | null;
  if (atomCountEl) atomCountEl.textContent = String(atomCount);
  if (bondCountEl) bondCountEl.textContent = String(bondCount);
}

function clampAtomSize(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) { return fallback; }
  return Math.max(ATOM_SIZE_MIN, Math.min(ATOM_SIZE_MAX, parsed));
}

function getBaseAtomId(atomId: string): string {
  if (typeof atomId !== 'string') { return ''; }
  return atomId.split('::')[0];
}

function getCurrentStructureAtoms(): Atom[] {
  if (!state.currentStructure || !Array.isArray(state.currentStructure.atoms)) { return []; }
  return state.currentStructure.atoms;
}

function getAvailableElements(): string[] {
  const elementSet = new Set<string>();
  for (const atom of getCurrentStructureAtoms()) {
    if (atom && typeof atom.element === 'string' && atom.element.trim().length > 0) {
      elementSet.add(atom.element);
    }
  }
  return Array.from(elementSet).sort((a, b) => a.localeCompare(b));
}

function cleanupAtomSizeOverrides(): void {
  const atoms = getCurrentStructureAtoms();
  if (!state.atomSizeByAtom || typeof state.atomSizeByAtom !== 'object') {
    state.atomSizeByAtom = {};
  }
  if (!state.atomSizeByElement || typeof state.atomSizeByElement !== 'object') {
    state.atomSizeByElement = {};
  }
  const atomIds = new Set(atoms.map((atom) => atom.id));
  for (const atomId of Object.keys(state.atomSizeByAtom)) {
    if (!atomIds.has(atomId)) { delete state.atomSizeByAtom[atomId]; }
  }
  const elements = new Set(atoms.map((atom) => atom.element));
  for (const element of Object.keys(state.atomSizeByElement)) {
    if (!elements.has(element)) { delete state.atomSizeByElement[element]; }
  }
}

function hasAtomSizeOverride(atomId: string): boolean {
  const baseId = getBaseAtomId(atomId);
  return Number.isFinite(state.atomSizeByAtom && state.atomSizeByAtom[baseId]);
}

function hasElementSizeOverride(element: string): boolean {
  return Number.isFinite(state.atomSizeByElement && state.atomSizeByElement[element]);
}

function getFallbackRadiusForAtom(atom: Atom | null): number {
  if (atom && Number.isFinite(atom.radius)) { return atom.radius; }
  return clampAtomSize(state.atomSizeGlobal, 0.3);
}

function getAtomSizeForAtomId(atomId: string): number {
  const baseId = getBaseAtomId(atomId);
  const atom = getCurrentStructureAtoms().find((candidate) => candidate.id === baseId) || null;
  const fallback = getFallbackRadiusForAtom(atom);

  if (state.atomSizeUseDefaultSettings !== false) { return fallback; }

  const atomOverride = state.atomSizeByAtom && state.atomSizeByAtom[baseId];
  if (Number.isFinite(atomOverride)) { return clampAtomSize(atomOverride, fallback); }

  const elementOverride = atom && state.atomSizeByElement
    ? state.atomSizeByElement[atom.element]
    : undefined;
  if (Number.isFinite(elementOverride)) { return clampAtomSize(elementOverride!, fallback); }

  return clampAtomSize(state.atomSizeGlobal, fallback);
}

function getAtomSizeForElement(element: string): number {
  const atom = getCurrentStructureAtoms().find((candidate) => candidate.element === element) || null;
  const fallback = getFallbackRadiusForAtom(atom);
  if (state.atomSizeUseDefaultSettings !== false) { return fallback; }
  const elementOverride = state.atomSizeByElement && state.atomSizeByElement[element];
  if (Number.isFinite(elementOverride)) { return clampAtomSize(elementOverride, fallback); }
  return clampAtomSize(state.atomSizeGlobal, fallback);
}

function rerenderCurrentStructure(): void {
  if (!state.currentStructure) { return; }
  renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
}

function updateAtomList(atoms: Atom[], selectedIds: string[], selectedId: string | null): void {
  const derivedSelectedIds = atoms.filter((atom) => atom.selected).map((atom) => atom.id);
  const fallbackIds = state.selectedAtomIds || [];
  const effectiveSelectedId =
    selectedId ||
    selectedIds[selectedIds.length - 1] ||
    derivedSelectedIds[derivedSelectedIds.length - 1] ||
    fallbackIds[fallbackIds.length - 1] ||
    null;
  const normalizedSelectedIds =
    selectedIds.length > 0
      ? selectedIds
      : derivedSelectedIds.length > 0
        ? derivedSelectedIds
        : fallbackIds.length > 0
          ? fallbackIds
          : effectiveSelectedId
            ? [effectiveSelectedId]
            : [];

  const atomList = document.getElementById('atom-list') as HTMLElement | null;
  if (atomList) {
    atomList.innerHTML = '';
    atoms.forEach((atom, index) => {
      const item = document.createElement('div');
      const isSelected = normalizedSelectedIds.includes(atom.id);
      const hasSizeOverride = hasAtomSizeOverride(atom.id);
      item.className = 'atom-item'
        + (isSelected ? ' selected' : '')
        + (hasSizeOverride ? ' size-override' : '');
      item.textContent = atom.element + ' #' + (index + 1);
      item.title = atom.id;
      item.onclick = (event: MouseEvent) =>
        handleSelect(atom.id, (event.ctrlKey || event.metaKey), false);
      atomList.appendChild(item);
    });
  }

  const selected = atoms.find((atom) => atom.id === effectiveSelectedId) || null;
  state.currentSelectedAtom = selected;
  state.selectedAtomIds = normalizedSelectedIds;
  if (normalizedSelectedIds.length >= 2) {
    state.adsorptionReferenceId = normalizedSelectedIds[normalizedSelectedIds.length - 1];
    state.adsorptionAdsorbateIds = normalizedSelectedIds.slice(0, -1);
  } else {
    state.adsorptionReferenceId = null;
    state.adsorptionAdsorbateIds = normalizedSelectedIds.slice();
  }
  updateSelectedInputs(selected);
  updateAtomColorPreview();
  updateMeasurements();
  updateAdsorptionUI();
  updateAtomSizePanel();
  updateStatusBar();
}

function handleSelect(atomId: string, add: boolean, preserve: boolean): void {
  if (!state.currentStructure || !state.currentStructure.atoms) {
    vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
    return;
  }
  const atoms = state.currentStructure.atoms;
  let next = add || preserve ? [...state.selectedAtomIds] : [];
  const alreadySelected = next.includes(atomId);
  if (preserve && alreadySelected) {
    // Keep current selection when shift-dragging a selected atom.
  } else if (alreadySelected) {
    next = next.filter((id) => id !== atomId);
  } else {
    next.push(atomId);
  }
  for (const atom of atoms) {
    atom.selected = next.includes(atom.id);
  }
  const selectedId = next.length > 0 ? next[next.length - 1] : null;
  updateAtomList(atoms, next, selectedId);
  setSelectedBondSelection([], false);
  if (!(preserve && alreadySelected)) {
    vscode.postMessage({ command: 'selectAtom', atomId, add: !!add });
  }
}

function applySelectionFromIds(atomIds: string[], mode: string): void {
  if (!state.currentStructure || !state.currentStructure.atoms) { return; }
  const currentIds = state.selectedAtomIds || [];
  const nextSet = new Set<string>();
  if (mode === 'add') {
    for (const id of currentIds) nextSet.add(id);
    for (const id of atomIds) nextSet.add(id);
  } else if (mode === 'subtract') {
    for (const id of currentIds) nextSet.add(id);
    for (const id of atomIds) nextSet.delete(id);
  } else {
    for (const id of atomIds) nextSet.add(id);
  }

  const atoms = state.currentStructure.atoms;
  const next: string[] = [];
  for (const atom of atoms) {
    const selected = nextSet.has(atom.id);
    atom.selected = selected;
    if (selected) { next.push(atom.id); }
  }
  const selectedId = next.length > 0 ? next[next.length - 1] : null;
  updateAtomList(atoms, next, selectedId);
  setSelectedBondSelection([], false);
  vscode.postMessage({ command: 'setSelection', atomIds: next });
}

function applyBondSelectionFromKeys(bondKeys: string[], mode: string): void {
  const incoming = Array.isArray(bondKeys) ? bondKeys : [];
  const current = getSelectedBondKeys();
  const nextSet = new Set<string>();
  if (mode === 'add') {
    for (const key of current) nextSet.add(key);
    for (const key of incoming) nextSet.add(key);
  } else if (mode === 'subtract') {
    for (const key of current) nextSet.add(key);
    for (const key of incoming) nextSet.delete(key);
  } else {
    for (const key of incoming) nextSet.add(key);
  }
  setSelectedBondSelection(Array.from(nextSet), true);
}

function getAtomById(atomId: string): Atom | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  return state.currentStructure.atoms.find((atom) => atom.id === atomId) || null;
}

function normalizeHexColor(value: string): string | null {
  if (typeof value !== 'string') { return null; }
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) { return null; }
  return trimmed.toUpperCase();
}

function getImageFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `structure-hd-${stamp}.png`;
}

function parseBondPairFromKey(bondKey: string): [string, string] | null {
  if (!bondKey || typeof bondKey !== 'string') { return null; }
  const parts = bondKey.split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) { return null; }
  return [parts[0], parts[1]];
}

function getSelectedBondKeys(): string[] {
  const keys = Array.isArray(state.selectedBondKeys) ? state.selectedBondKeys : [];
  return keys.filter((key) => typeof key === 'string' && key.trim().length > 0);
}

function updateBondSelectionUI(): void {
  const label = document.getElementById('bond-selected') as HTMLElement | null;
  const deleteBtn = document.getElementById('btn-delete-bond') as HTMLButtonElement | null;
  if (!label || !deleteBtn) { return; }
  const selectedBondKeys = getSelectedBondKeys();
  if (selectedBondKeys.length === 0) {
    label.textContent = '--';
  } else if (selectedBondKeys.length === 1) {
    const pair = parseBondPairFromKey(selectedBondKeys[0]);
    if (!pair) {
      label.textContent = selectedBondKeys[0];
    } else {
      const atom1 = getAtomById(pair[0]);
      const atom2 = getAtomById(pair[1]);
      const left = atom1 ? `${atom1.element}(${pair[0].slice(-4)})` : pair[0];
      const right = atom2 ? `${atom2.element}(${pair[1].slice(-4)})` : pair[1];
      label.textContent = `${left} - ${right}`;
    }
  } else {
    label.textContent = `${selectedBondKeys.length} bonds selected`;
  }
  deleteBtn.disabled = !(
    selectedBondKeys.length > 0 ||
    (state.selectedAtomIds && state.selectedAtomIds.length >= 2)
  );
}

function setSelectedBondSelection(bondKeys: string[], syncBackend: boolean): void {
  const normalized = Array.from(
    new Set((Array.isArray(bondKeys) ? bondKeys : [])
      .filter((key) => typeof key === 'string' && key.trim().length > 0))
  );
  state.selectedBondKeys = normalized;
  state.currentSelectedBondKey = normalized.length > 0 ? normalized[normalized.length - 1] : null;
  updateBondSelectionUI();
  if (syncBackend) {
    vscode.postMessage({ command: 'setBondSelection', bondKeys: normalized });
  }
}

function handleBondSelect(bondKey: string | null, add: boolean, syncBackend: boolean): void {
  if (!bondKey) {
    setSelectedBondSelection([], syncBackend);
    return;
  }
  const current = getSelectedBondKeys();
  if (add) {
    const next = current.includes(bondKey)
      ? current.filter((key) => key !== bondKey)
      : [...current, bondKey];
    setSelectedBondSelection(next, syncBackend);
    return;
  }
  setSelectedBondSelection([bondKey], syncBackend);
}

function updateAtomColorPreview(): void {
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

function updateAtomPosition(atomId: string, x: number, y: number, z: number): void {
  const atom = getAtomById(atomId);
  if (!atom) return;
  atom.position[0] = x;
  atom.position[1] = y;
  atom.position[2] = z;
  if (state.currentSelectedAtom && state.currentSelectedAtom.id === atomId) {
    updateStatusBar();
  }
}

function updateMeasurements(): void {
  const lengthEl = document.getElementById('bond-length') as HTMLElement | null;
  const angleEl = document.getElementById('bond-angle') as HTMLElement | null;
  const selected = state.selectedAtomIds;
  if (selected.length < 2) {
    if (lengthEl) lengthEl.textContent = '--';
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const atomA = getAtomById(selected[0]);
  const atomB = getAtomById(selected[1]);
  if (!atomA || !atomB) {
    if (lengthEl) lengthEl.textContent = '--';
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const dx = atomB.position[0] - atomA.position[0];
  const dy = atomB.position[1] - atomA.position[1];
  const dz = atomB.position[2] - atomA.position[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (lengthEl) lengthEl.textContent = length.toFixed(4);

  if (selected.length < 3) {
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const atomC = getAtomById(selected[2]);
  if (!atomC) {
    if (angleEl) angleEl.textContent = '--';
    return;
  }
  const v1: [number, number, number] = [
    atomA.position[0] - atomB.position[0],
    atomA.position[1] - atomB.position[1],
    atomA.position[2] - atomB.position[2],
  ];
  const v2: [number, number, number] = [
    atomC.position[0] - atomB.position[0],
    atomC.position[1] - atomB.position[1],
    atomC.position[2] - atomB.position[2],
  ];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const len1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]);
  const len2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2]);
  if (len1 > 1e-6 && len2 > 1e-6) {
    const cos = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    const angle = (Math.acos(cos) * 180) / Math.PI;
    if (angleEl) angleEl.textContent = angle.toFixed(2);
  } else {
    if (angleEl) angleEl.textContent = '--';
  }
}

function rotateVectorAroundAxis(
  vector: [number, number, number],
  axis: [number, number, number],
  angleRad: number
): [number, number, number] {
  const [vx, vy, vz] = vector;
  const [ax, ay, az] = axis;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dot = vx * ax + vy * ay + vz * az;
  return [
    vx * cos + (ay * vz - az * vy) * sin + ax * dot * (1 - cos),
    vy * cos + (az * vx - ax * vz) * sin + ay * dot * (1 - cos),
    vz * cos + (ax * vy - ay * vx) * sin + az * dot * (1 - cos),
  ];
}

function applyBondAngle(targetDeg: number): void {
  const ids = state.selectedAtomIds;
  if (!ids || ids.length < 3) return;
  const atomA = getAtomById(ids[0]);
  const atomB = getAtomById(ids[1]);
  const atomC = getAtomById(ids[2]);
  if (!atomA || !atomB || !atomC) return;

  const ba: [number, number, number] = [
    atomA.position[0] - atomB.position[0],
    atomA.position[1] - atomB.position[1],
    atomA.position[2] - atomB.position[2],
  ];
  const bc: [number, number, number] = [
    atomC.position[0] - atomB.position[0],
    atomC.position[1] - atomB.position[1],
    atomC.position[2] - atomB.position[2],
  ];
  const lenBA = Math.sqrt(ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2]);
  const lenBC = Math.sqrt(bc[0] * bc[0] + bc[1] * bc[1] + bc[2] * bc[2]);
  if (lenBA < 1e-6 || lenBC < 1e-6) return;
  const dot = ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2];
  const current = Math.acos(Math.max(-1, Math.min(1, dot / (lenBA * lenBC))));
  const target = (targetDeg * Math.PI) / 180;
  const delta = target - current;

  const axis: [number, number, number] = [
    ba[1] * bc[2] - ba[2] * bc[1],
    ba[2] * bc[0] - ba[0] * bc[2],
    ba[0] * bc[1] - ba[1] * bc[0],
  ];
  const axisLen = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);
  if (axisLen < 1e-6) return;
  const axisUnit: [number, number, number] = [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen];
  const rotated = rotateVectorAroundAxis(bc, axisUnit, delta);

  const newPos: [number, number, number] = [
    atomB.position[0] + rotated[0],
    atomB.position[1] + rotated[1],
    atomB.position[2] + rotated[2],
  ];
  updateAtomPosition(atomC.id, newPos[0], newPos[1], newPos[2]);
  updateMeasurements();
  vscode.postMessage({
    command: 'setAtomsPositions',
    atomPositions: [{ id: atomC.id, x: newPos[0], y: newPos[1], z: newPos[2] }],
    preview: false,
  });
}

function getAdsorptionReference(): { anchor: Atom; reference: Atom; distance: number } | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  if (!state.adsorptionReferenceId || state.adsorptionAdsorbateIds.length === 0) return null;
  const atoms = state.currentStructure.atoms;
  const referenceAtom = atoms.find((atom) => atom.id === state.adsorptionReferenceId);
  if (!referenceAtom) return null;
  let anchor: Atom | null = null;
  let nearestDist = Infinity;
  for (const atom of atoms) {
    if (!state.adsorptionAdsorbateIds.includes(atom.id)) { continue; }
    const dx = atom.position[0] - referenceAtom.position[0];
    const dy = atom.position[1] - referenceAtom.position[1];
    const dz = atom.position[2] - referenceAtom.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < nearestDist) { nearestDist = dist; anchor = atom; }
  }
  if (!anchor || !Number.isFinite(nearestDist)) { return null; }
  return { anchor, reference: referenceAtom, distance: nearestDist };
}

function updateAdsorptionUI(): void {
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

function applyAdsorptionDistance(target: number, preview: boolean): void {
  const ref = getAdsorptionReference();
  if (!ref) return;
  const dx = ref.anchor.position[0] - ref.reference.position[0];
  const dy = ref.anchor.position[1] - ref.reference.position[1];
  const dz = ref.anchor.position[2] - ref.reference.position[2];
  const current = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (current < 1e-6) return;
  const delta = target - current;
  const nx = dx / current;
  const ny = dy / current;
  const nz = dz / current;
  for (const id of state.adsorptionAdsorbateIds) {
    const atom = getAtomById(id);
    if (atom) {
      updateAtomPosition(id, atom.position[0] + nx * delta, atom.position[1] + ny * delta, atom.position[2] + nz * delta);
    }
  }
  vscode.postMessage({
    command: 'moveGroup',
    atomIds: state.adsorptionAdsorbateIds,
    dx: nx * delta, dy: ny * delta, dz: nz * delta,
    preview: !!preview,
  });
  if (!preview) { vscode.postMessage({ command: 'endDrag' }); }
  updateAdsorptionUI();
}

function updateSelectedInputs(atom: Atom | null): void {
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

function getSelectedCentroid(): [number, number, number] | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  const ids = state.selectedAtomIds;
  if (!ids || ids.length === 0) return null;
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (const id of ids) {
    const atom = getAtomById(id);
    if (!atom) continue;
    cx += atom.position[0]; cy += atom.position[1]; cz += atom.position[2];
    count++;
  }
  if (count === 0) return null;
  return [cx / count, cy / count, cz / count];
}

function rotateAroundAxis(
  point: [number, number, number],
  pivot: [number, number, number],
  axis: string,
  angleRad: number
): [number, number, number] {
  const px = point[0] - pivot[0];
  const py = point[1] - pivot[1];
  const pz = point[2] - pivot[2];
  let x = px, y = py, z = pz;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  if (axis === 'x') {
    y = py * cos - pz * sin;
    z = py * sin + pz * cos;
  } else if (axis === 'y') {
    x = px * cos + pz * sin;
    z = -px * sin + pz * cos;
  } else {
    x = px * cos - py * sin;
    y = px * sin + py * cos;
  }
  return [x + pivot[0], y + pivot[1], z + pivot[2]];
}

let rotationBase: { id: string; pos: [number, number, number] }[] | null = null;
let rotationBaseIds: string[] = [];

function resetRotationBase(): void {
  rotationBase = null;
  rotationBaseIds = [];
  state.rotationInProgress = false;
}

function captureRotationBase(): { id: string; pos: [number, number, number] }[] | null {
  if (!state.currentStructure || !state.currentStructure.atoms) return null;
  rotationBaseIds = [...state.selectedAtomIds];
  rotationBase = rotationBaseIds.map((id) => {
    const atom = getAtomById(id);
    return atom ? { id, pos: [...atom.position] as [number, number, number] } : null;
  }).filter((entry): entry is { id: string; pos: [number, number, number] } => entry !== null);
  return rotationBase;
}

function applyRotation(angleDeg: number, preview: boolean): void {
  if (!state.selectedAtomIds || state.selectedAtomIds.length === 0) return;
  const pivot = getSelectedCentroid();
  if (!pivot) return;
  if (!rotationBase || rotationBaseIds.join(',') !== state.selectedAtomIds.join(',')) {
    captureRotationBase();
  }
  if (!rotationBase) return;

  if (preview && !state.rotationInProgress) {
    state.rotationInProgress = true;
    vscode.postMessage({ command: 'beginDrag', atomId: state.selectedAtomIds[0] });
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  const updated: { id: string; x: number; y: number; z: number }[] = [];

  for (const entry of rotationBase) {
    if (!entry) continue;
    const rotated = rotateAroundAxis(entry.pos, pivot, state.rotationAxis, angleRad);
    updateAtomPosition(entry.id, rotated[0], rotated[1], rotated[2]);
    updated.push({ id: entry.id, x: rotated[0], y: rotated[1], z: rotated[2] });
  }

  if (preview && state.currentStructure && state.currentStructure.renderAtoms) {
    const baseMap = new Map<string, [number, number, number]>();
    for (const atom of state.currentStructure.atoms || []) {
      baseMap.set(atom.id, atom.position);
    }
    for (const renderAtom of state.currentStructure.renderAtoms) {
      const baseId = String(renderAtom.id).split('::')[0];
      const basePos = baseMap.get(baseId);
      const offset = state.renderAtomOffsets[renderAtom.id];
      if (basePos && offset) {
        renderAtom.position = [
          basePos[0] + offset[0],
          basePos[1] + offset[1],
          basePos[2] + offset[2],
        ];
      }
    }
  }

  vscode.postMessage({ command: 'setAtomsPositions', atomPositions: updated, preview: !!preview });

  if (preview && state.currentStructure) {
    renderer.renderStructure(state.currentStructure, { updateCounts }, { fitCamera: false });
  }

  if (!preview) {
    state.rotationInProgress = false;
    vscode.postMessage({ command: 'endDrag' });
  }
}

function applySelectedAtomChanges(): void {
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

function setupTabs(): void {
  const tabButtons = Array.from(document.querySelectorAll('.tab-button')) as HTMLElement[];
  const tabPanes = Array.from(document.querySelectorAll('.tab-pane')) as HTMLElement[];
  if (tabButtons.length === 0 || tabPanes.length === 0) { return; }

  const activateTab = (targetId: string) => {
    tabButtons.forEach((button) => {
      button.classList.toggle('active', (button as HTMLElement & { dataset: DOMStringMap }).dataset['tabTarget'] === targetId);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === targetId);
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = (button as HTMLElement & { dataset: DOMStringMap }).dataset['tabTarget'];
      if (!targetId) { return; }
      activateTab(targetId);
    });
  });

  const firstBtn = tabButtons[0] as HTMLElement & { dataset: DOMStringMap };
  const defaultTarget = firstBtn.dataset['tabTarget'];
  if (defaultTarget) { activateTab(defaultTarget); }
}

function setupUI(): void {
  setupTabs();

  // Toolbar buttons shared across tabs
  const btnUnitCell = document.getElementById('btn-unit-cell') as HTMLButtonElement | null;
  const btnReset = document.getElementById('btn-reset') as HTMLButtonElement | null;
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
  const btnSaveAs = document.getElementById('btn-save-as') as HTMLButtonElement | null;
  const btnExportImage = document.getElementById('btn-export-image') as HTMLButtonElement | null;
  const btnOpenSource = document.getElementById('btn-open-source') as HTMLButtonElement | null;
  const btnReload = document.getElementById('btn-reload') as HTMLButtonElement | null;

  if (btnUnitCell) btnUnitCell.onclick = () => { vscode.postMessage({ command: 'toggleUnitCell' }); };
  if (btnReset) btnReset.onclick = () => { renderer.fitCamera(); };
  if (btnUndo) btnUndo.onclick = () => { vscode.postMessage({ command: 'undo' }); };
  if (btnSave) btnSave.onclick = () => { vscode.postMessage({ command: 'saveStructure' }); };
  if (btnSaveAs) btnSaveAs.onclick = () => { vscode.postMessage({ command: 'saveStructureAs' }); };
  if (btnExportImage) {
    btnExportImage.onclick = () => {
      if (!renderer.exportHighResolutionImage) {
        setError('HD image export is unavailable.');
        return;
      }
      const result = renderer.exportHighResolutionImage({ scale: 4 });
      if (!result || !result.dataUrl) {
        setError('Failed to export HD image.');
        return;
      }
      vscode.postMessage({
        command: 'saveRenderedImage',
        dataUrl: result.dataUrl,
        suggestedName: getImageFileName(),
        width: result.width,
        height: result.height,
      });
      setError('');
      setStatus('HD image generated: ' + result.width + 'x' + result.height);
    };
  }
  if (btnOpenSource) btnOpenSource.onclick = () => { vscode.postMessage({ command: 'openSource' }); };
  if (btnReload) btnReload.onclick = () => { vscode.postMessage({ command: 'reloadStructure' }); };

  // Build shared callbacks bag for module setups
  const callbacks: AppCallbacks = {
    vscode,
    state,
    renderer,
    setError,
    rerenderCurrentStructure,
    updateCounts,
    updateAtomList,
    clampAtomSize,
    getBaseAtomId,
    getCurrentStructureAtoms,
    getAvailableElements,
    hasAtomSizeOverride,
    hasElementSizeOverride,
    getAtomSizeForAtomId,
    getAtomSizeForElement,
    getFallbackRadiusForAtom,
    cleanupAtomSizeOverrides,
    ATOM_SIZE_MIN,
    ATOM_SIZE_MAX,
    getSelectedBondKeys,
    setSelectedBondSelection,
    normalizeHexColor,
    applySelectedAtomChanges,
    applyBondAngle,
    applyRotation,
    applyAdsorptionDistance,
    updateMeasurements,
    updateAdsorptionUI,
    resetRotationBase,
  };

  appTrajectory.setup(vscode);
  setupEdit(callbacks);
  setupLattice(callbacks);
  setupView(callbacks);
  setupTools(callbacks);

  updateBondSelectionUI();
}

function setupInteraction(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  initInteraction(canvas, {
    onSelectAtom: (atomId, add, preserve) => handleSelect(atomId, add, preserve),
    onSelectBond: (bondKey, add) => handleBondSelect(bondKey, add, true),
    onClearSelection: () => applySelectionFromIds([], 'replace'),
    onBoxSelect: (atomIds, mode) => applySelectionFromIds(atomIds, mode),
    onBoxSelectBonds: (bondKeys, mode) => applyBondSelectionFromKeys(bondKeys, mode),
    onSetStatus: (message) => setStatus(message),
    onBeginDrag: (atomId) => vscode.postMessage({ command: 'beginDrag', atomId }),
    onDragAtom: (atomId, intersection) => {
      const scale = renderer.getScale();
      const invScale = scale ? 1 / scale : 1;
      const modelX = intersection.x * invScale;
      const modelY = intersection.y * invScale;
      const modelZ = intersection.z * invScale;
      updateAtomPosition(atomId, modelX, modelY, modelZ);
      if (state.currentSelectedAtom && state.currentSelectedAtom.id === atomId) {
        const selX = document.getElementById('sel-x') as HTMLInputElement | null;
        const selY = document.getElementById('sel-y') as HTMLInputElement | null;
        const selZ = document.getElementById('sel-z') as HTMLInputElement | null;
        if (selX) selX.value = modelX.toFixed(4);
        if (selY) selY.value = modelY.toFixed(4);
        if (selZ) selZ.value = modelZ.toFixed(4);
      }
      updateMeasurements();
      vscode.postMessage({ command: 'moveAtom', atomId, x: modelX, y: modelY, z: modelZ, preview: true });
    },
    onDragGroup: (deltaWorld) => {
      const scale = renderer.getScale();
      const invScale = scale ? 1 / scale : 1;
      const dx = deltaWorld.x * invScale;
      const dy = deltaWorld.y * invScale;
      const dz = deltaWorld.z * invScale;
      for (const id of state.selectedAtomIds) {
        const atom = getAtomById(id);
        if (atom) {
          updateAtomPosition(id, atom.position[0] + dx, atom.position[1] + dy, atom.position[2] + dz);
        }
      }
      vscode.postMessage({ command: 'moveGroup', atomIds: state.selectedAtomIds, dx, dy, dz, preview: true });
      if (state.currentSelectedAtom && state.selectedAtomIds.length > 0) {
        const atom = getAtomById(state.currentSelectedAtom.id);
        if (atom) {
          const selX = document.getElementById('sel-x') as HTMLInputElement | null;
          const selY = document.getElementById('sel-y') as HTMLInputElement | null;
          const selZ = document.getElementById('sel-z') as HTMLInputElement | null;
          if (selX) selX.value = atom.position[0].toFixed(4);
          if (selY) selY.value = atom.position[1].toFixed(4);
          if (selZ) selZ.value = atom.position[2].toFixed(4);
        }
      }
      updateMeasurements();
    },
    onEndDrag: () => vscode.postMessage({ command: 'endDrag' }),
  });
}

function start(): void {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  // Init configHandler with vscode, showStatus callback, and updateConfigSelector
  configHandler.init(vscode, setStatus, updateConfigSelector);
  // Init interactionConfig with vscode (must happen before interaction.init() calls initConfig())
  initInteractionConfigVscode(vscode);

  renderer.init(canvas, { setError, setStatus });
  setupUI();
  setupInteraction();
  setupInlineSliderValueEditing();

  configHandler.requestConfigList();
  configHandler.getCurrentSettings();

  vscode.postMessage({ command: 'getState' });
  document.addEventListener('selectionchange', () => {
    syncStatusSelectionLock();
    if (!statusSelectionLock) { updateStatusBar(true); }
  });
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as { command: string; data?: Structure & {
    selectedAtomId?: string;
    selectedAtomIds?: string[];
    selectedBondKeys?: string[];
    selectedBondKey?: string;
    supercell?: [number, number, number];
    trajectoryFrameIndex?: number;
    trajectoryFrameCount?: number;
    renderAtoms?: Atom[];
    unitCellParams?: import('./types').UnitCellParams;
  }; displaySettings?: import('./types').DisplaySettings; [key: string]: unknown };

  if (data.command === 'render') {
    appTrajectory.clearPending();
    state.currentStructure = data.data ?? null;
    cleanupAtomSizeOverrides();
    state.selectedAtomIds = data.data?.selectedAtomIds || [];
    state.selectedBondKeys = Array.isArray(data.data?.selectedBondKeys)
      ? (data.data!.selectedBondKeys as string[])
      : data.data?.selectedBondKey
        ? [data.data.selectedBondKey as string]
        : [];
    state.currentSelectedBondKey = state.selectedBondKeys.length > 0
      ? state.selectedBondKeys[state.selectedBondKeys.length - 1]
      : null;
    state.supercell = (data.data?.supercell as [number, number, number]) || [1, 1, 1];

    // Apply display settings if provided
    if (data.displaySettings) {
      state.applyDisplaySettings(data.displaySettings);
      configHandler.updateUI();
    }

    appTrajectory.updateUI(
      data.data?.trajectoryFrameIndex || 0,
      data.data?.trajectoryFrameCount || 1
    );

    if (state.selectedAtomIds.length >= 2) {
      state.adsorptionReferenceId = state.selectedAtomIds[state.selectedAtomIds.length - 1];
      state.adsorptionAdsorbateIds = state.selectedAtomIds.slice(0, -1);
    } else {
      state.adsorptionReferenceId = null;
      state.adsorptionAdsorbateIds = state.selectedAtomIds.slice();
    }

    renderer.renderStructure(
      data.data!,
      {
        updateCounts,
        updateAtomList: (atoms, _selectedIds, selectedId) =>
          updateAtomList(atoms, state.selectedAtomIds, selectedId),
      },
      { fitCamera: state.shouldFitCamera }
    );
    state.shouldFitCamera = false;
    updateStatusBar();

    if (data.data?.renderAtoms && data.data?.atoms) {
      const baseMap = new Map<string, [number, number, number]>();
      for (const atom of data.data.atoms) {
        baseMap.set(atom.id, atom.position);
      }
      state.renderAtomOffsets = {};
      for (const renderAtom of data.data.renderAtoms) {
        const baseId = String(renderAtom.id).split('::')[0];
        const basePos = baseMap.get(baseId);
        if (basePos) {
          state.renderAtomOffsets[renderAtom.id] = [
            renderAtom.position[0] - basePos[0],
            renderAtom.position[1] - basePos[1],
            renderAtom.position[2] - basePos[2],
          ];
        }
      }
    } else {
      state.renderAtomOffsets = {};
    }

    updateLatticeUI(
      data.data?.unitCellParams || null,
      data.data?.supercell || [1, 1, 1],
      !!data.data?.unitCellParams
    );

    const atoms = data.data?.atoms || [];
    const selectedId =
      (data.data as { selectedAtomId?: string } | undefined)?.selectedAtomId ||
      state.selectedAtomIds[state.selectedAtomIds.length - 1] ||
      null;
    const selected = atoms.find((atom) => atom.id === selectedId) || null;
    state.currentSelectedAtom = selected;
    updateSelectedInputs(selected);
    updateAtomColorPreview();
    updateAdsorptionUI();
    updateBondSelectionUI();
    updateAtomSizePanel();
    return;
  }

  if (data.command === 'imageSaved') {
    const fileName = (data['data'] as { fileName?: string } | undefined)?.fileName || 'image.png';
    setStatus(`HD image saved: ${fileName}`);
    setError('');
    return;
  }

  if (data.command === 'imageSaveFailed') {
    const reason = (data['data'] as { reason?: string } | undefined)?.reason || 'Failed to save image.';
    setError(reason);
    return;
  }

  // Handle display configuration messages
  configHandler.handleMessage(data as { command: string; [key: string]: unknown });
});

if (document.readyState === 'complete') {
  start();
} else {
  window.addEventListener('load', start);
}
