/**
 * Cache for DOM elements to avoid repeated getElementById calls
 */

const elementCache = new Map<string, HTMLElement>();

export function getElementById<T extends HTMLElement = HTMLElement>(
  id: string
): T | null {
  if (elementCache.has(id)) {
    return elementCache.get(id) as T;
  }

  const element = document.getElementById(id) as T | null;
  if (element) {
    elementCache.set(id, element);
  }
  return element;
}

export function clearElementCache(): void {
  elementCache.clear();
}
