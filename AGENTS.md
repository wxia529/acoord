# AGENTS.md — ACoord Monorepo

Atomic Coordinate Toolkit — Monorepo for 3D crystal/molecular structure visualization

## Project Structure

```
acoord/
├── packages/acoord-3d/     # Three.js rendering engine (npm package)
├── apps/vscode-acoord/     # VS Code extension (VS Code Marketplace)
├── nx.json                 # Nx monorepo configuration
└── package.json            # Workspace root
```

**Tech Stack:** TypeScript 5.9+, Three.js r183, Nx, ESBuild, Mocha + Chai, VS Code API

---

## Quick Commands

### Monorepo (Root)

```bash
npm run build              # Build all projects
npm run test               # Test all projects
npm run watch              # Watch mode (all projects)
npx nx run acoord-3d:build # Build specific project
npx nx run vscode-acoord:test
npx nx graph               # View dependency graph
```

### acoord-3d (packages/acoord-3d)

```bash
npm run build              # esbuild → dist/index.js
npm run watch
npm test
npx mocha --import tsx --timeout 5000 'test/**/*.test.ts' --grep "PatternName"
```

### vscode-acoord (apps/vscode-acoord)

```bash
npm run compile            # tsc + esbuild webview
npm run watch
npm run lint               # ESLint
npm run test:unit          # Unit tests (no VS Code)
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts
```

---

## Code Style Guidelines

### TypeScript

- **Strict mode** enabled (`strict: true`, `noImplicitAny`, `strictNullChecks`)
- Use `interface` for object shapes; `type` for unions/aliases
- Always use explicit return types on public functions
- Prefer `unknown` over `any`; use type guards when narrowing
- **No `any` on message boundaries** (protocol.ts, IPC)

### Imports

```typescript
// Named imports (preferred)
import { debounce, throttle } from './utils/performance.js';

// Type-only imports (required for types)
import type { RendererHandlers } from './types.js';
import type * as THREE from 'three';

// Namespace import for Three.js (required for static members)
import * as THREE from 'three';

// Relative paths MUST include .js extension for ESM
```

**vscode-acoord specific:**
- `protocol.ts` has **zero imports** (single source of truth)
- Use barrel exports: `import { Structure } from '../../models'`

### Naming Conventions

| Kind | Convention | Example |
|------|------------|---------|
| Types/Interfaces | PascalCase | `StructureRenderer`, `Atom` |
| Classes | PascalCase | `AtomEditService` |
| Variables/Functions | camelCase | `renderStructure`, `onResize` |
| Constants | SCREAMING_SNAKE_CASE | `CAMERA_TARGET_DIMENSION` |
| Files | camelCase.ts | `atomEditService.ts` |
| Wire types | `Wire` prefix | `WireAtom`, `WireBond` |
| Atom IDs | `atom_${uuid}` | Opaque, never parse |
| Scratch variables | Leading underscore | `_container`, `_keyOffset` |
| Interface prefix | None (not `IInterface`) | `StoreProvider` |

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Section headers**: Use decorative dividers
  ```typescript
  // ─────────────────────────────────────────────────────────────────────────────
  // Structure Store
  // ─────────────────────────────────────────────────────────────────────────────
  ```
- **JSDoc**: Required for all exported functions

### Error Handling

```typescript
// Good: try/catch with handler
try {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  this.handlers.setError('WebGL renderer failed to initialize.');
  return;
}

// Good: early return for validation
if (!container) { this.handlers.setError('Container not found.'); return; }

// Services: Throw descriptive Error
throw new Error(`addAtom: invalid element "${message.element}"`);

// Parsers: Include parser name, line number
throw new Error(`XYZParser line ${lineNum}: expected atom count, got "${raw}"`);
```

**Never:**
- Return `false` silently on errors
- Use `no-non-null-assertion` (`!`)
- Throw strings (always `Error` objects)

---

## Architecture Rules

### The Golden Rule

**Extension host owns computation. Webview is pure rendering.**

```
Extension Host (Node)          Webview (Browser)
  - Color/radius calculation     - Render received data
  - Bond detection               - Handle user input
  - Parser/serializer            - Send messages to extension
  - ALL domain logic             - NO computation
```

