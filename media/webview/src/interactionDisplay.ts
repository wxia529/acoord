import { state } from './state';
import { renderer } from './renderer';
import { updateSettings } from './configHandler';

export function init(): void {
  const showAxes = document.getElementById('show-axes') as HTMLInputElement | null;
  const bgColorPicker = document.getElementById('bg-color-picker') as HTMLInputElement | null;
  const bgColorText = document.getElementById('bg-color-text') as HTMLInputElement | null;
  const latticeColorPicker = document.getElementById('lattice-color-picker') as HTMLInputElement | null;
  const latticeColorText = document.getElementById('lattice-color-text') as HTMLInputElement | null;
  const latticeThicknessSlider = document.getElementById('lattice-thickness-slider') as HTMLInputElement | null;
  const latticeThicknessValue = document.getElementById('lattice-thickness-value');
  const latticeLineStyle = document.getElementById('lattice-line-style') as HTMLSelectElement | null;

  const rerenderStructure = (): void => {
    if (!state.currentStructure) return;
    // Dynamically imported to avoid circular dep at module load time.
    // renderer.renderStructure is safe to call here since this runs only on user events.
    renderer.renderStructure(state.currentStructure);
  };

  if (showAxes) {
    showAxes.checked = state.showAxes !== false;
    showAxes.addEventListener('change', () => {
      state.showAxes = showAxes.checked;
      renderer.updateDisplaySettings();
      updateSettings();
    });
  }

  if (bgColorPicker && bgColorText) {
    bgColorPicker.addEventListener('input', () => {
      state.backgroundColor = bgColorPicker.value;
      bgColorText.value = bgColorPicker.value;
      renderer.updateDisplaySettings();
      updateSettings();
    });

    bgColorText.addEventListener('change', () => {
      const color = bgColorText.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        state.backgroundColor = color;
        bgColorPicker.value = color;
        renderer.updateDisplaySettings();
        updateSettings();
      }
    });
  }

  if (latticeColorPicker && latticeColorText) {
    latticeColorPicker.addEventListener('input', () => {
      state.unitCellColor = latticeColorPicker.value;
      latticeColorText.value = latticeColorPicker.value;
      renderer.updateDisplaySettings();
      updateSettings();
    });

    latticeColorText.addEventListener('change', () => {
      const color = latticeColorText.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        state.unitCellColor = color;
        latticeColorPicker.value = color;
        renderer.updateDisplaySettings();
        updateSettings();
      }
    });
  }

  if (latticeThicknessSlider) {
    const initialThickness = Number.isFinite(state.unitCellThickness) ? state.unitCellThickness : 1;
    latticeThicknessSlider.value = String(initialThickness);
    if (latticeThicknessValue) latticeThicknessValue.textContent = initialThickness.toFixed(1);
    latticeThicknessSlider.addEventListener('input', () => {
      const nextThickness = Math.max(0.5, Math.min(6, parseFloat(latticeThicknessSlider.value) || 1));
      state.unitCellThickness = nextThickness;
      if (latticeThicknessValue) latticeThicknessValue.textContent = nextThickness.toFixed(1);
      rerenderStructure();
      updateSettings();
    });
  }

  if (latticeLineStyle) {
    latticeLineStyle.value = state.unitCellLineStyle === 'dashed' ? 'dashed' : 'solid';
    latticeLineStyle.addEventListener('change', () => {
      state.unitCellLineStyle = latticeLineStyle.value === 'dashed' ? 'dashed' : 'solid';
      rerenderStructure();
      updateSettings();
    });
  }
}
