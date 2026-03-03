/**
 * Lattice tab module.
 *
 * Wires: Lattice Params panel, Supercell panel, Center at Cell,
 *        Display Scale panel (scale/size sliders, auto-scale), projection selector,
 *        Atom & Bond Size panel (global, per-selected, by-element, bond thickness).
 *
 * setup(callbacks) must be called once during app initialisation.
 */
import { state } from './state';
import type { AppCallbacks, UnitCellParams, Atom } from './types';

let _cb: AppCallbacks | null = null;

// ── Lattice UI sync ────────────────────────────────────────────────────────────

export function updateLatticeUI(
  unitCellParams: UnitCellParams | null | undefined,
  supercell: [number, number, number] | number[] | null | undefined,
  hasUnitCell: boolean
): void {
  const aInput = document.getElementById('lattice-a') as HTMLInputElement | null;
  const bInput = document.getElementById('lattice-b') as HTMLInputElement | null;
  const cInput = document.getElementById('lattice-c') as HTMLInputElement | null;
  const alphaInput = document.getElementById('lattice-alpha') as HTMLInputElement | null;
  const betaInput = document.getElementById('lattice-beta') as HTMLInputElement | null;
  const gammaInput = document.getElementById('lattice-gamma') as HTMLInputElement | null;
  const scaleToggle = document.getElementById('lattice-scale') as HTMLInputElement | null;
  const removeBtn = document.getElementById('btn-lattice-remove') as HTMLButtonElement | null;
  const centerBtn = document.getElementById('btn-center-cell') as HTMLButtonElement | null;
  const superX = document.getElementById('supercell-x') as HTMLInputElement | null;
  const superY = document.getElementById('supercell-y') as HTMLInputElement | null;
  const superZ = document.getElementById('supercell-z') as HTMLInputElement | null;

  if (unitCellParams) {
    if (aInput) aInput.value = Number(unitCellParams.a).toFixed(4);
    if (bInput) bInput.value = Number(unitCellParams.b).toFixed(4);
    if (cInput) cInput.value = Number(unitCellParams.c).toFixed(4);
    if (alphaInput) alphaInput.value = Number(unitCellParams.alpha).toFixed(2);
    if (betaInput) betaInput.value = Number(unitCellParams.beta).toFixed(2);
    if (gammaInput) gammaInput.value = Number(unitCellParams.gamma).toFixed(2);
  } else if (!state.unitCellEditing) {
    if (aInput) aInput.value = '';
    if (bInput) bInput.value = '';
    if (cInput) cInput.value = '';
    if (alphaInput) alphaInput.value = '';
    if (betaInput) betaInput.value = '';
    if (gammaInput) gammaInput.value = '';
  }

  if (scaleToggle) scaleToggle.checked = !!state.scaleAtomsWithLattice;
  if (removeBtn) removeBtn.disabled = !hasUnitCell;
  if (centerBtn) centerBtn.disabled = !hasUnitCell;

  const sc = Array.isArray(supercell) ? supercell : [1, 1, 1];
  const nx = Math.max(1, Math.floor(sc[0] || 1));
  const ny = Math.max(1, Math.floor(sc[1] || 1));
  const nz = Math.max(1, Math.floor(sc[2] || 1));
  if (superX) { superX.value = String(nx); superX.disabled = !hasUnitCell; }
  if (superY) { superY.value = String(ny); superY.disabled = !hasUnitCell; }
  if (superZ) { superZ.value = String(nz); superZ.disabled = !hasUnitCell; }
}

// ── Atom size panel ────────────────────────────────────────────────────────────

