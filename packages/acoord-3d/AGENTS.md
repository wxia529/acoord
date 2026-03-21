# AGENTS.md

This file provides guidance for AI agents working in this repository.

## Build / Lint / Test Commands

```bash
# Build the project
npm run build        # Production build (esbuild → dist/index.js)

# Development mode with watch
npm run watch

# Run all tests
npm test

# Run a single test file
npx mocha --import tsx --timeout 5000 'test/renderer/factory.test.ts'

# Run tests matching a pattern
npx mocha --import tsx --timeout 5000 'test/**/*.test.ts' --grep "createRenderer"
```

**Note:** There is no separate lint command. The project uses TypeScript's strict mode and esbuild for type checking during build.

## Project Overview

- **acoord-3d**: Atomic structure 3D rendering engine powered by Three.js
- **Tech Stack**: TypeScript 5.9+, Three.js r183, esbuild, Mocha + Chai
- **Module System**: ESNext with ESM format (`.js` extension in import paths)

## Code Style Guidelines

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`
- Use `interface` for object shapes; use `type` for unions, aliases, and primitives
- Always use explicit return types on public functions
- Prefer `unknown` over `any`; use type guards when narrowing

### Imports

```typescript
// Named imports (preferred)
import { debounce, throttle } from './utils/performance.js';

// Type-only imports (required for types)
import type { RendererHandlers } from './types.js';
import type * as THREE from 'three';

// Namespace import for Three.js (required for static members)
import * as THREE from 'three';

// Relative paths must include .js extension for ESM
```

### Naming Conventions

| Kind | Convention | Example |
|------|------------|---------|
| Types/Interfaces | PascalCase | `StructureRenderer`, `Atom` |
| Classes | PascalCase | `StructureRenderer` |
| Variables/Functions | camelCase | `renderStructure`, `atomMeshes` |
| Constants | SCREAMING_SNAKE_CASE | `CAMERA_TARGET_DIMENSION` |
| Private members | `private` keyword | `private readonly handlers: RendererHandlers` |
| Scratch/temp variables | Leading underscore | `_container`, `_onResizeDebounced` |
| Interface前缀 | None (not `IInterface`) | `StoreProvider`, not `IStoreProvider` |

### File Structure

```
src/
├── index.ts                    # Public API exports only
├── renderer/
│   ├── factory.ts              # Factory function (createRenderer)
│   ├── renderer.ts             # Core implementation (StructureRenderer class)
│   └── types.ts                # Renderer-specific types
├── state/
│   ├── store.ts                # State interfaces and defaults
│   └── provider.ts             # Store provider implementation
├── types/
│   └── wire.ts                 # Wire protocol types (Atom, Bond, etc.)
├── utils/
│   └── performance.ts          # debounce, throttle utilities
└── axis-indicator/
    └── index.ts                # Axis indicator component
```

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Section headers**: Use decorative dividers
  ```typescript
  // ─────────────────────────────────────────────────────────────────────────────
  // Structure Store
  // ─────────────────────────────────────────────────────────────────────────────
  ```
- **JSDoc**: Required for all exported functions
  ```typescript
  /**
   * Creates a new structure renderer instance.
   * @param options - Renderer configuration options
   * @returns A new StructureRenderer instance
   */
  export function createRenderer(options: CreateRendererOptions) { ... }
  ```
- **Scratch objects**: Declare at module level with descriptive names
  ```typescript
  const _keyOffset  = new THREE.Vector3();
  const _fillOffset = new THREE.Vector3();
  ```

### Error Handling

- Use try/catch for operations that may fail (e.g., WebGL initialization)
- Pass error handlers via constructor/options, never throw silently
- Always provide fallback values for optional configuration
- Use early returns for validation checks

```typescript
// Good: try/catch with handler
try {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  rendererState.renderer = renderer;
} catch {
  this.handlers.setError('WebGL renderer failed to initialize.');
  return;
}

// Good: early return for validation
if (!container) { this.handlers.setError('Container element not found.'); return; }
```

### Performance Guidelines

- **Pre-allocate scratch objects** at module level to avoid GC pressure per frame
- **Dirty flag system**: Use `needsRender` flag; only re-render when scene changes
- **InstancedMesh**: Group atoms/bonds by visual properties to minimize draw calls
- **Debounce/throttle**: Use utility functions for event handlers
  ```typescript
  const _onResizeDebounced = debounce(onResize, 50);
  ```

### State Management

- State stores use **dependency injection** via `StoreProvider`
- Default stores are defined in `src/state/store.ts`
- Use immutable update patterns for state changes
- Store interfaces are named `*State` (e.g., `StructureState`, `DisplayState`)

### Three.js Specific

- **ColorManagement is disabled** at module load (line 21 of `renderer.ts`):
  ```typescript
  THREE.ColorManagement.enabled = false;
  ```
  This maintains linear color space compatible with Three.js r128. Initialize acoord-3d before other Three.js code.
- Use `MeshPhongMaterial` for atoms/bonds (supports `instanceColor`)
- Geometry reuse: create shared geometries for atoms with same radius

### Testing Patterns

```typescript
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('createRenderer', () => {
  it('should create renderer instance', () => {
    const canvas = document.createElement('canvas');
    const renderer = createRenderer({ canvas });
    expect(renderer).to.have.property('renderStructure');
  });
});
```

### Common Pitfalls

1. **Import extensions**: Always use `.js` extension for relative imports (ESM requirement)
2. **Type vs value**: Use `import type` for type-only imports to avoid runtime overhead
3. **Null checks**: Always verify objects exist before accessing properties
4. **Dispose resources**: Always dispose Three.js geometries, materials, and textures
5. **Module-level state**: Avoid module-level mutable state that could cause issues in SSR/parallel execution

### Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | Public API exports |
| `src/renderer/factory.ts` | `createRenderer()` entry point |
| `src/renderer/renderer.ts` | Core `StructureRenderer` class (1468 lines) |
| `src/state/store.ts` | State interfaces and defaults |
| `src/types/wire.ts` | Wire protocol types (Atom, Bond, Structure) |
