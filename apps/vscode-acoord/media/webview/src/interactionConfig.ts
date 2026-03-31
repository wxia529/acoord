import { colorSchemeStore, displayStore } from './state';
import * as colorSchemeHandler from './colorSchemeHandler';
import type { VsCodeApi } from './types';

let _vscode: VsCodeApi | null = null;

// vscode-dropdown is a custom element with a 'value' property
type VscodeDropdown = HTMLElement & { value: string };

export function initVscode(vscode: VsCodeApi): void {
  _vscode = vscode;
}

export function init(): void {
  const colorSchemeSelect = document.getElementById('color-scheme-select') as VscodeDropdown | null;
  const btnRefreshSchemes = document.getElementById('btn-refresh-schemes') as HTMLElement | null;
  const btnSaveScheme = document.getElementById('btn-save-scheme') as HTMLElement | null;
  const btnExportScheme = document.getElementById('btn-export-scheme') as HTMLElement | null;
  const btnImportScheme = document.getElementById('btn-import-scheme') as HTMLElement | null;
  const btnDeleteScheme = document.getElementById('btn-delete-scheme') as HTMLElement | null;

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
  const colorSchemeSelect = document.getElementById('color-scheme-select') as VscodeDropdown | null;
  const colorSchemeInfo = document.getElementById('color-scheme-info') as HTMLElement | null;
  if (!colorSchemeSelect) { return; }

  colorSchemeSelect.innerHTML = '';

  const presets = colorSchemeStore.availableSchemes.presets || [];
  if (presets.length > 0) {
    for (const preset of presets) {
      const option = document.createElement('vscode-option');
      option.setAttribute('value', preset.id);
      option.textContent = preset.name;
      if (preset.id === colorSchemeStore.currentSchemeId) {
        option.setAttribute('selected', '');
      }
      colorSchemeSelect.appendChild(option);
    }
  }

  const userSchemes = colorSchemeStore.availableSchemes.user || [];
  if (userSchemes.length > 0) {
    for (const scheme of userSchemes) {
      const option = document.createElement('vscode-option');
      option.setAttribute('value', scheme.id);
      option.textContent = scheme.name;
      if (scheme.id === colorSchemeStore.currentSchemeId) {
        option.setAttribute('selected', '');
      }
      colorSchemeSelect.appendChild(option);
    }
  }

  if (colorSchemeInfo) {
    const currentScheme = [...presets, ...userSchemes].find((s) => s.id === colorSchemeStore.currentSchemeId);
    colorSchemeInfo.textContent = (currentScheme && currentScheme.description) ? currentScheme.description : '';
  }
}
