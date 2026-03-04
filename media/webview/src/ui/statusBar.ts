import { structureStore } from '../state';
import { getFractionalCoords } from '../utils/measurements';

let renderStatus = 'Ready.';
export let statusSelectionLock = false;
let lastStatusSelectedId: string | null = null;

export function setError(message: string): void {
  const banner = document.getElementById('error-banner') as HTMLElement | null;
  if (!banner) { return; }
  banner.textContent = message || '';
  banner.style.display = message ? 'block' : 'none';
}

export function setStatus(message: string): void {
  renderStatus = message || 'Ready.';
  updateStatusBar();
}

export function updateStatusBar(force?: boolean): void {
  const statusEl = document.getElementById('status-text') as HTMLElement | null;
  if (!statusEl) return;
  const selected = structureStore.currentSelectedAtom;
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
  const frac = getFractionalCoords(cart, structureStore.currentStructure && structureStore.currentStructure.unitCellParams);
  const fracText = frac
    ? ` | Frac: ${frac[0].toFixed(4)}, ${frac[1].toFixed(4)}, ${frac[2].toFixed(4)}`
    : '';
  statusEl.textContent = `${renderStatus} | Selected: ${selected.element} | ${cartText}${fracText}`;
  lastStatusSelectedId = selectedId;
}

export function syncStatusSelectionLock(): void {
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