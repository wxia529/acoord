export const DEFAULT_ATOM_BRUSH_MAX_DISTANCE = 1.54;
export const MIN_ATOM_BRUSH_MAX_DISTANCE = 0.2;
export const ATOM_BRUSH_ACTIVATION_DISTANCE = 0.15;

/** Normalize the minimum distance between atoms painted during a drag stroke. */
export function normalizeAtomBrushMaxDistance(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed)
    ? Math.max(parsed, MIN_ATOM_BRUSH_MAX_DISTANCE)
    : DEFAULT_ATOM_BRUSH_MAX_DISTANCE;
}

/** Clamp a pull-out gesture distance and report whether it passed activation. */
export function resolveAtomBrushDistance(
  distance: number,
  maxDistance: number,
  activationDistance: number = ATOM_BRUSH_ACTIVATION_DISTANCE
): number | null {
  if (!Number.isFinite(distance) || distance < activationDistance) return null;
  return Math.min(distance, normalizeAtomBrushMaxDistance(maxDistance));
}
