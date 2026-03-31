/**
 * Lattice tab module.
 *
 * Wires: Lattice Params panel, Supercell panel, Center at Cell,
 *        Atom & Bond Size panel (selected atoms radius, bond thickness).
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { displayStore, structureStore, selectionStore } from './state';
import { getElementById } from './utils/domCache';
import { updateSettings } from './settingsUtil';
import { debounce } from './utils/performance';
import type {
  UnitCellParams,
  VscodeContext,
  ErrorContext,
  RendererContext,
  AtomSizeContext,
} from './types';

/** Combined context for appLattice module */
type AppLatticeContext = VscodeContext & ErrorContext & RendererContext & AtomSizeContext;

// vscode-checkbox is a custom element with a 'checked' property
type VscodeCheckbox = HTMLElement & { checked: boolean };
type VscodeButton = HTMLElement & { disabled: boolean };

let _cb: AppLatticeContext | null = null;

// ── Lattice UI sync ────────────────────────────────────────────────────────────

export function updateLatticeUI(
  unitCellParams: UnitCellParams | null | undefined,
  supercell: [number, number, number] | number[] | null | undefined,
  hasUnitCell: boolean
): void {
  const aInput = getElementById<HTMLInputElement>('lattice-a');
  const bInput = getElementById<HTMLInputElement>('lattice-b');
  const cInput = getElementById<HTMLInputElement>('lattice-c');
  const alphaInput = getElementById<HTMLInputElement>('lattice-alpha');
  const betaInput = getElementById<HTMLInputElement>('lattice-beta');
  const gammaInput = getElementById<HTMLInputElement>('lattice-gamma');
  const scaleToggle = getElementById<VscodeCheckbox>('lattice-scale');
  const removeBtn = getElementById<VscodeButton>('btn-lattice-remove');
  const centerBtn = getElementById<VscodeButton>('btn-center-cell');
  const superX = getElementById<HTMLInputElement>('supercell-x');
  const superY = getElementById<HTMLInputElement>('supercell-y');
  const superZ = getElementById<HTMLInputElement>('supercell-z');

  if (unitCellParams) {
    if (aInput) { aInput.value = Number(unitCellParams.a).toFixed(4); }
    if (bInput) { bInput.value = Number(unitCellParams.b).toFixed(4); }
    if (cInput) { cInput.value = Number(unitCellParams.c).toFixed(4); }
    if (alphaInput) { alphaInput.value = Number(unitCellParams.alpha).toFixed(2); }
    if (betaInput) { betaInput.value = Number(unitCellParams.beta).toFixed(2); }
    if (gammaInput) { gammaInput.value = Number(unitCellParams.gamma).toFixed(2); }
  } else if (!displayStore.unitCellEditing) {
    if (aInput) { aInput.value = ''; }
    if (bInput) { bInput.value = ''; }
    if (cInput) { cInput.value = ''; }
    if (alphaInput) { alphaInput.value = ''; }
    if (betaInput) { betaInput.value = ''; }
    if (gammaInput) { gammaInput.value = ''; }
  }

  if (scaleToggle) { scaleToggle.checked = !!displayStore.scaleAtomsWithLattice; }
  if (removeBtn) { removeBtn.disabled = !hasUnitCell; }
  if (centerBtn) { centerBtn.disabled = !hasUnitCell; }

  const sc = Array.isArray(supercell) ? supercell : [1, 1, 1];
  const nx = Math.max(1, Math.floor(sc[0] || 1));
  const ny = Math.max(1, Math.floor(sc[1] || 1));
  const nz = Math.max(1, Math.floor(sc[2] || 1));
  if (superX) { superX.value = String(nx); superX.disabled = !hasUnitCell; }
  if (superY) { superY.value = String(ny); superY.disabled = !hasUnitCell; }
  if (superZ) { superZ.value = String(nz); superZ.disabled = !hasUnitCell; }
}

// ── Atom size panel ────────────────────────────────────────────────────────────

function rerenderCurrentStructure(): void {
  _cb?.rerenderCurrentStructure();
}

export function updateSelectedAtomSizePanel(): void {
  const atomSizeSelectedValue = getElementById<HTMLElement>('atom-size-selected-value');
  const atomSizeSelectedSlider = getElementById<HTMLInputElement>('atom-size-selected-slider');

  const selectedCount = selectionStore.selectedAtomIds.length;

  if (selectedCount > 0 && atomSizeSelectedSlider && atomSizeSelectedValue) {
    const { getAtomSizeForAtomId } = _cb || {};
    const firstAtomId = selectionStore.selectedAtomIds[0];
    const size = getAtomSizeForAtomId?.(firstAtomId) ?? 0.3;
    atomSizeSelectedSlider.value = size.toFixed(2);
    atomSizeSelectedValue.textContent = size.toFixed(2);
  } else if (atomSizeSelectedValue) {
    atomSizeSelectedValue.textContent = '--';
  }
}

// ── UI wiring ──────────────────────────────────────────────────────────────────

