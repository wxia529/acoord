/** Format Cartesian coordinates for plain-text clipboard export. */
export function formatCoordinatesForClipboard(position: [number, number, number]): string {
  return position.map((value) => Number(value.toFixed(10)).toString()).join(',');
}