export function updateAtomSizePanel(): void {
  if (!_cb) { return; }
  const {
    clampAtomSize, getBaseAtomId, getAvailableElements,
    hasAtomSizeOverride, hasElementSizeOverride,
    getAtomSizeForAtomId, getAtomSizeForElement,
    cleanupAtomSizeOverrides, rerenderCurrentStructure,
    ATOM_SIZE_MIN, ATOM_SIZE_MAX,
  } = _cb;

  const globalSlider = document.getElementById('atom-size-global-slider') as HTMLInputElement | null;
  const globalValue = document.getElementById('atom-size-global-value') as HTMLElement | null;
  const useDefaultCheckbox = document.getElementById('atom-size-use-default') as HTMLInputElement | null;
  const selectedSection = document.getElementById('atom-size-selected-section') as HTMLElement | null;
  const selectedCount = document.getElementById('atom-size-selected-count') as HTMLElement | null;
  const selectedSlider = document.getElementById('atom-size-selected-slider') as HTMLInputElement | null;
  const selectedValue = document.getElementById('atom-size-selected-value') as HTMLElement | null;
  const resetSelectedButton = document.getElementById('btn-atom-size-reset-selected') as HTMLButtonElement | null;
  const elementToggle = document.getElementById('atom-size-element-toggle') as HTMLButtonElement | null;
  const elementList = document.getElementById('atom-size-element-list') as HTMLElement | null;

  if (!globalSlider || !globalValue || !useDefaultCheckbox || !selectedSection || !selectedCount ||
    !selectedSlider || !selectedValue || !resetSelectedButton || !elementToggle || !elementList) {
    return;
  }

  cleanupAtomSizeOverrides();

  const manualEnabled = state.atomSizeUseDefaultSettings === false;
  const selectedIds = Array.isArray(state.selectedAtomIds) ? state.selectedAtomIds : [];
  const selectedAtomCount = selectedIds.length;
  const currentSelectedId = selectedAtomCount > 0 ? selectedIds[selectedAtomCount - 1] : '';
  const selectedAtomSize = selectedAtomCount > 0
    ? getAtomSizeForAtomId(currentSelectedId)
    : clampAtomSize(state.atomSizeGlobal, 0.3);
  const selectedHasAtomOverride = selectedIds.some((id) => hasAtomSizeOverride(id));
  const availableElements = getAvailableElements();

  state.atomSizeGlobal = clampAtomSize(state.atomSizeGlobal, 0.3);
  globalSlider.value = state.atomSizeGlobal.toFixed(2);
  globalValue.textContent = `${state.atomSizeGlobal.toFixed(2)} Å`;
  globalSlider.disabled = !manualEnabled;
  useDefaultCheckbox.checked = !manualEnabled;

  selectedSection.style.display = selectedAtomCount > 0 ? '' : 'none';
  selectedCount.textContent = String(selectedAtomCount);
  selectedSlider.value = selectedAtomSize.toFixed(2);
  selectedValue.textContent = `${selectedAtomSize.toFixed(2)} Å`;
  selectedSlider.disabled = !manualEnabled;
  resetSelectedButton.disabled = !manualEnabled || !selectedHasAtomOverride;

  if (availableElements.length === 0) { state.atomSizeElementExpanded = false; }
  elementToggle.disabled = availableElements.length === 0;
  elementToggle.textContent = `By Element ${state.atomSizeElementExpanded ? '▲' : '▼'}`;
  elementList.style.display = state.atomSizeElementExpanded && availableElements.length > 0 ? '' : 'none';
  elementList.innerHTML = '';

  if (state.atomSizeElementExpanded && availableElements.length > 0) {
    for (const element of availableElements) {
      const size = getAtomSizeForElement(element);
      const hasOverride = hasElementSizeOverride(element);

      const row = document.createElement('div');
      row.className = `atom-size-element-row${hasOverride ? ' size-override' : ''}`;

      const header = document.createElement('div');
      header.className = 'atom-size-element-header';

      const title = document.createElement('span');
      title.textContent = `${element}: ${size.toFixed(2)} Å`;

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'atom-size-element-reset';
      resetButton.textContent = '↺';
      resetButton.disabled = !manualEnabled || !hasOverride;
      resetButton.onclick = () => {
        delete state.atomSizeByElement[element];
        updateAtomSizePanel();
        rerenderCurrentStructure();
      };

      header.appendChild(title);
      header.appendChild(resetButton);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(ATOM_SIZE_MIN);
      slider.max = String(ATOM_SIZE_MAX);
      slider.step = '0.01';
      slider.value = size.toFixed(2);
      slider.disabled = !manualEnabled;
      slider.oninput = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const nextSize = clampAtomSize(target.value, size);
        state.atomSizeByElement[element] = nextSize;
        updateAtomSizePanel();
        rerenderCurrentStructure();
      };

      row.appendChild(header);
      row.appendChild(slider);
      elementList.appendChild(row);
    }
  }
}

