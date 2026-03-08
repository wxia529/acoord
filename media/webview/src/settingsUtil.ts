import type { VsCodeApi } from './types';
import { extractDisplaySettings } from './state';

let _vscode: VsCodeApi | null = null;

export function initSettingsUtil(vscode: VsCodeApi): void {
  _vscode = vscode;
}

let _settingsTimer: ReturnType<typeof setTimeout> | null = null;

export function updateSettings(): void {
  if (_settingsTimer) {
    clearTimeout(_settingsTimer);
  }
  _settingsTimer = setTimeout(() => {
    _settingsTimer = null;
    const settings = extractDisplaySettings();
    _vscode?.postMessage({ command: 'updateDisplaySettings', settings });
  }, 80);
}
