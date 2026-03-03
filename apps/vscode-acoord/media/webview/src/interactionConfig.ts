import { state } from './state';
import * as configHandler from './configHandler';
import type { VsCodeApi } from './types';

let _vscode: VsCodeApi | null = null;

/** Called from app.ts before interaction.init() — stores the vscode API handle. */
export function initVscode(vscode: VsCodeApi): void {
  _vscode = vscode;
}

/**
 * Wire up all Config panel controls (config selector, save/export/import/delete).
 * Called from interaction.ts init() after DOM is ready.
 */
export function init(): void {
  const configSelect = document.getElementById('config-select') as HTMLSelectElement | null;
  const btnRefreshConfigs = document.getElementById('btn-refresh-configs') as HTMLButtonElement | null;
  const btnSaveConfig = document.getElementById('btn-save-config') as HTMLButtonElement | null;
  const btnExportConfig = document.getElementById('btn-export-config') as HTMLButtonElement | null;
  const btnImportConfig = document.getElementById('btn-import-config') as HTMLButtonElement | null;
  const btnDeleteConfig = document.getElementById('btn-delete-config') as HTMLButtonElement | null;

  // Config selection change
  if (configSelect) {
    configSelect.addEventListener('change', () => {
      const configId = configSelect.value;
      if (configId) {
        configHandler.loadConfig(configId);
      }
    });
  }

  // Refresh configs
  if (btnRefreshConfigs) {
    btnRefreshConfigs.addEventListener('click', () => {
      configHandler.requestConfigList();
    });
  }

  // Save config
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
      const name = prompt('Enter configuration name:', 'My Config');
      if (!name) { return; }
      const description = prompt('Enter description (optional):', '');
      configHandler.saveAsUserConfig(name, description || undefined);
    });
  }

  // Export config
  if (btnExportConfig) {
    btnExportConfig.addEventListener('click', () => {
      _vscode?.postMessage({ command: 'exportDisplayConfigs' });
    });
  }

  // Import config
  if (btnImportConfig) {
    btnImportConfig.addEventListener('click', () => {
      _vscode?.postMessage({ command: 'importDisplayConfigs' });
    });
  }

  // Delete config
  if (btnDeleteConfig) {
    btnDeleteConfig.addEventListener('click', () => {
      const configId = configSelect ? configSelect.value : null;
      if (!configId) {
        alert('Please select a configuration to delete');
        return;
      }

      // Only user configs may be deleted (not presets)
      const isUserConfig = state.availableConfigs.user.some((c) => c.id === configId);
      if (!isUserConfig) {
        alert('Cannot delete preset configurations');
        return;
      }

      if (confirm('Are you sure you want to delete this configuration?')) {
        _vscode?.postMessage({
          command: 'deleteDisplayConfig',
          configId,
        });
      }
    });
  }

  // Initial population
  updateConfigSelector();
}

export function updateConfigSelector(): void {
  const configSelect = document.getElementById('config-select') as HTMLSelectElement | null;
  const configInfo = document.getElementById('config-info') as HTMLElement | null;
  if (!configSelect) { return; }

  configSelect.innerHTML = '';

  // Add presets group
  const presets = state.availableConfigs.presets || [];
  if (presets.length > 0) {
    const presetGroup = document.createElement('optgroup');
    presetGroup.label = 'Presets';
    for (const preset of presets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.name;
      if (preset.id === state.currentConfigId) {
        option.selected = true;
      }
      presetGroup.appendChild(option);
    }
    configSelect.appendChild(presetGroup);
  }

  // Add user configs group
  const userConfigs = state.availableConfigs.user || [];
  if (userConfigs.length > 0) {
    const userGroup = document.createElement('optgroup');
    userGroup.label = 'Your Configs';
    for (const config of userConfigs) {
      const option = document.createElement('option');
      option.value = config.id;
      option.textContent = config.name;
      if (config.id === state.currentConfigId) {
        option.selected = true;
      }
      userGroup.appendChild(option);
    }
    configSelect.appendChild(userGroup);
  }

  // Update config info
  if (configInfo) {
    const currentConfig = [...presets, ...userConfigs].find((c) => c.id === state.currentConfigId);
    configInfo.textContent = (currentConfig && currentConfig.description) ? currentConfig.description : '';
  }
}
