/**
 * Element utility functions for webview.
 */

export function parseElement(input: string): string | undefined {
  if (!input) return undefined;
  // Matches element symbol at the beginning (e.g., "C12" -> "C", "Fe1" -> "Fe")
  const match = input.match(/^[A-Z][a-z]?/);
  return match ? match[0] : undefined;
}
