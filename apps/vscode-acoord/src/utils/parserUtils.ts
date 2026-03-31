/**
 * Shared utilities for structure-file parsers.
 *
 * These helpers replace identical private methods that were previously
 * copy-pasted across poscarParser, xdatcarParser, outcarParser, xyzParser,
 * gjfParser, struParser, and qeParser.
 */

/**
 * Expand a list of element symbols by their atom counts.
 *
 * @example
 * expandElements(['Fe', 'O'], [2, 3]) → ['Fe', 'Fe', 'O', 'O', 'O']
 */
export function expandElements(elements: string[], counts: number[]): string[] {
  const expanded: string[] = [];
  for (let i = 0; i < counts.length; i++) {
    const element = elements[i] ?? 'X';
    const count = Math.max(0, counts[i] ?? 0);
    for (let n = 0; n < count; n++) {
      expanded.push(element);
    }
  }
  return expanded;
}

/**
 * Convert fractional (direct) coordinates to Cartesian coordinates using
 * three lattice vectors supplied as row vectors [a, b, c].
 */
export function fractionalToCartesian(
  fx: number,
  fy: number,
  fz: number,
  latticeVectors: number[][]
): [number, number, number] {
  const [a, b, c] = latticeVectors;
  return [
    fx * a[0] + fy * b[0] + fz * c[0],
    fx * a[1] + fy * b[1] + fz * c[1],
    fx * a[2] + fy * b[2] + fz * c[2],
  ];
}
