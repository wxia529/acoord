import { state } from './state';
import { renderer } from './renderer';
import type { VsCodeApi, DisplaySettings } from './types';

let _vscode: VsCodeApi | null = null;
let _showStatus: ((msg: string) => void) | null = null;
let _updateConfigSelectorFn: (() => void) | null = null;
let _rerenderStructureFn: (() => void) | null = null;
let _settingsTimer: ReturnType<typeof setTimeout> | null = null;

export function init(
  vscode: VsCodeApi,
  showStatus: (msg: string) => void,
  updateConfigSelectorFn: () => void,
  rerenderStructureFn?: () => void
): void {
  _vscode = vscode;
  _showStatus = showStatus;
  _updateConfigSelectorFn = updateConfigSelectorFn;
  _rerenderStructureFn = rerenderStructureFn ?? null;
}

function postMessage(message: unknown): void {
  _vscode?.postMessage(message);
}

export function requestConfigList(): void {
  postMessage({ command: 'getDisplayConfigs' });
}

export function loadConfig(configId: string): void {
  state.isLoadingConfig = true;
  postMessage({ command: 'loadDisplayConfig', configId });
}

export function saveAsUserConfig(name: string, description?: string): void {
  const settings = state.extractDisplaySettings();
  postMessage({ command: 'saveDisplayConfig', name, description, settings });
}

export function getCurrentSettings(): void {
  postMessage({ command: 'getCurrentDisplaySettings' });
}

export function updateSettings(): void {
  if (_settingsTimer) {
    clearTimeout(_settingsTimer);
  }
  _settingsTimer = setTimeout(() => {
    _settingsTimer = null;
    const settings = state.extractDisplaySettings();
    postMessage({ command: 'updateDisplaySettings', settings });
  }, 80);
}

function updateConfigUI(): void {
  _updateConfigSelectorFn?.();
}

function handleConfigsLoaded(presets: unknown, user: unknown): void {
  state.availableConfigs = {
    presets: Array.isArray(presets) ? presets : [],
    user: Array.isArray(user) ? user : [],
  };
  updateConfigUI();
}

function handleConfigLoaded(config: { id: string; name: string; settings: DisplaySettings } | null | undefined): void {
  if (!config || !config.settings) {
    console.error('Invalid config loaded');
    state.isLoadingConfig = false;
    return;
  }

  state.applyDisplaySettings(config.settings);
  state.currentConfigId = config.id;
  state.currentConfigName = config.name;
  state.isLoadingConfig = false;

  updateUI();
  renderer.updateDisplaySettings();
  renderer.updateLighting();
  // Rerender the full structure so lattice thickness/line-style changes take effect
  _rerenderStructureFn?.();
  updateConfigUI();

  if (_showStatus) {
    _showStatus(`Loaded configuration: ${config.name}`);
  }
}

function handleConfigSaved(config: { name: string } | null | undefined): void {
  if (config) {
    requestConfigList();
    if (_showStatus) {
      _showStatus(`Saved configuration: ${config.name}`);
    }
  }
}

export function handleMessage(message: { command: string; [key: string]: unknown }): void {
  switch (message.command) {
    case 'displayConfigsLoaded':
      handleConfigsLoaded(message.presets, message.user);
      break;

    case 'displayConfigLoaded':
      handleConfigLoaded(message.config as { id: string; name: string; settings: DisplaySettings } | null);
      break;

    case 'displayConfigSaved':
      handleConfigSaved(message.config as { name: string } | null);
      break;

    case 'displayConfigChanged':
      if (message.config) {
        handleConfigLoaded(message.config as { id: string; name: string; settings: DisplaySettings });
      }
      break;

    case 'currentDisplaySettings':
      if (message.settings) {
        state.applyDisplaySettings(message.settings as DisplaySettings);
        updateUI();
      }
      break;

    case 'displayConfigError':
      console.error('Display config error:', message.error);
      state.isLoadingConfig = false;
      break;

    case 'render':
      if (message.displaySettings) {
        state.applyDisplaySettings(message.displaySettings as DisplaySettings);
        updateUI();
      }
      break;
  }
}

