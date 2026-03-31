# AGENTS.md — vscode-acoord

> **Note**: This extension is part of the [acoord monorepo](../../AGENTS.md). For monorepo-wide commands, see the root AGENTS.md.

ACoord is a VS Code extension for 3D visualization and editing of atomic, molecular, and crystal structures.

## Project Overview

**Architecture:** Two-process (Node.js extension host + browser webview with Three.js)  
**IPC:** Typed JSON messages via `src/shared/protocol.ts`  
**Rendering:** `acoord-3d` standalone package

**Key facts:**
- 15 file formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, PDB, Gaussian, ORCA, QE, ABACUS STRU, CASTEP, SIESTA, .acoord)
- 50+ webview commands, all typed
- Extension owns computation; webview is pure rendering

**Authoritative docs:** [DEVELOPMENT.md](DEVELOPMENT.md)

---

## Quick Commands

### From Monorepo Root (Recommended)

```bash
# Build vscode-acoord (auto-builds acoord-3d dependency)
npx nx run vscode-acoord:build

# Watch mode
npx nx run vscode-acoord:watch

# Run unit tests
npx nx run vscode-acoord:test

# Run lint
npx nx run vscode-acoord:lint
```

### From Package Directory

```bash
cd apps/vscode-acoord

npm run compile          # Full build (tsc + esbuild webview)
npm run watch            # Watch mode (tsc + esbuild)
npm run lint             # ESLint
npm run test:unit        # Unit tests (no VS Code)
npm run test             # Integration tests (requires VS Code)
```

**Single test:**
```bash
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts
```

---

## Directory Structure

```
apps/vscode-acoord/
├── src/
│   ├── extension.ts                      # Extension activation
│   ├── shared/
│   │   └── protocol.ts                   # ALL wire types (ZERO imports)
│   ├── models/                           # Atom, Structure, UnitCell
│   ├── providers/                        # CustomEditorProvider, UndoManager
│   ├── services/                         # MessageRouter, AtomEdit, Bond, Selection...
│   ├── io/
│   │   ├── fileManager.ts                # File format detection
│   │   └── parsers/                      # 15 format parsers
│   └── config/                           # Color schemes, display settings
│
├── media/
│   └── webview/
│       ├── index.html                    # Webview HTML
│       ├── styles.css                    # Webview styles
│       └── src/
│           ├── app.ts                    # Bootstrap + message switch
│           ├── renderer.ts               # acoord-3d integration
│           ├── state.ts                  # 8 stores
│           ├── interaction.ts            # Input handling
│           └── axisIndicator.ts          # 3D axis overlay
│
├── docs/                                 # User documentation (VitePress)
├── src/test/
│   ├── unit/                             # Unit tests
│   └── fixtures/                         # Test fixture files
│
└── package.json
```

---

## Code Style (Non-Negotiable)

### TypeScript

- **Strict mode**: `strict: true`, `noImplicitAny`, `strictNullChecks`
- Use `interface` for object shapes; `type` for unions/aliases
- Always use explicit return types on public functions

### ESLint Rules

- No `any` on message boundaries
- No `no-non-null-assertion` (`!`)
- Always `===`/`!==`
- Throw `Error` objects, not strings

### Naming Conventions

| Kind | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `AtomEditService`, `MessageRouter` |
| Files | camelCase.ts | `atomEditService.ts`, `messageRouter.ts` |
| Wire types | `Wire` prefix | `WireAtom`, `WireBond`, `WireStructure` |
| Atom IDs | `atom_${uuid}` | Opaque, never parse |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_BOND_RADIUS` |

### Imports

```typescript
// Named imports (preferred)
import { Structure, Atom } from '../../models';

// Type-only imports
import type { WireMessage } from '../../shared/protocol';

