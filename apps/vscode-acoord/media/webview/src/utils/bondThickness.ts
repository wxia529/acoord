/**
 * Bond thickness helper utilities.
 *
 * Webview UI and model now both use Angstrom thickness directly (no scale conversion).
 */

export const DEFAULT_BOND_THICKNESS_ANGSTROM = 0.04;

export function normalizeBondThickness(
  value: number,
  fallback: number = DEFAULT_BOND_THICKNESS_ANGSTROM
): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function areBondThicknessesMixed(
  values: number[],
  tolerance: number = 1e-6
): boolean {
  if (values.length <= 1) {
    return false;
  }
  const first = values[0];
  return values.some((v) => Math.abs(v - first) > tolerance);
}