// ── UI wiring ──────────────────────────────────────────────────────────────────

export function setup(callbacks: AppCallbacks): void {
  _cb = callbacks;
  const { vscode, renderer, setError, rerenderCurrentStructure, updateCounts, updateAtomList,
    clampAtomSize, getBaseAtomId, ATOM_SIZE_MIN, ATOM_SIZE_MAX } = callbacks;

  // ── Lattice params ────────────────────────────────────────────────────────

  const latticeApply = document.getElementById('btn-lattice-apply') as HTMLButtonElement | null;
  const latticeRemove = document.getElementById('btn-lattice-remove') as HTMLButtonElement | null;
  const latticeCenter = document.getElementById('btn-center-cell') as HTMLButtonElement | null;
  const latticeScale = document.getElementById('lattice-scale') as HTMLInputElement | null;
  const latticeInputIds = ['lattice-a', 'lattice-b', 'lattice-c', 'lattice-alpha', 'lattice-beta', 'lattice-gamma'];
  const latticeInputs = latticeInputIds
    .map((id) => document.getElementById(id) as HTMLInputElement | null)
    .filter((el): el is HTMLInputElement => el !== null);

  if (latticeScale) {
    latticeScale.addEventListener('change', (event: Event) => {
      state.scaleAtomsWithLattice = (event.target as HTMLInputElement).checked;
    });
  }

  for (const input of latticeInputs) {
    input.addEventListener('input', () => { state.unitCellEditing = true; });
    input.addEventListener('blur', () => { state.unitCellEditing = false; });
  }

  if (latticeApply) {
    latticeApply.onclick = () => {
      const a = parseFloat((document.getElementById('lattice-a') as HTMLInputElement | null)?.value ?? '');
      const b = parseFloat((document.getElementById('lattice-b') as HTMLInputElement | null)?.value ?? '');
      const c = parseFloat((document.getElementById('lattice-c') as HTMLInputElement | null)?.value ?? '');
      const alpha = parseFloat((document.getElementById('lattice-alpha') as HTMLInputElement | null)?.value ?? '');
      const beta = parseFloat((document.getElementById('lattice-beta') as HTMLInputElement | null)?.value ?? '');
      const gamma = parseFloat((document.getElementById('lattice-gamma') as HTMLInputElement | null)?.value ?? '');
      if (![a, b, c, alpha, beta, gamma].every((value) => Number.isFinite(value))) {
        setError('Lattice parameters must be valid numbers.');
        return;
      }
      vscode.postMessage({
        command: 'setUnitCell',
        params: { a, b, c, alpha, beta, gamma },
        scaleAtoms: !!state.scaleAtomsWithLattice,
      });
      setError('');
    };
  }

  if (latticeRemove) { latticeRemove.onclick = () => { vscode.postMessage({ command: 'clearUnitCell' }); }; }
  if (latticeCenter) { latticeCenter.onclick = () => { vscode.postMessage({ command: 'centerToUnitCell' }); }; }

  // ── Supercell ─────────────────────────────────────────────────────────────

  const supercellApply = document.getElementById('btn-supercell-apply') as HTMLButtonElement | null;
  if (supercellApply) {
    supercellApply.onclick = () => {
      const nx = parseInt((document.getElementById('supercell-x') as HTMLInputElement | null)?.value ?? '', 10);
      const ny = parseInt((document.getElementById('supercell-y') as HTMLInputElement | null)?.value ?? '', 10);
      const nz = parseInt((document.getElementById('supercell-z') as HTMLInputElement | null)?.value ?? '', 10);
      if (![nx, ny, nz].every((value) => Number.isFinite(value) && value >= 1)) {
        setError('Supercell values must be integers >= 1.');
        return;
      }
      vscode.postMessage({ command: 'setSupercell', supercell: [nx, ny, nz] });
      setError('');
    };
  }

  // ── Scale / size sliders ───────────────────────────────────────────────────

  const scaleSlider = document.getElementById('scale-slider') as HTMLInputElement | null;
  const sizeSlider = document.getElementById('size-slider') as HTMLInputElement | null;
  const bondSizeSlider = document.getElementById('bond-size-slider') as HTMLInputElement | null;
  const scaleAuto = document.getElementById('scale-auto') as HTMLInputElement | null;

  if (scaleSlider) {
    scaleSlider.addEventListener('input', (event: Event) => {
      state.manualScale = parseFloat((event.target as HTMLInputElement).value);
      const scaleValue = document.getElementById('scale-value') as HTMLElement | null;
      if (scaleValue) scaleValue.textContent = state.manualScale.toFixed(1);
      if (!state.autoScaleEnabled && state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });
  }

  if (sizeSlider) {
    sizeSlider.addEventListener('input', (event: Event) => {
      state.atomSizeScale = parseFloat((event.target as HTMLInputElement).value);
      const sizeValue = document.getElementById('size-value') as HTMLElement | null;
      if (sizeValue) sizeValue.textContent = state.atomSizeScale.toFixed(2);
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });
  }

  if (bondSizeSlider) {
    bondSizeSlider.addEventListener('input', (event: Event) => {
      state.bondThicknessScale = parseFloat((event.target as HTMLInputElement).value);
      const bondSizeValue = document.getElementById('bond-size-value') as HTMLElement | null;
      if (bondSizeValue) bondSizeValue.textContent = state.bondThicknessScale.toFixed(1);
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });
  }

  if (scaleAuto) {
    scaleAuto.addEventListener('change', (event: Event) => {
      state.autoScaleEnabled = (event.target as HTMLInputElement).checked;
      if (state.currentStructure) {
        renderer.renderStructure(state.currentStructure, { updateCounts, updateAtomList });
      }
    });
  }

  // ── Projection select ─────────────────────────────────────────────────────

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

  // ── Atom size panel ────────────────────────────────────────────────────────

  const globalSlider = document.getElementById('atom-size-global-slider') as HTMLInputElement | null;
  const useDefaultCheckbox = document.getElementById('atom-size-use-default') as HTMLInputElement | null;
  const selectedSlider = document.getElementById('atom-size-selected-slider') as HTMLInputElement | null;
  const resetSelectedButton = document.getElementById('btn-atom-size-reset-selected') as HTMLButtonElement | null;
  const elementToggle = document.getElementById('atom-size-element-toggle') as HTMLButtonElement | null;

  if (globalSlider && useDefaultCheckbox && selectedSlider && resetSelectedButton && elementToggle) {
    globalSlider.addEventListener('input', (event: Event) => {
      state.atomSizeGlobal = clampAtomSize((event.target as HTMLInputElement).value, state.atomSizeGlobal || 0.3);
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    useDefaultCheckbox.addEventListener('change', (event: Event) => {
      state.atomSizeUseDefaultSettings = !!(event.target as HTMLInputElement).checked;
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    selectedSlider.addEventListener('input', (event: Event) => {
      if (state.atomSizeUseDefaultSettings !== false) {
        updateAtomSizePanel();
        return;
      }
      const nextSize = clampAtomSize((event.target as HTMLInputElement).value, state.atomSizeGlobal || 0.3);
      const selectedIds = Array.isArray(state.selectedAtomIds) ? state.selectedAtomIds : [];
      for (const atomId of selectedIds) {
        const baseId = getBaseAtomId(atomId);
        if (baseId) { state.atomSizeByAtom[baseId] = nextSize; }
      }
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    resetSelectedButton.addEventListener('click', () => {
      const selectedIds = Array.isArray(state.selectedAtomIds) ? state.selectedAtomIds : [];
      for (const atomId of selectedIds) {
        const baseId = getBaseAtomId(atomId);
        if (baseId) { delete state.atomSizeByAtom[baseId]; }
      }
      updateAtomSizePanel();
      rerenderCurrentStructure();
    });

    elementToggle.addEventListener('click', () => {
      state.atomSizeElementExpanded = !state.atomSizeElementExpanded;
      updateAtomSizePanel();
    });

    updateAtomSizePanel();
  }
}
