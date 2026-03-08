import { colorSchemeStore, displayStore } from './state';
import * as colorSchemeHandler from './colorSchemeHandler';
import type { VsCodeApi } from './types';

let _vscode: VsCodeApi | null = null;

export function initVscode(vscode: VsCodeApi): void {
  _vscode = vscode;
}

export function init(): void {
  const colorSchemeSelect = document.getElementById('color-scheme-select') as HTMLSelectElement | null;
  const btnRefreshSchemes = document.getElementById('btn-refresh-schemes') as HTMLButtonElement | null;
  const btnSaveScheme = document.getElementById('btn-save-scheme') as HTMLButtonElement | null;
  const btnExportScheme = document.getElementById('btn-export-scheme') as HTMLButtonElement | null;
  const btnImportScheme = document.getElementById('btn-import-scheme') as HTMLButtonElement | null;
  const btnDeleteScheme = document.getElementById('btn-delete-scheme') as HTMLButtonElement | null;

  if (colorSchemeSelect) {
    colorSchemeSelect.addEventListener('change', () => {
      const schemeId = colorSchemeSelect.value;
      if (schemeId) {
        colorSchemeHandler.loadScheme(schemeId);
      }
    });
  }

  if (btnRefreshSchemes) {
    btnRefreshSchemes.addEventListener('click', () => {
      colorSchemeHandler.requestSchemeList();
    });
  }

  if (btnSaveScheme) {
    btnSaveScheme.addEventListener('click', () => {
      const colors: Record<string, string> = Object.keys(colorSchemeStore.currentSchemeColors).length > 0
        ? { ...colorSchemeStore.currentSchemeColors }
        : { ...displayStore.currentColorByElement };
      _vscode?.postMessage({ command: 'promptSaveColorScheme', colors: Object.keys(colors).length > 0 ? colors : undefined });
    });
  }

  if (btnExportScheme) {
    btnExportScheme.addEventListener('click', () => {
      const schemeId = colorSchemeSelect ? colorSchemeSelect.value : null;
      if (!schemeId) {
        window.alert('Please select a color scheme to export.');
        return;
      }
      colorSchemeHandler.exportScheme(schemeId);
    });
  }

  if (btnImportScheme) {
    btnImportScheme.addEventListener('click', () => {
      colorSchemeHandler.importScheme();
    });
  }

  if (btnDeleteScheme) {
    btnDeleteScheme.addEventListener('click', () => {
      const schemeId = colorSchemeSelect ? colorSchemeSelect.value : null;
      if (!schemeId) { return; }
      if (!window.confirm('Are you sure you want to delete this color scheme?')) { return; }
      colorSchemeHandler.deleteScheme(schemeId);
    });
  }

  updateColorSchemeSelector();
}

export function updateColorSchemeSelector(): void {
  const colorSchemeSelect = document.getElementById('color-scheme-select') as HTMLSelectElement | null;
  const colorSchemeInfo = document.getElementById('color-scheme-info') as HTMLElement | null;
  if (!colorSchemeSelect) { return; }

  colorSchemeSelect.innerHTML = '';

  const presets = colorSchemeStore.availableSchemes.presets || [];
  if (presets.length > 0) {
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = 'Presets';
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      if (preset.id === colorSchemeStore.currentSchemeId) {
        option.selected = true;
      }
      presetGroup.appendChild(option);
    }
    colorSchemeSelect.appendChild(presetGroup);
  }

  const userSchemes = colorSchemeStore.availableSchemes.user || [];
  if (userSchemes.length > 0) {
    const userGroup = document.createElement('optgroup');
    userGroup.label = 'Your Schemes';
    for (const scheme of userSchemes) {
      const option = document.createElement('option');
      option.value = scheme.id;
      option.textContent = scheme.name;
      if (scheme.id === colorSchemeStore.currentSchemeId) {
        option.selected = true;
      }
      userGroup.appendChild(option);
    }
    colorSchemeSelect.appendChild(userGroup);
  }

  if (colorSchemeInfo) {
    const currentScheme = [...presets, ...userSchemes].find((s) => s.id === colorSchemeStore.currentSchemeId);
    colorSchemeInfo.textContent = (currentScheme && currentScheme.description) ? currentScheme.description : '';
  }
}