export function setup(callbacks: AppLatticeContext): void {
  _cb = callbacks;
  const { vscode, renderer, setError, rerenderCurrentStructure, updateCounts, updateAtomList,
    clampAtomSize, getBaseAtomId, ATOM_SIZE_MIN, ATOM_SIZE_MAX } = callbacks;

  // Debounced renders to avoid excessive GPU work during slider drag (16ms = 60fps)
  const debouncedRenderStructure = debounce((): void => {
    if (structureStore.currentStructure) {
      renderer.renderStructure(structureStore.currentStructure, { updateCounts, updateAtomList });
    }
  }, 16);
  const debouncedRerenderCurrentStructure = debounce((): void => {
    rerenderCurrentStructure();
  }, 16);

  // ── Lattice params ────────────────────────────────────────────────────────

  const latticeApply = getElementById<VscodeButton>('btn-lattice-apply');
  const latticeRemove = getElementById<VscodeButton>('btn-lattice-remove');
  const latticeCenter = getElementById<VscodeButton>('btn-center-cell');
  const latticeScale = getElementById<VscodeCheckbox>('lattice-scale');
  const latticeInputIds = ['lattice-a', 'lattice-b', 'lattice-c', 'lattice-alpha', 'lattice-beta', 'lattice-gamma'];
  const latticeInputs = latticeInputIds
    .map((id) => getElementById<HTMLInputElement>(id))
    .filter((el): el is HTMLInputElement => el !== null);

  if (latticeScale) {
    latticeScale.addEventListener('change', (event: Event) => {
      displayStore.scaleAtomsWithLattice = (event.target as VscodeCheckbox).checked;
    });
  }

  for (const input of latticeInputs) {
    input.addEventListener('input', () => { displayStore.unitCellEditing = true; });
    input.addEventListener('blur', () => { displayStore.unitCellEditing = false; });
  }

  if (latticeApply) {
    latticeApply.addEventListener('click', () => {
      const a = parseFloat(getElementById<HTMLInputElement>('lattice-a')?.value ?? '');
      const b = parseFloat(getElementById<HTMLInputElement>('lattice-b')?.value ?? '');
      const c = parseFloat(getElementById<HTMLInputElement>('lattice-c')?.value ?? '');
      const alpha = parseFloat(getElementById<HTMLInputElement>('lattice-alpha')?.value ?? '');
      const beta = parseFloat(getElementById<HTMLInputElement>('lattice-beta')?.value ?? '');
      const gamma = parseFloat(getElementById<HTMLInputElement>('lattice-gamma')?.value ?? '');
      if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) {
        setError('Lattice parameters must be valid numbers.');
        return;
      }
      vscode.postMessage({
        command: 'setUnitCell',
        params: { a, b, c, alpha, beta, gamma },
        scaleAtoms: !!displayStore.scaleAtomsWithLattice,
      });
      setError('');
    });
  }

  if (latticeRemove) { latticeRemove.addEventListener('click', () => { vscode.postMessage({ command: 'clearUnitCell' }); }); }
  if (latticeCenter) { latticeCenter.addEventListener('click', () => { vscode.postMessage({ command: 'centerToUnitCell' }); }); }

  // ── Supercell ─────────────────────────────────────────────────────────────

  const supercellApply = getElementById<HTMLButtonElement>('btn-supercell-apply');
  if (supercellApply) {
    supercellApply.addEventListener('click', () => {
      const nx = parseInt(getElementById<HTMLInputElement>('supercell-x')?.value ?? '', 10);
      const ny = parseInt(getElementById<HTMLInputElement>('supercell-y')?.value ?? '', 10);
      const nz = parseInt(getElementById<HTMLInputElement>('supercell-z')?.value ?? '', 10);
      if (![nx, ny, nz].every((value) => Number.isFinite(value) && value >= 1)) {
        setError('Supercell values must be integers >= 1.');
        return;
      }
      vscode.postMessage({ command: 'setSupercell', supercell: [nx, ny, nz] });
      setError('');
    });
  }

  // ── Bond thickness slider ───────────────────────────────────────────────────

  const bondSizeSlider = getElementById<HTMLInputElement>('bond-size-slider');

  if (bondSizeSlider) {
    bondSizeSlider.addEventListener('input', (event: Event) => {
      displayStore.bondThicknessScale = parseFloat((event.target as HTMLInputElement).value);
      const bondSizeValue = getElementById<HTMLElement>('bond-size-value');
      if (bondSizeValue) { bondSizeValue.textContent = displayStore.bondThicknessScale.toFixed(1); }
      updateSettings();
      if (structureStore.currentStructure) {
        debouncedRenderStructure();
      }
    });
  }

  // ── Selected atoms radius ────────────────────────────────────────────────────

  const atomSizeSelectedSlider = getElementById<HTMLInputElement>('atom-size-selected-slider');
  const atomSizeSelectedValue = getElementById<HTMLElement>('atom-size-selected-value');
  const btnAtomSizeResetSelected = getElementById<HTMLButtonElement>('btn-atom-size-reset-selected');

  if (atomSizeSelectedSlider) {
    atomSizeSelectedSlider.addEventListener('input', (event: Event) => {
      const value = parseFloat((event.target as HTMLInputElement).value);
      if (atomSizeSelectedValue) { atomSizeSelectedValue.textContent = value.toFixed(2); }

      if (selectionStore.selectedAtomIds.length > 0 && vscode) {
        vscode.postMessage({
          command: 'setAtomRadius',
          atomIds: selectionStore.selectedAtomIds,
          radius: value,
        });
      }
    });
  }

  if (btnAtomSizeResetSelected) {
    btnAtomSizeResetSelected.addEventListener('click', () => {
      if (selectionStore.selectedAtomIds.length > 0 && vscode) {
        vscode.postMessage({
          command: 'applyDisplaySettings',
          atomIds: selectionStore.selectedAtomIds,
        });
      }
    });
  }

  const btnAtomSizeCovalent = getElementById<HTMLButtonElement>('btn-atom-size-covalent');
  if (btnAtomSizeCovalent) {
    btnAtomSizeCovalent.addEventListener('click', () => {
      if (selectionStore.selectedAtomIds.length > 0 && vscode) {
        vscode.postMessage({
          command: 'setCovalentRadius',
          atomIds: selectionStore.selectedAtomIds,
        });
      }
    });
  }
}