// protocol.ts has ZERO imports - single source of truth
// Use barrel exports: import { Structure } from '../../models'
```

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
2. **Service isolation** — No cross-service domain access
3. **Thin coordinator** — StructureEditorProvider delegates to services
4. **Immutable updates** — Edits produce new `Structure` snapshots
5. **Dispose everything** — Track all listeners, Three.js objects, RAF IDs
6. **Session keys** — Use `session_N`, NOT `document.uri.fsPath`
7. **InstancedMesh** — Never per-atom geometries
8. **No preview renderStructure()** — Use local update paths
9. **DisplaySettings = "current brush"** — Must explicitly apply

---

## Key Types

### Atom Model

```typescript
class Atom {
  id: string;           // atom_${uuid}
  element: string;      // "C", "H", "O"
  x: number, y: number, z: number;  // Cartesian, Angstroms
  color: string;        // "#RRGGBB" — REQUIRED, pre-computed
  radius: number;       // Angstroms — REQUIRED, pre-computed
  selected: boolean;    // Temporary (not saved)
}
```

**Why:** No runtime computation in webview. Round-trip preservation.

### Adding a Message

1. Define in `protocol.ts` with `command` literal
2. Add to message union
3. Extension: `messageRouter.registerTyped('cmd', handler)`
4. Webview: `case 'cmd':` in `app.ts` switch (compiler enforces)
5. Write test

---

## Error Handling

**Services:** Throw descriptive `Error`, let MessageRouter catch and show

```typescript
throw new Error(`addAtom: invalid element "${message.element}"`);
```

**Parsers:** Include parser name, line number, expected value

```typescript
throw new Error(`XYZParser line ${lineNum}: expected atom count, got "${raw}"`);
```

**Webview:** `_exhaustive: never` pattern — compiler enforces completeness

---

## Common Mistakes (MUST AVOID)

| ❌ Don't | ✅ Do |
|----------|-------|
| `any` on message boundaries | Use protocol types |
| `document.uri.fsPath` as session key | Use `session_N` counter |
| Domain logic in StructureEditorProvider | Put in services |
| `renderStructure()` on preview | Use local update paths |
| Return `false` silently on errors | Throw descriptive Error |
| Per-atom Three.js geometries | Use `InstancedMesh` |
| Bypass `_exhaustive: never` | Add case — compiler enforces |
| `atoms.find()` for ID lookup | Use `Structure.getAtom(id)` (O(1)) |
| Calculate color/radius in webview | Extension sets pre-computed |
| Auto-apply DisplaySettings | User must explicitly apply |
| Missing `.js` in relative imports | Always use `.js` extension |

---

## Testing Requirements

| Change | Required Test |
|--------|---------------|
| New parser | Round-trip: parse → serialize → parse |
| New service method | Success, failure, edge cases |
| New message type | Dispatch test in messageRouter.test.mts |
| New Structure method | Unit test in structure.test.mts |

### Parser Tests Must Verify

- Atom count, elements, positions (1e-6 tolerance)
- Round-trip identity
- **Atoms have valid color and radius** (pre-computed)
- Metadata preservation
- Empty/malformed input throws

### Test Pattern

```typescript
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('XYZParser', () => {
  it('should parse water.xyz', () => {
    const structure = parser.parse(fixture);
    expect(structure.atoms).to.have.length(3);
    expect(structure.atoms[0].element).to.equal('O');
  });
});
```

---

## Workflow

### Daily Development

```bash
# Terminal 1: Watch mode (from monorepo root)
npm run watch

# Terminal 2: Run tests (optional)
npx nx run vscode-acoord:test:unit

# VS Code: Press F5 to launch Extension Development Host
```

### Before Committing

```bash
npm run lint && npm run test:unit && npm run compile
```

### Adding a Parser

1. Create `src/io/parsers/myFormatParser.ts` extends `StructureParser`
2. Export from `src/io/parsers/index.ts`
3. Register in `FileManager.PARSER_MAP`
4. Add fixture to `src/test/fixtures/`
5. Write round-trip test

**MUST set atom.color and atom.radius:**

```typescript
import { BRIGHT_SCHEME } from '../../config/presets/color-schemes/index.js';
import { ELEMENT_DATA } from '../../utils/elementData';

atom.color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
atom.radius = ELEMENT_DATA[element]?.covalentRadius ?? 0.3;
```

### Adding a Service

1. Create `src/services/myService.ts`
2. Inject dependencies via constructor
3. Register in `StructureEditorProvider`
4. Add unit tests in `src/test/unit/services/`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/shared/protocol.ts` | IPC single source of truth (ZERO imports) |
| `src/models/structure.ts` | Structure class with O(1) atom lookup |
| `src/services/messageRouter.ts` | Command dispatch between extension/webview |
| `media/webview/src/app.ts` | Webview entry point + message switch |
| `media/webview/src/renderer.ts` | acoord-3d integration |
| `packages/acoord-3d/src/index.ts` | createRenderer() factory |

---

## Testing

### Run Tests

```bash
# All unit tests
npm run test:unit

# Single test file
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts

# Test with pattern
npx mocha --import tsx --timeout 5000 'src/test/unit/**/*.test.mts' --grep "Parser"
```

### Test Fixtures

Test files are in `src/test/fixtures/`:
- `water.xyz`, `water.cif`, `water.vasp`, etc.
- Use for parser round-trip tests

---

## Resources

- [DEVELOPMENT.md](DEVELOPMENT.md) — Full architecture guide
- [README.md](README.md) — User documentation
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [Root AGENTS.md](../../AGENTS.md) — Monorepo guidelines
