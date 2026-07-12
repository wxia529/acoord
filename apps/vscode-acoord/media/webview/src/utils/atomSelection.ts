/** Format selected atom IDs as compact 1-based indices in structure order. */
export function formatSelectedAtomIndices(
  atomIds: string[],
  selectedAtomIds: string[],
  indexBase: 0 | 1 = 1
): string {
  const selected = new Set(selectedAtomIds);
  const indices = atomIds
    .map((id, index) => selected.has(id) ? index + indexBase : null)
    .filter((index): index is number => index !== null);
  const parts: string[] = [];
  for (let start = 0; start < indices.length;) {
    let end = start;
    while (end + 1 < indices.length && indices[end + 1] === indices[end] + 1) end++;
    const length = end - start + 1;
    if (length >= 3) {
      parts.push(`${indices[start]}-${indices[end]}`);
    } else {
      for (let i = start; i <= end; i++) parts.push(String(indices[i]));
    }
    start = end + 1;
  }
  return parts.join(',');
}
