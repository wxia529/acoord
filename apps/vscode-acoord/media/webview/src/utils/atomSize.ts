import { state } from '../state';
import type { Atom } from '../types';

export const ATOM_SIZE_MIN = 0.1;
export const ATOM_SIZE_MAX = 2.0;

export function clampAtomSize(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) { return fallback; }
  return Math.max(ATOM_SIZE_MIN, Math.min(ATOM_SIZE_MAX, parsed));
}

export function getBaseAtomId(atomId: string): string {
  if (typeof atomId !== 'string') { return ''; }
  return atomId.split('::')[0];
}

export function getCurrentStructureAtoms(): Atom[] {
  if (!state.currentStructure || !Array.isArray(state.currentStructure.atoms)) { return []; }
  return state.currentStructure.atoms;
}

export function getAvailableElements(): string[] {
  const elementSet = new Set<string>();
  for (const atom of getCurrentStructureAtoms()) {
    if (atom && typeof atom.element === 'string' && atom.element.trim().length > 0) {
      elementSet.add(atom.element);
    }
  }
  return Array.from(elementSet).sort((a, b) => a.localeCompare(b));
}

export function cleanupAtomSizeOverrides(): void {
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

export function hasAtomSizeOverride(atomId: string): boolean {
  const baseId = getBaseAtomId(atomId);
  return Number.isFinite(state.atomSizeByAtom && state.atomSizeByAtom[baseId]);
}

export function hasElementSizeOverride(element: string): boolean {
  return Number.isFinite(state.atomSizeByElement && state.atomSizeByElement[element]);
}

export function getFallbackRadiusForAtom(atom: Atom | null): number {
  if (atom && Number.isFinite(atom.radius)) { return atom.radius; }
  return clampAtomSize(state.atomSizeGlobal, 0.3);
}

export function getAtomSizeForAtomId(atomId: string): number {
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

export function getAtomSizeForElement(element: string): number {
  const atom = getCurrentStructureAtoms().find((candidate) => candidate.element === element) || null;
  const fallback = getFallbackRadiusForAtom(atom);
  if (state.atomSizeUseDefaultSettings !== false) { return fallback; }
  const elementOverride = state.atomSizeByElement && state.atomSizeByElement[element];
  if (Number.isFinite(elementOverride)) { return clampAtomSize(elementOverride, fallback); }
  return clampAtomSize(state.atomSizeGlobal, fallback);
}