export function updateUI(): void {
  const getLightValue = (light: { intensity?: number; color?: string; x?: number; y?: number; z?: number } | null | undefined, prop: string): number | string => {
    if (!light) return 0;
    return (light as Record<string, unknown>)[prop] as number | string ?? 0;
  };

  const setInput = (id: string, value: unknown): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) (el as HTMLInputElement).value = String(value ?? '');
  };
  const setChecked = (id: string, value: boolean): void => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = value;
  };
  const setText = (id: string, value: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setChecked('show-axes', state.showAxes);

  setInput('bg-color-picker', state.backgroundColor);
  setInput('bg-color-text', state.backgroundColor);

  setInput('lattice-color-picker', state.unitCellColor);
  setInput('lattice-color-text', state.unitCellColor);

  setInput('lattice-thickness-slider', state.unitCellThickness);
  setText('lattice-thickness-value', state.unitCellThickness.toFixed(1));

  setInput('lattice-line-style', state.unitCellLineStyle);

  setInput('atom-size-global-slider', state.atomSizeGlobal);
  setText('atom-size-global-value', state.atomSizeGlobal.toFixed(2) + ' Å');

  setChecked('atom-size-use-default', state.atomSizeUseDefaultSettings);

  setInput('bond-size-slider', state.bondThicknessScale);
  setText('bond-size-value', state.bondThicknessScale.toFixed(1) + 'x');

  setInput('scale-slider', state.manualScale);
  setText('scale-value', state.manualScale.toFixed(1) + 'x');

  setChecked('scale-auto', !!state.autoScaleEnabled);

  setInput('size-slider', state.atomSizeScale);
  setText('size-value', state.atomSizeScale.toFixed(2) + 'x');

  setChecked('lighting-enabled', state.lightingEnabled);

  setInput('ambient-slider', state.ambientIntensity);
  setText('ambient-value', state.ambientIntensity.toFixed(1));
  setInput('ambient-color-picker', state.ambientColor);

  setInput('shininess-slider', state.shininess);
  setText('shininess-value', state.shininess.toString());

  setInput('proj-select', state.projectionMode);
  setChecked('lattice-scale', !!state.scaleAtomsWithLattice);

  // Key light
  setInput('key-intensity-slider', getLightValue(state.keyLight, 'intensity'));
  setText('key-intensity-value', Number(getLightValue(state.keyLight, 'intensity')).toFixed(1));
  setInput('key-color-picker', getLightValue(state.keyLight, 'color'));
  setInput('key-x-slider', getLightValue(state.keyLight, 'x'));
  setText('key-x-value', String(getLightValue(state.keyLight, 'x')));
  setInput('key-y-slider', getLightValue(state.keyLight, 'y'));
  setText('key-y-value', String(getLightValue(state.keyLight, 'y')));
  setInput('key-z-slider', getLightValue(state.keyLight, 'z'));
  setText('key-z-value', String(getLightValue(state.keyLight, 'z')));

  // Fill light
  setInput('fill-intensity-slider', getLightValue(state.fillLight, 'intensity'));
  setText('fill-intensity-value', Number(getLightValue(state.fillLight, 'intensity')).toFixed(1));
  setInput('fill-color-picker', getLightValue(state.fillLight, 'color'));
  setInput('fill-x-slider', getLightValue(state.fillLight, 'x'));
  setText('fill-x-value', String(getLightValue(state.fillLight, 'x')));
  setInput('fill-y-slider', getLightValue(state.fillLight, 'y'));
  setText('fill-y-value', String(getLightValue(state.fillLight, 'y')));
  setInput('fill-z-slider', getLightValue(state.fillLight, 'z'));
  setText('fill-z-value', String(getLightValue(state.fillLight, 'z')));

  // Rim light
  setInput('rim-intensity-slider', getLightValue(state.rimLight, 'intensity'));
  setText('rim-intensity-value', Number(getLightValue(state.rimLight, 'intensity')).toFixed(1));
  setInput('rim-color-picker', getLightValue(state.rimLight, 'color'));
  setInput('rim-x-slider', getLightValue(state.rimLight, 'x'));
  setText('rim-x-value', String(getLightValue(state.rimLight, 'x')));
  setInput('rim-y-slider', getLightValue(state.rimLight, 'y'));
  setText('rim-y-value', String(getLightValue(state.rimLight, 'y')));
  setInput('rim-z-slider', getLightValue(state.rimLight, 'z'));
  setText('rim-z-value', String(getLightValue(state.rimLight, 'z')));
}