### Design Principles

1. **Protocol-first** — Define messages in `protocol.ts` before implementation
2. **Service isolation** — Each domain concern in its own service class
3. **Immutable updates** — Edits produce new `Structure` snapshots
4. **Dispose everything** — Track all listeners, Three.js objects, RAF IDs
5. **Session keys** — Use `session_N`, NOT `document.uri.fsPath`
6. **InstancedMesh** — Never per-atom geometries
7. **No preview renderStructure()** — Use local update paths
8. **DisplaySettings = "current brush"** — Must explicitly apply

---

## Three.js Specific (acoord-3d)

- **ColorManagement disabled** at module load:
  ```typescript
  THREE.ColorManagement.enabled = false; // Linear color space
  ```
- Use `MeshPhongMaterial` for atoms/bonds (supports `instanceColor`)
- Geometry reuse: create shared geometries for atoms with same radius
- **Pre-allocate scratch objects** at module level to avoid GC pressure

---

## Testing Requirements

| Change | Required Test |
|--------|---------------|
| New parser | Round-trip: parse → serialize → parse |
| New service method | Success, failure, edge cases |
| New message type | Dispatch test in messageRouter.test.mts |
| New Structure method | Unit test in structure.test.mts |

**Parser tests must verify:**
- Atom count, elements, positions (1e-6 tolerance)
- Round-trip identity
- **Atoms have valid color and radius** (pre-computed)
- Metadata preservation
- Empty/malformed input throws

**Test pattern:**
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

---

## Common Mistakes (MUST AVOID)

| ❌ Don't | ✅ Do |
|----------|-------|
| `any` on message boundaries | Use protocol types |
| `document.uri.fsPath` as session key | Use `session_N` counter |
| Domain logic in StructureEditorProvider | Put in services |
| `renderStructure()` on preview | Use local update paths |
| Per-atom Three.js geometries | Use `InstancedMesh` |
| Bypass `_exhaustive: never` | Add case — compiler enforces |
| `atoms.find()` for ID lookup | Use `Structure.getAtom(id)` (O(1)) |
| Calculate color/radius in webview | Extension sets pre-computed |
| Auto-apply DisplaySettings | User must explicitly apply |
| Import extensions missing | Always use `.js` for relative imports |

---

## Workflow

### Daily Development

```bash
# Terminal 1: Watch mode
npm run watch

# Terminal 2: Run tests (optional)
npm run test:unit

# VS Code: Press F5 to launch Extension Development Host
```

### Before Committing

```bash
npm run lint && npm run test:unit && npm run compile
```

### Adding a Message (vscode-acoord)

1. Define in `protocol.ts` with `command` literal
2. Add to message union
3. Extension: `messageRouter.registerTyped('cmd', handler)`
4. Webview: `case 'cmd':` in `app.ts` switch (compiler enforces)
5. Write test

### Adding a Parser (vscode-acoord)

1. Create `src/io/parsers/myFormatParser.ts` extends `StructureParser`
2. Export from `index.ts`, register in `FileManager.PARSER_MAP`
3. Add fixture to `src/test/fixtures/`
4. Write round-trip test

**MUST set atom.color and atom.radius:**
```typescript
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { ELEMENT_DATA } from '../../utils/elementData';

atom.color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
atom.radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
```

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/acoord-3d/src/index.ts` | `createRenderer()` factory |
| `packages/acoord-3d/src/renderer/renderer.ts` | Core StructureRenderer class |
| `apps/vscode-acoord/src/shared/protocol.ts` | IPC single source of truth |
| `apps/vscode-acoord/src/models/structure.ts` | Structure class |
| `apps/vscode-acoord/src/services/messageRouter.ts` | Command dispatch |
| `apps/vscode-acoord/media/webview/src/app.ts` | Webview entry point |

---

## Resources

- [vscode-acoord DEVELOPMENT.md](apps/vscode-acoord/DEVELOPMENT.md) — Full architecture
- [acoord-3d README.md](packages/acoord-3d/README.md) — Rendering engine docs
- [README.md](README.md) — Monorepo overview
