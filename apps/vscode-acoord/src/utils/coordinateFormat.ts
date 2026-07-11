/** Format one finite coordinate as a fixed-point, right-aligned field. */
export function formatCoordinate(value: number, precision: number = 10, width?: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`formatCoordinate: non-finite value ${value}`);
  }
  const zeroThreshold = 0.5 * 10 ** -precision;
  const cleaned = Math.abs(value) < zeroThreshold ? 0 : value;
  return cleaned.toFixed(precision).padStart(width ?? precision + 6);
}

/** Format a three-component coordinate row with stable aligned columns. */
export function formatCoordinateTriplet(
  values: readonly [number, number, number] | readonly number[],
  precision: number = 10,
  width?: number
): string {
  if (values.length !== 3) {
    throw new Error(`formatCoordinateTriplet: expected 3 values, got ${values.length}`);
  }
  return values.map((value) => formatCoordinate(value, precision, width)).join('  ');
}
