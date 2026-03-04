# ACoord Developer Guide

**Version:** 0.2.0  
**Last Updated:** 2026-03-04  
**License:** GPL-3.0-only

This document serves as the authoritative reference for all ACoord development.
Part 1 defines the target architecture that all new code must conform to.
Part 2 provides a step-by-step migration roadmap from the current codebase to the
target architecture.

---

## Table of Contents

### Part 1 — Target Architecture & Developer Guide

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Shared Protocol](#4-shared-protocol)
5. [Extension Host](#5-extension-host)
6. [Webview](#6-webview)
7. [I/O & Parsers](#7-io--parsers)
8. [Configuration System](#8-configuration-system)
9. [Build System](#9-build-system)
10. [Type Safety & Code Quality](#10-type-safety--code-quality)
11. [Testing](#11-testing)
12. [Performance Guidelines](#12-performance-guidelines)
13. [Error Handling](#13-error-handling)

### Part 2 — Migration Roadmap

14. [Migration Overview](#14-migration-overview)
15. [Phase 1: Critical Bug Fixes](#15-phase-1-critical-bug-fixes)
16. [Phase 2: Type Safety & Error Handling](#16-phase-2-type-safety--error-handling)
17. [Phase 3: Architecture — Extension Host](#17-phase-3-architecture--extension-host)
18. [Phase 4: Architecture — Webview](#18-phase-4-architecture--webview)
19. [Phase 5: Performance](#19-phase-5-performance)
20. [Phase 6: Parser Correctness](#20-phase-6-parser-correctness)
21. [Phase 7: Testing & CI](#21-phase-7-testing--ci)
22. [Phase 8: Cleanup & Polish](#22-phase-8-cleanup--polish)

---

# Part 1 — Target Architecture & Developer Guide

## 1. Project Overview

ACoord (Atomic Coordinate Toolkit) is a VS Code extension for 3D visualization
and editing of atomic, molecular, and crystal structures. It supports 11 file
formats (XYZ, CIF, POSCAR, XDATCAR, OUTCAR, Quantum ESPRESSO, PDB, Gaussian,
ORCA, ABACUS STRU) and provides interactive 3D rendering via Three.js within
VS Code's Custom Editor API.

### 1.1 Two-Process Architecture

ACoord runs across two isolated processes:

| Process | Runtime | Entry Point | Communication |
|---|---|---|---|
| **Extension Host** | Node.js (VS Code API) | `src/extension.ts` | `webview.postMessage()` / `onDidReceiveMessage` |
| **Webview** | Browser (sandboxed iframe) | `media/webview/src/app.ts` | `window.addEventListener('message')` / `vscode.postMessage()` |

All data exchanged between the two processes is serialized JSON. The wire
format is defined in `src/shared/protocol.ts`, which is the single source of
truth for both sides.

### 1.2 Key Principles

- **Protocol-first:** Every message type is defined in the shared protocol
  before implementation. Both sides import and use these types; `any` is
  forbidden on message boundaries.
- **Service isolation:** Each domain concern (selection, bonds, atoms, unit
  cells, document I/O, display config) is encapsulated in its own service class
  with no side effects beyond its domain.
- **Immutable model updates:** Structure modifications produce new `Structure`
  instances pushed through the undo stack. Direct mutation is only permitted
  during preview/drag operations.
- **Dispose everything:** Every event listener, timer, geometry, and material
  must be tracked and cleaned up in `dispose()` methods.

---

## 2. Architecture

### 2.1 Extension Host Architecture

```
extension.ts
  ├── StructureEditorProvider  (CustomEditorProvider, lifecycle only)
  │     ├── EditorSession      (per-panel state container)
  │     │     ├── RenderMessageBuilder
  │     │     ├── TrajectoryManager
  │     │     ├── UndoManager
  │     │     ├── SelectionService
  │     │     ├── BondService
  │     │     ├── AtomEditService
  │     │     ├── UnitCellService
  │     │     ├── DocumentService
  │     │     ├── DisplayConfigService
  │     │     └── MessageRouter
  │     └── ... (one EditorSession per webview panel)
  ├── ConfigManager            (global, shared across sessions)
  │     ├── ConfigStorage
  │     ├── ConfigValidator
  │     └── Presets / Migrations
  └── FileManager              (stateless, parser dispatch)
        └── Parsers            (one per format)
```

**Key rules:**

1. `StructureEditorProvider` is a thin lifecycle coordinator. It must not
   contain domain logic. All message handling is delegated to `MessageRouter`;
   document operations to `DocumentService`; display config operations to
   `DisplayConfigService`.
2. `EditorSession` is a value container keyed by a unique session identifier
   (not `fsPath` — see Session Keys below).
3. Services receive their dependencies through constructor injection and never
   reference `vscode.ExtensionContext` or `vscode.WebviewPanel` directly.
4. `MessageRouter` is the only class that maps `command` strings to handler
   functions. Handler registration is strongly typed via the shared protocol.

### 2.2 Session Keys

Each `EditorSession` must be identified by a globally unique key. The session
key must be unique per webview panel, not per document URI.

**Target implementation:** Use `webviewPanel` object identity or a monotonically
increasing counter (e.g. `session_${++nextId}`), not `document.uri.fsPath`.

**Rationale:** A single document can be open in multiple split-view panels
simultaneously (VS Code supports `supportsMultipleEditorsPerDocument: true`).
Using `fsPath` causes one panel to overwrite the other's session.

### 2.3 Webview Architecture

```
app.ts                      (bootstrap, message dispatch)
  ├── renderer.ts            (Three.js scene, camera, rendering)
  ├── state.ts               (reactive stores)
  ├── interaction.ts         (mouse/keyboard input, raycasting)
  ├── configHandler.ts       (display config messages)
  ├── appEdit.ts             (atom editing UI)
  ├── appLattice.ts          (unit cell / supercell UI)
  ├── appView.ts             (view controls UI)
  ├── appTools.ts            (tools panel UI)
  ├── appTrajectory.ts       (trajectory slider UI)
  ├── state/selectionManager.ts  (selection logic)
  ├── ui/                    (DOM utilities)
  └── utils/                 (pure functions: measurements, transforms, etc.)
```

**Key rules:**

1. `renderer.ts` owns the Three.js scene. No other module may create or dispose
   Three.js objects.
2. `state.ts` is the single source of truth for UI state. Modules read from
   stores and call renderer methods; they do not cache redundant state.
3. `interaction.ts` event listeners must be registered with `AbortController`
   or explicit cleanup. The `animate()` loop must be cancellable.
4. `app.ts` message handler must use an exhaustive switch on
   `ExtensionToWebviewMessage['command']`, never a fallthrough `default`.

---

## 3. Directory Structure

```
src/
  extension.ts                 # activate / deactivate
  shared/
    protocol.ts                # Wire types, message unions (no imports)
  types/
    messages.ts                # Re-exports from protocol (deprecated, migrate away)
  models/
    atom.ts                    # Atom class
    structure.ts               # Structure class (atom list, bonds, unit cell)
    unitCell.ts                # UnitCell class (lattice parameters, vectors)
    index.ts                   # Barrel exports
  providers/
    structureEditorProvider.ts # CustomEditorProvider implementation
    structureDocumentManager.ts # Load/save/export helpers
    trajectoryManager.ts       # Multi-frame trajectory state
    undoManager.ts             # Undo/redo stack
  services/
    messageRouter.ts           # Command -> handler dispatch
    atomEditService.ts         # Add / delete / move / copy atoms
    bondService.ts             # Create / delete / recalculate bonds
    selectionService.ts        # Atom and bond selection state
    unitCellService.ts         # Unit cell CRUD, supercell, centering
    documentService.ts         # Save, save-as, reload, image export
    displayConfigService.ts    # Display settings management
  renderers/
    renderMessageBuilder.ts    # Build WireRenderData from Structure
  config/
    configManager.ts           # Config lifecycle (load, save, import, export)
    configStorage.ts           # globalState persistence
    configValidator.ts         # Schema validation
    types.ts                   # DisplaySettings, DisplayConfig interfaces
    presets/                   # Built-in config presets
    migrations/                # Config schema migrations
  io/
    fileManager.ts             # Format detection, parser dispatch, serialize
    parsers/
      structureParser.ts       # Abstract base class
      xyzParser.ts
      cifParser.ts
      poscarParser.ts
      xdatcarParser.ts
      outcarParser.ts
      qeParser.ts
      pdbParser.ts
      gjfParser.ts
      orcaParser.ts
      struParser.ts
      index.ts
  utils/
    elementData.ts             # Periodic table data
    parserUtils.ts             # Shared parsing helpers
    constants.ts               # App-wide constants

media/webview/
  index.html                   # Webview HTML template
  styles.css                   # Webview CSS
  src/
    app.ts                     # Bootstrap & message dispatch
    renderer.ts                # Three.js rendering
    state.ts                   # Reactive state stores
    interaction.ts             # Mouse/keyboard input
    types.ts                   # Webview-side type definitions
    messages.ts                # Protocol re-exports
    configHandler.ts           # Display config message handlers
    appEdit.ts                 # Atom editing UI
    appLattice.ts              # Lattice/supercell UI
    appView.ts                 # View controls
    appTools.ts                # Tools panel
    appTrajectory.ts           # Trajectory controls
    state/selectionManager.ts  # Selection state
    ui/                        # DOM utilities
    utils/                     # Pure helpers

build/
  webview.mjs                  # esbuild config for webview bundle

out/                           # Compiled output (gitignored)
```

---

## 4. Shared Protocol

`src/shared/protocol.ts` is the single source of truth for all messages
exchanged between the extension host and webview. It must:

- **Not import** from any extension-only or webview-only module.
- Contain only plain TypeScript `interface` and `type` declarations plus
  constants.
- Define wire-format data types (`WireAtom`, `WireBond`, `WireRenderData`, etc.)
  with concrete field types — no `any`.
- Define two discriminated unions:
  - `ExtensionToWebviewMessage` — all messages from extension to webview.
  - `WebviewToExtensionMessage` — all messages from webview to extension.
- Provide the `MessageByCommand<C>` utility type for extracting a specific
  message type by its `command` literal.

### 4.1 Adding a New Message

1. Define the message interface in `protocol.ts`.
2. Add it to the appropriate union (`ExtensionToWebviewMessage` or
   `WebviewToExtensionMessage`).
3. Add the handler in `MessageRouter` (extension side) or the message
   switch in `app.ts` (webview side), typed against the new interface.
4. The TypeScript compiler will enforce that all fields are provided at
   send sites and all fields are available at receive sites.

### 4.2 Wire-Format Conventions

- Positions are `[number, number, number]` tuples (Cartesian, Angstroms).
- Colors are CSS hex strings (`#RRGGBB`).
- IDs are opaque strings. Never parse or assume structure.
- Optional fields use `?` — never send `undefined` over the wire (omit the
  key instead).

---

## 5. Extension Host

### 5.1 StructureEditorProvider

Implements `vscode.CustomEditorProvider<StructureDocument>`.

**Responsibilities (and nothing else):**

- `openCustomDocument`: Create `StructureDocument`, return it.
- `resolveCustomEditor`: Create `EditorSession`, set up webview HTML, wire
  message listener, wire dispose listener.
- `saveCustomDocument` / `saveCustomDocumentAs`: Delegate to `DocumentService`.
- `revertCustomDocument`: Reload from disk, replace trajectory, clear undo.
- `backupCustomDocument`: Serialize current structure to backup URI.

**Must fire `_onDidChangeCustomDocument`** after every structural edit
(atom add/delete/move, bond change, unit cell change) so VS Code can track
dirty state and prompt "Save before closing?".

### 5.2 EditorSession

A plain container for per-panel state. Fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique session identifier (not fsPath) |
| `webviewPanel` | `WebviewPanel` | The panel this session controls |
| `document` | `StructureDocument` | The backing document |
| `renderer` | `RenderMessageBuilder` | Builds render messages |
| `trajectoryManager` | `TrajectoryManager` | Multi-frame state |
| `undoManager` | `UndoManager` | Undo/redo stack |
| `selectionService` | `SelectionService` | Selection state |
| `bondService` | `BondService` | Bond operations |
| `atomEditService` | `AtomEditService` | Atom operations |
| `unitCellService` | `UnitCellService` | Unit cell operations |
| `messageRouter` | `MessageRouter` | Message dispatch |
| `displaySettings` | `DisplaySettings?` | Current display overrides |

### 5.3 MessageRouter

All message routing must use typed handlers:

```typescript
// Target pattern: strongly typed handler registration
type MessageHandler<C extends WebviewToExtensionMessage['command']> = {
  command: C;
  handler: (message: MessageByCommand<C>) => Promise<boolean> | boolean;
};
```

The `route()` method must wrap each handler call in try/catch and log errors
rather than allowing exceptions to propagate to the extension host.

### 5.4 UndoManager

- Maintains separate undo and redo stacks of `Structure` snapshots.
- Must enforce a configurable maximum depth (memory bound).
- Memory estimation should account for atoms array, manual bonds, suppressed
  bonds, and unit cell data. A conservative estimate is 1 KB per atom.
- `push()` clears the redo stack.
- Must provide `isEmpty` and `canRedo` readonly properties.

### 5.5 TrajectoryManager

- Holds `frames: Structure[]` and `activeIndex: number`.
- `beginEdit()` clones the active frame for editing. `commitEdit()` replaces
  the active frame with the edited copy.
- `isEditing` indicates whether an edit is in progress.
- Frame switching clears the undo stack (documented trade-off).

### 5.6 Document Lifecycle

The Custom Editor API contract requires:

1. **Dirty tracking:** `onDidChangeCustomDocument` must fire a
   `CustomDocumentEditEvent` after every edit. The event's `undo`/`redo`
   callbacks integrate with VS Code's undo stack.
2. **Backup:** `backupCustomDocument` must serialize the current structure
   to the backup URI so that hot-exit and crash recovery work.
3. **Revert:** `revertCustomDocument` must reload the file from disk and
   reset all editor state (trajectory, undo, selection).

---

## 6. Webview

### 6.1 Renderer

`renderer.ts` encapsulates all Three.js operations.

**Rules:**

- All `THREE.Geometry`, `THREE.Material`, and `THREE.Mesh` instances must be
  created and disposed within this module.
- Use instanced rendering (`THREE.InstancedMesh`) for atoms and bonds. Never
  create a separate geometry/material per atom.
- The `animate()` loop must store its `requestAnimationFrame` ID and cancel
  it in `dispose()`.
- Materials must be disposed before their textures.

### 6.2 Interaction

`interaction.ts` handles mouse/keyboard events and raycasting.

**Rules:**

- All event listeners must be registered with a shared `AbortController`.
  Calling `controller.abort()` removes all listeners at once.
- Alternatively, listeners can be tracked in an array and removed in
  `dispose()`.
- Raycasting for hit-testing must use shared geometry instances (e.g., a
  single `SphereGeometry` re-used via instanced mesh), not per-atom
  geometries.

### 6.3 State Management

`state.ts` defines reactive stores (`structureStore`, `selectionStore`,
`displayStore`, `interactionStore`, `adsorptionStore`).

**Rules:**

- Stores are the single source of truth. There must be no duplicate or shadow
  state in other modules.
- The legacy `state` proxy export must be removed. All access must go through
  the typed store objects.
- Display settings must have a single type path:
  `WireDisplaySettings` (wire) -> `DisplaySettings` (extension model) -> stores
  (webview). The current dual-type system (`DisplaySettings` vs
  `WireDisplaySettings`) must be consolidated.

### 6.4 DOM Access

- Use `document.getElementById()` with null-checking: `as HTMLElement | null`,
  then guard.
- Never cache null DOM lookups permanently. If an element is expected to exist,
  throw on null with a descriptive message rather than silently no-op.
- Input bindings should use `addEventListener` (removable), not `onclick`
  assignment.

---

## 7. I/O & Parsers

### 7.1 Parser Base Class

All parsers extend `StructureParser`:

```typescript
abstract class StructureParser {
  abstract readonly name: string;
  abstract readonly extensions: string[];
  abstract parse(content: string, fileName?: string): Structure[];
  abstract serialize(structure: Structure): string;
  serializeMulti?(structures: Structure[]): string;
}
```

### 7.2 Parser Requirements

Every parser must:

1. **Preserve metadata:** Round-tripping a file through parse -> serialize
   must not lose format-specific metadata (selective dynamics, charge/
   multiplicity, comments, etc.). Store metadata in a `metadata: Record<string,
   unknown>` field on `Structure`.
2. **Report errors with context:** Parse errors must include file name, line
   number, and a human-readable description. Never swallow errors silently.
3. **Handle empty input:** Return an empty array, not throw.
4. **Handle malformed input:** Throw a descriptive `Error` with the parser
   name and the nature of the problem, not return garbage data.

### 7.3 Format-Extension Mapping

Ambiguous extensions (`.out`, `.log`) must not be exclusively mapped to a
single parser. The `FileManager` must attempt multiple parsers for ambiguous
extensions (e.g., try QE first, then ORCA, then report an error) or use
content sniffing.

### 7.4 Known Format-Specific Issues to Fix

| Format | Issue |
|---|---|
| POSCAR | Selective dynamics reduced to single boolean; must preserve per-axis `[T/F, T/F, T/F]` per atom |
| Gaussian (`.gjf`) | Charge and multiplicity lost on round-trip; must preserve in metadata |
| ORCA (`.inp`) | Charge and multiplicity lost on round-trip; must preserve in metadata |
| PDB | Column alignment off by one in serializer; verify against PDB spec |
| QE | `ibrav > 0` not supported; must implement or reject with clear error |
| CIF | Validate that symmetry operations are correctly applied |

---

## 8. Configuration System

The config system is well-designed and should be preserved as-is with minor
improvements.

### 8.1 Components

- **ConfigManager:** Lifecycle coordinator. Handles load, save, delete,
  import, export.
- **ConfigStorage:** Persistence layer using `ExtensionContext.globalState`.
- **ConfigValidator:** JSON schema validation for config files.
- **Presets:** Built-in configs (default, white). Immutable.
- **Migrations:** Versioned schema migrations for backward compatibility.

### 8.2 Rules

- All config access goes through `ConfigManager`. No direct `globalState`
  reads.
- User configs are validated before storage.
- Import validates and rejects invalid files with user-facing error messages.
- `notifyConfigChange` must notify **all** open sessions, not just the active
  one.

---

## 9. Build System

### 9.1 Extension

- **Compiler:** `tsc` with strict mode.
- **tsconfig:** `src/tsconfig.json` targeting `ES2022`, module `commonjs`.
- **Output:** `out/` directory.

### 9.2 Webview

- **Bundler:** esbuild via `build/webview.mjs`.
- **Entry:** `media/webview/src/app.ts`.
- **Output:** `out/webview/webview.js` (single bundle).
- **tsconfig:** `media/webview/src/tsconfig.json` targeting `ES2020`, module
  `ES2020`.
- **External:** `three` is bundled (not external).
- **Watch mode:** `node build/webview.mjs --watch`.

### 9.3 Scripts

| Script | Purpose |
|---|---|
| `npm run compile` | Full build (tsc + esbuild) |
| `npm run watch` | Watch both tsc and esbuild concurrently |
| `npm run lint` | Run ESLint on `src/` |
| `npm run test` | Run VS Code integration tests |
| `npm run vscode:prepublish` | Pre-publish build (runs `compile`) |

---

## 10. Type Safety & Code Quality

### 10.1 Strict TypeScript

The following `tsconfig` options must remain enabled:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### 10.2 No `any` on Boundaries

- Message handlers must be typed with protocol types, not `any`.
- `RenderMessageBuilder.getRenderMessage()` must return `RenderMessage`, not
  `WebviewMessage` with `data?: any`.
- `MessageRouter` handler map must be
  `Map<string, (message: MessageByCommand<...>) => ...>`, not
  `Map<string, (message: any) => ...>`.

### 10.3 IDs

- `Atom.id` and `Structure.id` must use `crypto.randomUUID()` (Node.js) or
  equivalent, not `Math.random().toString(36)`.
- IDs are opaque strings. Never parse, sort, or compare structurally.

### 10.4 ESLint

- Use `typescript-eslint` with recommended rules.
- Enable `@typescript-eslint/no-explicit-any` as a warning (target: error).
- Enable `@typescript-eslint/no-non-null-assertion` as a warning.

---

## 11. Testing

### 11.1 Test Structure

```
src/test/
  extension.test.ts           # Integration tests (VS Code test runner)
  unit/                       # Pure unit tests (no VS Code dependency)
    models/
      structure.test.ts
      unitCell.test.ts
    parsers/
      xyz.test.ts
      cif.test.ts
      poscar.test.ts
      ...
    services/
      selectionService.test.ts
      bondService.test.ts
      ...
```

### 11.2 What to Test

| Category | What | How |
|---|---|---|
| Models | `Structure.getBonds()`, `Structure.clone()`, `UnitCell.getLatticeVectors()` | Unit test |
| Parsers | Round-trip for every format, edge cases, error handling | Unit test with fixture files |
| Services | `SelectionService`, `BondService`, `AtomEditService` | Unit test with mock `RenderMessageBuilder` |
| MessageRouter | Correct dispatch, error containment | Unit test |
| Integration | Open file -> render -> edit -> save -> verify | VS Code integration test |

### 11.3 Parser Round-Trip Tests

For each supported format, maintain at least one fixture file. The test
must verify:

1. Parse produces correct atom count, positions (within tolerance), elements.
2. Serialize -> re-parse produces identical structure.
3. Format-specific metadata is preserved.

---

## 12. Performance Guidelines

### 12.1 Bond Detection

- Non-periodic: Use the spatial hash algorithm in `Structure.getBonds()`.
  This is O(n) amortized.
- Periodic: Must also use spatial hashing. The current O(n^2 x 27)
  implementation in `RenderMessageBuilder.getPeriodicBondGeometry()` is
  unacceptable for structures with >500 atoms.
- **Target:** Move periodic bond detection into `Structure` as
  `getPeriodicBonds()` using the same spatial hash approach. The renderer
  should call this method, not re-implement bond detection.

### 12.2 Instanced Rendering

- Atoms: Use `THREE.InstancedMesh` with a single `SphereGeometry` and a
  single material. Set per-instance color via instance attributes, not
  separate materials.
- Bonds: Use `THREE.InstancedMesh` with `CylinderGeometry`.
- Hit-testing: Use the instanced mesh's built-in raycasting support, not
  per-atom geometries.

### 12.3 Debouncing

- Trajectory slider changes must be debounced (16ms minimum) to avoid
  flooding the extension host with `setTrajectoryFrame` messages.
- Display settings changes from sliders should be debounced similarly.

### 12.4 Atom Lookup

- `Structure.getAtom(id)` must be O(1). Use a `Map<string, Atom>` index
  maintained alongside the `atoms` array, or switch `atoms` to a `Map`.
- Current implementation is O(n) linear scan via `.find()`.

---

## 13. Error Handling

### 13.1 Extension Host

- `MessageRouter.route()` must catch all exceptions from handlers. Log the
  error via `console.error` and show a user-facing message via
  `vscode.window.showErrorMessage` for user-initiated actions.
- File I/O operations must catch and report errors with the file name and
  operation that failed.
- Parser errors must include the parser name and line number where parsing
  failed.

### 13.2 Webview

- Message handler switches must handle unknown commands gracefully (log a
  warning, do not throw).
- Three.js operations that can fail (texture loading, context loss) must be
  wrapped in try/catch.
- Non-null assertions (`!`) on message data are forbidden. Always check for
  null/undefined first.

### 13.3 Error Reporting Pattern

```typescript
// Extension host
try {
  await handler(message);
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.error(`[ACoord] ${message.command} failed:`, error);
  vscode.window.showErrorMessage(`ACoord: ${errorMsg}`);
}
```

---

# Part 2 — Migration Roadmap

## 14. Migration Overview

The migration is organized into 8 phases, ordered by impact and risk. Each
phase is independently shippable — completing a phase should not leave the
extension in a broken state.

**Estimated total effort:** 15-25 development days.

### Priority Matrix

| Priority | Phase | Risk | Effort |
|---|---|---|---|
| P0 | Phase 1: Critical Bug Fixes | High impact, low risk | 2-3 days |
| P0 | Phase 2: Type Safety & Error Handling | High impact, low risk | 2-3 days |
| P1 | Phase 3: Architecture — Extension Host | Medium risk | 3-4 days |
| P1 | Phase 4: Architecture — Webview | Medium risk | 3-4 days |
| P2 | Phase 5: Performance | Low risk | 2-3 days |
| P2 | Phase 6: Parser Correctness | Low risk | 2-3 days |
| P3 | Phase 7: Testing & CI | No risk | 2-3 days |
| P3 | Phase 8: Cleanup & Polish | No risk | 1-2 days |

---

## 15. Phase 1: Critical Bug Fixes

**Goal:** Fix bugs that cause data loss, crash the extension host, or violate
the VS Code Custom Editor API contract.

### 15.1 Fire `onDidChangeCustomDocument` (CRITICAL)

**File:** `src/providers/structureEditorProvider.ts`

**Problem:** The `_onDidChangeCustomDocument` `EventEmitter` is declared and
exposed but never fired. This means VS Code has no way to know the document
is dirty. Users will not see save prompts when closing modified files, and
Ctrl+Z won't integrate with VS Code's undo system.

**Fix:**

1. After every successful structural edit (from `MessageRouter`, undo, redo,
   trajectory frame change that modifies structure), fire:
   ```typescript
   this._onDidChangeCustomDocument.fire({
     document,
     undo: async () => { /* restore previous state */ },
     redo: async () => { /* re-apply the edit */ },
     label: 'descriptive label',
   });
   ```
2. The `undo`/`redo` callbacks must restore/re-apply the `Structure` snapshot
   from the `UndoManager`.
3. Alternatively, fire `CustomDocumentContentChangeEvent` (simpler, no VS Code
   undo integration) as a first step, and upgrade to full
   `CustomDocumentEditEvent` later.

**Verification:** Open a file, make an edit, try to close the tab — VS Code
should prompt "Do you want to save?".

### 15.2 Implement `backupCustomDocument` (HIGH)

**File:** `src/providers/structureEditorProvider.ts:410-426`

**Problem:** The current implementation returns a `CustomDocumentBackup` with
a `delete` callback, but never writes any data to the backup URI. Hot exit
and crash recovery will find an empty file.

**Fix:**

1. In `backupCustomDocument`, look up the `EditorSession` for the document.
2. Serialize the current structure (all frames) to the backup URI using
   `FileManager.saveStructure()` or `Structure.toJSON()`.
3. In `openCustomDocument`, check for a backup in `openContext.backupId` and
   restore from it if present.

```typescript
async backupCustomDocument(
  document: StructureDocument,
  context: vscode.CustomDocumentBackupContext,
  _token: vscode.CancellationToken
): Promise<vscode.CustomDocumentBackup> {
  const session = this.sessions.get(/* session key for document */);
  if (session) {
    const data = JSON.stringify(session.trajectoryManager.frames.map(f => f.toJSON()));
    await vscode.workspace.fs.writeFile(context.destination, Buffer.from(data));
  }
  return {
    id: context.destination.toString(),
    delete: async () => {
      try { await vscode.workspace.fs.delete(context.destination); } catch {}
    },
  };
}
```

**Verification:** Enable `files.hotExit`, make an edit, close VS Code without
saving, reopen — the edit should be preserved.

### 15.3 Fix Session Key Collision (HIGH)

**File:** `src/providers/structureEditorProvider.ts:93`

**Problem:** `const key = uri;` where `uri = document.uri.fsPath`. When the
same file is opened in split view, both panels get the same key and the second
panel overwrites the first's session in the `Map`.

**Fix:**

1. Use a unique identifier per panel. Options:
   - Monotonically increasing counter: `const key = `session_${++this.nextSessionId}`;`
   - Or use `webviewPanel` as the key directly (change `sessions` to
     `Map<vscode.WebviewPanel, EditorSession>`).
2. Update `saveCustomDocument` and any other methods that look up sessions by
   `document.uri.fsPath` to iterate sessions and find matching documents
   instead.

**Verification:** Open the same CIF file in two side-by-side panels. Both
should render and operate independently.

### 15.4 Add Error Handling to `MessageRouter.route()` (HIGH)

**File:** `src/services/messageRouter.ts:39-45`

**Problem:** If any handler throws, the exception propagates to the
`onDidReceiveMessage` callback in `StructureEditorProvider`, which has no
catch block. This crashes the extension host process for that session.

**Fix:**

```typescript
async route(message: WebviewToExtensionMessage): Promise<boolean> {
  const handler = this.handlers.get(message.command);
  if (!handler) return false;
  try {
    return await handler(message);
  } catch (error) {
    console.error(`[ACoord] Handler for '${message.command}' threw:`, error);
    return true; // Claim handled to prevent further dispatch
  }
}
```

**Verification:** Manually trigger an error in a handler (e.g., pass invalid
data). The extension should log the error, not crash.

---

## 16. Phase 2: Type Safety & Error Handling

**Goal:** Eliminate `any` on all message boundaries and add error handling at
critical points.

### 16.1 Type `RenderMessageBuilder` Return Value

**File:** `src/renderers/renderMessageBuilder.ts`

**Problem:** `getRenderMessage()` returns `WebviewMessage` which has `data?: any`
and `displaySettings?: any`. The `WebviewMessage` and `RendererState` interfaces
duplicate wire types already defined in `protocol.ts`.

**Fix:**

1. Delete the `WebviewMessage` interface from `renderMessageBuilder.ts`.
2. Import `RenderMessage` and `WireRenderData` from `protocol.ts`.
3. Change `getRenderMessage()` to return `RenderMessage`.
4. Type all internal geometry-building methods (`getAtomGeometry`,
   `getBondGeometry`, etc.) with `WireAtom[]`, `WireBond[]`, etc.

### 16.2 Type `MessageRouter` Handlers

**File:** `src/services/messageRouter.ts`

**Problem:** `handlers` map is `Map<string, (message: any) => ...>`. The
`MessageHandler` interface uses `command: string` and `handler: (message: any)`.

**Fix:**

1. Replace the `any` handler type with a typed registration pattern:
   ```typescript
   register<C extends WebviewToExtensionMessage['command']>(
     command: C,
     handler: (message: MessageByCommand<C>) => Promise<boolean> | boolean
   ): void;
   ```
2. Update all `this.handlers.set(...)` calls to use the message-specific type
   from `protocol.ts`.
3. This is a large diff but purely mechanical — each handler already accesses
   the correct fields; this just adds compile-time checking.

### 16.3 Type Webview Message Handling

**File:** `media/webview/src/app.ts:403-427`

**Problem:** The `message.data!` non-null assertion on line 351 (and similar
patterns) can crash if the extension sends a render message with null data.

**Fix:**

1. Replace `message.data!` with explicit null checks:
   ```typescript
   if (!message.data) {
     console.error('[ACoord] Render message missing data');
     return;
   }
   ```
2. Type the `message` parameter in `handleRenderMessage` as `RenderMessage`
   (already done, just enforce usage).
3. Remove all `as { ... }` type assertions on `message.data` in the image
   saved/failed handlers — use the protocol types instead.

### 16.4 Replace `Math.random()` IDs

**Files:** `src/models/atom.ts`, `src/models/structure.ts`

**Problem:** `Math.random().toString(36).substring(2, 11)` has a
birthday-problem collision probability that grows with atom count. For a
10,000-atom structure with frequent clone operations, this is a real risk.

**Fix:**

- Extension host: Use `crypto.randomUUID()` (available in Node.js 16+).
- Webview (if IDs are generated there): Use `crypto.randomUUID()` (available
  in all modern browsers).
- Alternative: Use a monotonic counter per session if UUIDs are too heavy.

---

## 17. Phase 3: Architecture — Extension Host

**Goal:** Decompose `StructureEditorProvider` and fix the session model.

### 17.1 Extract Display Config Handling

**File:** `src/providers/structureEditorProvider.ts:243-647`

**Problem:** 400+ lines of display config handling methods live directly in
`StructureEditorProvider`. These methods (`handleGetDisplayConfigs`,
`handleLoadDisplayConfig`, `handleSaveDisplayConfig`, etc.) should be in
`DisplayConfigService`.

**Fix:**

1. Move all `handle*DisplayConfig*` methods to `DisplayConfigService`.
2. Give `DisplayConfigService` access to `ConfigManager` and the webview
   panel's `postMessage` (via a callback, not the panel reference directly).
3. Register display config commands in `MessageRouter` instead of handling
   them in `handleDisplayConfigCommands`.
4. `StructureEditorProvider.handleWebviewMessage` should become:
   ```typescript
   private async handleWebviewMessage(message, session) {
     if (message.command === 'undo') { this.undoLastEdit(session); return; }
     if (message.command === 'redo') { this.redoLastEdit(session); return; }
     const handled = await session.messageRouter.route(message);
     if (handled) { this.renderStructure(session); }
   }
   ```

### 17.2 Extract Document Commands

**Problem:** `handleDocumentCommands` creates a new `DocumentService()` on
every call, does a manual switch, and handles save/reload inline.

**Fix:**

1. Register document commands (`saveStructure`, `saveStructureAs`,
   `saveRenderedImage`, `openSource`, `reloadStructure`) in `MessageRouter`.
2. `DocumentService` should be instantiated once per session and injected
   into `MessageRouter`.
3. The `MessageRouter` should be the single dispatch point for all webview
   commands.

### 17.3 Fix `notifyConfigChange` to Notify All Sessions

**File:** `src/providers/structureEditorProvider.ts:428-448`

**Problem:** The method returns after notifying the first active session. If
multiple panels are open, only one gets the update. If no panel is active, it
falls back to the last session in insertion order (arbitrary).

**Fix:**

```typescript
async notifyConfigChange(config: DisplayConfig): Promise<void> {
  for (const session of this.sessions.values()) {
    session.displaySettings = config.settings;
    session.webviewPanel.webview.postMessage({
      command: 'displayConfigChanged',
      config,
    });
  }
}
```

### 17.4 Implement `revertCustomDocument`

**File:** `src/providers/structureEditorProvider.ts:403-408`

**Problem:** `revertCustomDocument` is a no-op (`return Promise.resolve()`).
When a user runs "Revert File", nothing happens.

**Fix:**

1. Re-read the file from disk using `StructureDocumentManager.load()`.
2. Replace the trajectory manager's frames.
3. Clear the undo stack.
4. Reset selection.
5. Re-render.

---

## 18. Phase 4: Architecture — Webview

**Goal:** Fix resource leaks, clean up state management, and improve
rendering performance.

### 18.1 Cancel `animate()` Loop on Dispose

**File:** `media/webview/src/renderer.ts`

**Problem:** `requestAnimationFrame(animate)` runs indefinitely. When the
webview is disposed, the loop continues running with stale references, leaking
CPU and potentially memory.

**Fix:**

1. Store the animation frame ID:
   ```typescript
   private animationFrameId: number | null = null;
   ```
2. In the animate function:
   ```typescript
   this.animationFrameId = requestAnimationFrame(this.animate);
   ```
3. Add a `dispose()` method:
   ```typescript
   dispose(): void {
     if (this.animationFrameId !== null) {
       cancelAnimationFrame(this.animationFrameId);
       this.animationFrameId = null;
     }
     // Dispose all geometries, materials, textures
   }
   ```

### 18.2 Clean Up Event Listeners in `interaction.ts`

**File:** `media/webview/src/interaction.ts`

**Problem:** Event listeners (`mousedown`, `mousemove`, `mouseup`, `wheel`,
`keydown`, etc.) are added to `canvas` and `document` but never removed.

**Fix:**

1. Create a shared `AbortController`:
   ```typescript
   const controller = new AbortController();
   canvas.addEventListener('mousedown', onMouseDown, { signal: controller.signal });
   document.addEventListener('keydown', onKeyDown, { signal: controller.signal });
   ```
2. Export a `dispose()` function that calls `controller.abort()`.
3. Call this from the app's teardown path.

### 18.3 Fix Per-Atom Hit-Test Geometry

**File:** `media/webview/src/renderer.ts` (hit-test setup)

**Problem:** A separate `SphereGeometry` is created for each atom's hit-test
mesh, leading to O(n) geometry allocations and high memory usage.

**Fix:**

1. Create one `SphereGeometry(1, 8, 8)` and share it across all hit-test
   meshes (scaling via `mesh.scale.set(radius, radius, radius)`).
2. Better yet, use the instanced mesh's built-in raycast support and remove
   per-atom hit-test meshes entirely.

### 18.4 Remove Legacy `state` Proxy

**File:** `media/webview/src/state.ts`

**Problem:** The file exports both typed store objects (`structureStore`,
`selectionStore`, etc.) and a legacy `state` proxy that wraps them. Some
modules use `state.xyz`, others use `structureStore.xyz`. This is confusing
and a source of subtle bugs.

**Fix:**

1. Remove the `state` proxy export.
2. Update all imports to use the specific store objects.
3. This is a mechanical find-and-replace task.

### 18.5 Remove Dead Code: `vscodeApi.ts`

**File:** `media/webview/src/vscodeApi.ts`

**Problem:** This file is never imported by any other file.

**Fix:** Delete the file.

### 18.6 Fix DOM Cache

**File:** `media/webview/src/utils/domCache.ts`

**Problem:** The cache stores `null` for elements not found in the DOM and
never invalidates. If an element is dynamically added later, the cache
permanently returns `null`.

**Fix:**

1. Do not cache `null` results:
   ```typescript
   get(id: string): HTMLElement | null {
     if (this.cache.has(id)) return this.cache.get(id)!;
     const el = document.getElementById(id);
     if (el) this.cache.set(id, el);
     return el;
   }
   ```
2. Or add a `clear()` method called after DOM mutations.

---

## 19. Phase 5: Performance

**Goal:** Address O(n^2) bottlenecks and excessive rendering.

### 19.1 Port Periodic Bond Detection to Spatial Hash

**File:** `src/renderers/renderMessageBuilder.ts:215-300`

**Problem:** `getPeriodicBondGeometry()` does a triple-nested loop:
atoms x atoms x 27 offsets = O(n^2 x 27). For a 1000-atom crystal this
is 27 million iterations.

**Fix:**

1. Add `getPeriodicBonds()` to `Structure`, mirroring the existing
   `getBonds()` spatial hash approach.
2. For periodic systems, build the spatial hash including image atoms
   (atoms + 26 periodic images within the bond cutoff).
3. Query neighbors from the hash instead of iterating all atoms.
4. `RenderMessageBuilder` should call `structure.getPeriodicBonds()` and
   build geometry from the result.
5. **Expected complexity:** O(n x k) where k is average neighbor count (~10).

### 19.2 Make `Structure.getAtom()` O(1)

**File:** `src/models/structure.ts:92-94`

**Problem:** `getAtom(id)` does `this.atoms.find(a => a.id === id)` which
is O(n). It's called frequently during bond detection, selection, and
rendering.

**Fix:**

1. Add a private `atomIndex: Map<string, Atom>` field.
2. Update `addAtom()`, `removeAtom()`, and `clone()` to maintain the index.
3. `getAtom(id)` becomes `return this.atomIndex.get(id)`.

### 19.3 Debounce Trajectory Slider

**File:** `media/webview/src/appTrajectory.ts`

**Problem:** Dragging the trajectory slider fires `setTrajectoryFrame` on
every input event, which triggers a full `renderStructure` on the extension
side.

**Fix:**

1. Debounce the slider's `input` event handler with a 16ms (one frame)
   delay.
2. Only send the message on `change` (mouse release) if debouncing is too
   complex.

### 19.4 Debounce Display Settings Slider Updates

**Problem:** Sliders for atom size, bond thickness, zoom, etc. trigger full
`renderStructure` calls on every input event.

**Fix:** Same debounce pattern as trajectory slider.

---

## 20. Phase 6: Parser Correctness

**Goal:** Fix data-loss and correctness bugs in file format parsers.

### 20.1 POSCAR Selective Dynamics

**File:** `src/io/parsers/poscarParser.ts`

**Problem:** Selective dynamics flags (`T T F`, `F F F`, etc.) are collapsed
to a single boolean, losing per-axis information.

**Fix:**

1. Add a `selectiveDynamics?: [boolean, boolean, boolean]` field to `Atom`
   (or use the `metadata` approach on `Structure`).
2. Parse the three T/F flags per atom.
3. Serialize them back correctly.
4. Add round-trip test.

### 20.2 Gaussian/ORCA Charge & Multiplicity

**Files:** `src/io/parsers/gjfParser.ts`, `src/io/parsers/orcaParser.ts`

**Problem:** Charge and multiplicity from the input file are parsed but not
stored on the `Structure`. On serialize, defaults are emitted.

**Fix:**

1. Add a `metadata: Map<string, unknown>` field to `Structure`.
2. Store `charge` and `multiplicity` in metadata during parsing.
3. Read from metadata during serialization; use defaults only if absent.

### 20.3 PDB Column Alignment

**File:** `src/io/parsers/pdbParser.ts`

**Problem:** The ATOM/HETATM record serializer has column alignment off by
one. PDB format uses fixed-width columns; misalignment can break downstream
tools.

**Fix:**

1. Review the PDB format specification (columns 1-80).
2. Ensure atom name is right-justified in columns 13-16.
3. Ensure coordinates are right-justified in columns 31-38, 39-46, 47-54
   (8.3 format).
4. Add test comparing output against a reference PDB file.

### 20.4 QE ibrav Support

**File:** `src/io/parsers/qeParser.ts`

**Problem:** Only `ibrav = 0` (explicit cell vectors) is supported. Quantum
ESPRESSO supports `ibrav` 1-14 with predefined lattice types.

**Fix:**

1. Implement lattice vector generation for `ibrav` 1-14 using the
   documented QE formulas.
2. Or, at minimum, reject `ibrav > 0` with a clear error message:
   "ACoord does not yet support ibrav > 0. Convert your input to ibrav = 0."

### 20.5 UnitCell.getLatticeVectors() NaN Guard

**File:** `src/models/unitCell.ts`

**Problem:** Degenerate angles (0, 180) cause division by zero or `acos` of
values outside [-1, 1], producing NaN in lattice vectors.

**Fix:**

1. Clamp `cos(alpha)`, `cos(beta)`, `cos(gamma)` to [-1, 1].
2. Validate that `sin(gamma) !== 0` (gamma = 0 or 180 is invalid).
3. Throw a descriptive error for invalid parameters rather than returning NaN.

### 20.6 Ambiguous File Extension Mapping

**File:** `src/io/fileManager.ts`

**Problem:** `.out` and `.log` are exclusively mapped to `QEParser`. ORCA
and Gaussian also use these extensions.

**Fix:**

1. For ambiguous extensions, try parsers in order of likelihood.
2. Each parser's `parse()` should throw on content it cannot recognize.
3. `FileManager` catches the error and tries the next parser.
4. If all parsers fail, report the error from the first (most likely) parser.

---

## 21. Phase 7: Testing & CI

**Goal:** Establish a test suite that prevents regressions.

### 21.1 Set Up Unit Test Infrastructure

1. Add `mocha` and `chai` (or `vitest`) for unit tests that don't need VS Code.
2. Create `src/test/unit/` directory.
3. Add `npm run test:unit` script.
4. Parser tests, model tests, and service tests should be pure unit tests
   (fast, no VS Code dependency).

### 21.2 Parser Round-Trip Tests

For each of the 11 parsers:

1. Create a `fixtures/` directory with representative input files.
2. Write a test that parses the file and asserts atom count, element types,
   positions (within 1e-6 tolerance), and unit cell parameters.
3. Write a test that serializes the parsed structure and re-parses it,
   asserting equivalence.
4. Include edge cases: empty structures, single atom, very large coordinates,
   Unicode comments.

### 21.3 Model Tests

- `Structure.getBonds()`: Test with known molecules (H2O, CH4) and verify
  correct bonds.
- `Structure.clone()`: Verify deep independence.
- `UnitCell.getLatticeVectors()`: Test cubic, hexagonal, triclinic, and
  degenerate cases.
- `Structure.generateSupercell()`: Verify atom count and positions.

### 21.4 Service Tests

- `SelectionService`: Test select, deselect, toggle, multi-select, bond
  selection.
- `BondService`: Test create, delete, recalculate.
- `AtomEditService`: Test add, delete, move, copy, change element.
- `UndoManager`: Test push, pop, redo, max depth enforcement.

### 21.5 Integration Tests

- Open a `.cif` file in the custom editor -> verify it renders.
- Edit an atom position -> verify dirty state -> save -> verify file changed.
- Test split-view: open same file in two panels, edit independently.

---

## 22. Phase 8: Cleanup & Polish

**Goal:** Remove dead code, consolidate types, improve developer experience.

### 22.1 Remove `src/types/messages.ts`

**Problem:** This file re-exports types from `protocol.ts`. Some files import
from `types/messages`, others from `shared/protocol`. This causes confusion.

**Fix:**

1. Update all imports to use `../shared/protocol` directly.
2. Delete `src/types/messages.ts`.

### 22.2 Consolidate Display Settings Types

**Problem:** `DisplaySettings` (in `config/types.ts`) and `WireDisplaySettings`
(in `protocol.ts`) are nearly identical but maintained separately. Manual
sync is required and error-prone.

**Fix:**

1. Make `WireDisplaySettings` the single source of truth.
2. `DisplaySettings` becomes a type alias or a strict superset with only
   non-wire runtime fields added.
3. Remove manual field-by-field copying between the two types.

### 22.3 Clean Up `WireBond` Optional Fields

**File:** `src/shared/protocol.ts:28-39`

**Problem:** `key`, `atomId1`, `atomId2` are marked optional (`?`) but are
always present in practice.

**Fix:** Make them required:

```typescript
export interface WireBond {
  key: string;
  atomId1: string;
  atomId2: string;
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
  color: string;
  color1?: string;
  color2?: string;
  selected?: boolean;
}
```

### 22.4 Improve Undo Memory Estimation

**File:** `src/providers/undoManager.ts`

**Problem:** Memory estimation uses ~200 bytes per atom. Real memory usage
per `Structure` snapshot is significantly higher when accounting for atom
objects, bond arrays, unit cell, and JS object overhead.

**Fix:**

1. Estimate ~1 KB per atom as a conservative baseline.
2. Or measure actual memory using `process.memoryUsage()` before/after
   a clone to calibrate.
3. Make the max undo depth configurable via VS Code settings.

### 22.5 Remove `@github/copilot` Dependency

**File:** `package.json:205`

**Problem:** `@github/copilot` is listed as a runtime dependency but does not
appear to be used in the codebase. This adds unnecessary bundle size.

**Fix:** Verify it's unused (search all source files for imports from
`@github/copilot`). If unused, remove from `dependencies`.

### 22.6 Add Structure Metadata Field

**File:** `src/models/structure.ts`

**Problem:** Format-specific data (comments, charge/multiplicity, selective
dynamics info, etc.) has nowhere to live on the `Structure` model, causing
data loss on round-trip.

**Fix:**

1. Add `metadata: Map<string, unknown>` to `Structure`.
2. Clone metadata in `Structure.clone()`.
3. Serialize metadata in `Structure.toJSON()`.
4. Parsers store format-specific data here; serializers read from it.

---

## Migration Dependency Graph

```
Phase 1 (Critical Bugs)
  ├── 15.1 onDidChangeCustomDocument
  ├── 15.2 backupCustomDocument
  ├── 15.3 Session key collision
  └── 15.4 MessageRouter error handling

Phase 2 (Type Safety)              ← depends on Phase 1
  ├── 16.1 Type RenderMessageBuilder
  ├── 16.2 Type MessageRouter
  ├── 16.3 Type webview messages
  └── 16.4 Replace Math.random IDs

Phase 3 (Extension Architecture)   ← depends on Phase 2
  ├── 17.1 Extract display config  ← depends on 16.2
  ├── 17.2 Extract document cmds   ← depends on 16.2
  ├── 17.3 Fix notifyConfigChange
  └── 17.4 Implement revert        ← depends on 15.1

Phase 4 (Webview Architecture)     ← independent of Phase 3
  ├── 18.1 Cancel animate loop
  ├── 18.2 Clean up event listeners
  ├── 18.3 Fix hit-test geometry
  ├── 18.4 Remove legacy state proxy
  ├── 18.5 Remove dead code
  └── 18.6 Fix DOM cache

Phase 5 (Performance)              ← depends on Phase 2 (typed APIs)
  ├── 19.1 Periodic bond spatial hash ← depends on 16.1
  ├── 19.2 O(1) getAtom
  ├── 19.3 Debounce trajectory slider
  └── 19.4 Debounce display sliders

Phase 6 (Parser Correctness)       ← independent
  ├── 20.1 POSCAR selective dynamics ← depends on 22.6 (metadata)
  ├── 20.2 Gaussian/ORCA metadata    ← depends on 22.6 (metadata)
  ├── 20.3 PDB column alignment
  ├── 20.4 QE ibrav
  ├── 20.5 UnitCell NaN guard
  └── 20.6 Ambiguous extensions

Phase 7 (Testing)                  ← can start in parallel with Phase 3+
  ├── 21.1 Unit test infrastructure
  ├── 21.2 Parser round-trip tests ← depends on Phase 6
  ├── 21.3 Model tests
  ├── 21.4 Service tests
  └── 21.5 Integration tests

Phase 8 (Cleanup)                  ← last phase
  ├── 22.1 Remove messages.ts re-export
  ├── 22.2 Consolidate display types
  ├── 22.3 Clean WireBond optionals
  ├── 22.4 Improve undo memory estimation
  ├── 22.5 Remove unused dependency
  └── 22.6 Add Structure metadata   ← should be done before Phase 6
```

**Note on Phase 6 / Phase 8 ordering:** Task 22.6 (add `metadata` field to
`Structure`) is a prerequisite for tasks 20.1 and 20.2. It should be pulled
forward to Phase 5 or early Phase 6 if parser correctness is prioritized.

---

## Appendix: Complete Bug Inventory

### Critical

| # | Description | File | Section |
|---|---|---|---|
| 1 | `onDidChangeCustomDocument` never fired | `structureEditorProvider.ts:49-53` | 15.1 |

### High

| # | Description | File | Section |
|---|---|---|---|
| 2 | `backupCustomDocument` writes no data | `structureEditorProvider.ts:410-426` | 15.2 |
| 3 | Session key collision on split-view | `structureEditorProvider.ts:93` | 15.3 |
| 4 | Periodic bond detection O(n^2 x 27) | `renderMessageBuilder.ts:215-300` | 19.1 |
| 5 | No error handling in `MessageRouter.route()` | `messageRouter.ts:39-45` | 15.4 |
| 6 | `message.data!` non-null assertion | `app.ts:351` | 16.3 |
| 7 | Per-atom hit-test geometry allocation | `renderer.ts` | 18.3 |
| 8 | `animate()` loop never cancelled | `renderer.ts` | 18.1 |
| 9 | Event listeners never cleaned up | `interaction.ts` | 18.2 |
| 10 | Pervasive `any` types on message boundaries | Multiple files | 16.1, 16.2 |

### Medium

| # | Description | File | Section |
|---|---|---|---|
| 11 | `revertCustomDocument` is a no-op | `structureEditorProvider.ts:403-408` | 17.4 |
| 12 | `notifyConfigChange` only notifies one session | `structureEditorProvider.ts:428-448` | 17.3 |
| 13 | Undo memory estimation inaccurate | `undoManager.ts` | 22.4 |
| 14 | `Structure.getAtom()` is O(n) | `structure.ts:92-94` | 19.2 |
| 15 | `UnitCell.getLatticeVectors()` NaN on degenerate angles | `unitCell.ts` | 20.5 |
| 16 | POSCAR selective dynamics collapsed | `poscarParser.ts` | 20.1 |
| 17 | Gaussian/ORCA charge+multiplicity lost | `gjfParser.ts`, `orcaParser.ts` | 20.2 |
| 18 | PDB column alignment off by one | `pdbParser.ts` | 20.3 |
| 19 | QE doesn't support ibrav > 0 | `qeParser.ts` | 20.4 |
| 20 | `.out`/`.log` exclusively mapped to QE | `fileManager.ts` | 20.6 |
| 21 | DOM cache permanently caches null | `domCache.ts` | 18.6 |
| 22 | Slider drag triggers full renderStructure | `appTrajectory.ts` | 19.3 |
| 23 | Mixed legacy `state` proxy | `state.ts` | 18.4 |
| 24 | `vscodeApi.ts` is dead code | `vscodeApi.ts` | 18.5 |
| 25 | `DisplaySettings` vs `WireDisplaySettings` dual types | `config/types.ts`, `protocol.ts` | 22.2 |
| 26 | `WireBond.key/atomId1/atomId2` marked optional | `protocol.ts:28-39` | 22.3 |
| 27 | `Atom.id` uses `Math.random()` | `atom.ts` | 16.4 |
| 28 | `@github/copilot` appears unused | `package.json` | 22.5 |

---

*End of document.*
