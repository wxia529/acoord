# AGENTS.md — ACoord (VS Code Extension)

## Project Overview

ACoord is a VS Code extension for 3D visualization and editing of atomic/molecular/crystal
structures. Two-process architecture: Node.js extension host + sandboxed browser webview
(Three.js). All IPC is typed JSON defined in `src/shared/protocol.ts`.

Follow DEVELOPMENT.md
Read DEVELOPMENT.md before starting work

## Build & Run

```bash
npm run compile          # Full build: tsc + esbuild (webview bundle)
npm run watch            # Watch both tsc and esbuild concurrently
npm run lint             # ESLint on src/
npm run test:unit        # Unit tests (Mocha, fast, no VS Code needed)
npm run test             # Integration tests (launches VS Code)
```

### Running a Single Test

Unit tests use Mocha with `.mts` extension and `tsx` loader:

```bash
# Run a single test file
npx mocha --import tsx --timeout 5000 src/test/unit/parsers/xyz.test.mts

# Run tests matching a grep pattern
npx mocha --import tsx --timeout 5000 --grep "round-trip" "src/test/unit/**/*.test.mts"
```

Test files live under `src/test/unit/` with the pattern `*.test.mts`.
Fixtures (one per format) are in `src/test/fixtures/`.

## Code Style

Follow DEVELOPMENT.md

Read DEVELOPMENT.md before starting work

### TypeScript Strictness

tsconfig.json enforces `strict: true`, `noImplicitAny`, `strictNullChecks`,
`noUnusedLocals`, `noUnusedParameters`. These are non-negotiable.
The project uses `"type": "module"` in package.json.

- Extension host: `ES2022` target, `Node16` module system, output to `out/`
- Webview: `ES2020` target, `ES2020` module, bundled by esbuild to `out/webview/webview.js`
- Unit tests: `.mts` extension (native ES modules), loaded via `tsx`

### ESLint Rules

Configured in `eslint.config.mjs` (flat config, `typescript-eslint`):

- `@typescript-eslint/no-explicit-any`: warn — avoid `any`, especially on message boundaries
- `@typescript-eslint/no-non-null-assertion`: warn — prefer null checks
- `@typescript-eslint/naming-convention`: imports must be `camelCase` or `PascalCase`
- `curly`: warn — always use braces
- `eqeqeq`: warn — always use `===`/`!==`
- `no-throw-literal`: warn — throw `Error` objects, not strings
- `semi`: warn — use semicolons

### Imports

- Imports use `camelCase` or `PascalCase` names (ESLint enforced).
- `src/shared/protocol.ts` must have **zero imports** — it is shared between Node.js and browser.
- Use barrel re-exports from `index.ts` files (e.g., `import { Structure } from '../../models'`).
- Parsers import the base class from `./structureParser` and models from `../../models`.

### Naming Conventions

- **Classes:** `PascalCase` (e.g., `AtomEditService`, `XYZParser`, `RenderMessageBuilder`)
- **Files:** `camelCase.ts` matching the primary export (e.g., `atomEditService.ts`)
- **Interfaces/types:** `PascalCase`, wire types prefixed with `Wire` (e.g., `WireAtom`, `WireDisplaySettings`)
- **Message interfaces:** named `{Action}Message` with a `command` string literal field
- **IDs:** opaque strings via `crypto.randomUUID()`, prefixed (`atom_`, `struct_`). Never parse or compare structurally.
- **Constants:** `UPPER_SNAKE_CASE` for module-level constants

### Types

- All message handler parameters must use protocol types from `src/shared/protocol.ts`, never `any`.
- Use `MessageByCommand<'commandName'>` to extract specific message types.
- Use `satisfies MessageType` (not `as`) when constructing messages for type safety.
- `DisplaySettings = Required<WireDisplaySettings>` — add new fields to `WireDisplaySettings` only.
- Positions: `[number, number, number]` tuples (Cartesian, Angstroms).
- Colors: CSS hex `#RRGGBB` strings.
- Optional wire fields use `?`. Never send `undefined` over the wire — omit the key.

### Error Handling

- **Extension host services:** throw `Error` with descriptive messages. `MessageRouter.route()`
  catches all handler errors centrally and calls `vscode.window.showErrorMessage`. Handlers
  should NOT call `showErrorMessage` directly (exception: `DocumentService`).
- **Service return values:** `boolean` means "handled" not "succeeded". Return `false` only
  for routing misses. Throw on domain errors — never silently return `false`.
- **Parsers:** throw `Error` with parser name, line number, and what was expected.
  Return `[]` for empty input (never throw). Never return an empty `Structure` for errors.
- **Webview:** use `_exhaustive: never` pattern in message switch for compile-time completeness.
  Do not throw on unknown messages — log and ignore.

```typescript
// Good parser error:
throw new Error(`XYZParser: line ${lineNum}: expected integer atom count, got "${raw}"`);

// Good service error:
throw new Error(`addAtom: invalid element symbol "${message.element}"`);
```

### Architecture Rules

1. **Protocol-first:** Define messages in `protocol.ts` before implementation. Add to
   the union type. The `_exhaustive: never` check in `app.ts` enforces completeness.
2. **Service isolation:** Each domain (selection, bonds, atoms, unit cells, config) has
   its own service. Services must not reach into another service's domain.
3. **StructureEditorProvider is a thin coordinator** — no domain logic. Put it in services.
4. **Immutable model updates:** Edits produce new `Structure` snapshots on the undo stack.
5. **Dispose everything:** Track and release all event listeners, Three.js objects, and
   `requestAnimationFrame` IDs.
6. **Session keys:** Use monotonic counter (`session_1`, `session_2`), NOT `document.uri.fsPath`.
7. **Three.js:** All objects owned by `renderer.ts`. Use `InstancedMesh` — never per-atom geometries.
8. **Drag previews:** Never call `renderStructure()` on preview messages. Use local update paths.

### Adding a New Message

1. Define interface in `protocol.ts` with `command` string literal
2. Add to `ExtensionToWebviewMessage` or `WebviewToExtensionMessage` union
3. Extension: register handler via `messageRouter.registerTyped('cmd', handler)`
4. Webview: add `case 'cmd':` in `app.ts` switch (compiler enforces this)
5. Write unit test in `src/test/unit/`

### Adding a New Parser

1. Create `src/io/parsers/myFormatParser.ts` extending `StructureParser`
2. Export from `src/io/parsers/index.ts`
3. Register in `FileManager`'s `PARSER_MAP`
4. Add fixture file to `src/test/fixtures/`
5. Write round-trip test at `src/test/unit/parsers/`

### Testing Requirements

| Change | Required Test |
|---|---|
| New parser | Round-trip: `parse(fixture)` -> `serialize()` -> `parse()` -> same result |
| New service method | Success, failure, and edge cases |
| New message type | Dispatch test in `messageRouter.test.mts` |
| New `Structure` method | Unit test in `structure.test.mts` |

Parser tests must verify: correct atom count/elements/positions (1e-6 tolerance),
round-trip identity, metadata preservation, empty input returns `[]`, malformed input throws.

### Common Mistakes to Avoid

- Do NOT use `any` on message boundaries
- Do NOT use `document.uri.fsPath` as session map key
- Do NOT put domain logic in `StructureEditorProvider`
- Do NOT call `renderStructure()` on preview/drag messages
- Do NOT silently return `false` on domain errors — throw instead
- Do NOT store non-serializable objects in `Structure.metadata`
- Do NOT create per-atom Three.js geometries — use `InstancedMesh`
- Do NOT bypass the `_exhaustive: never` check in `app.ts`
- Do NOT add wire types without defining them in `protocol.ts` first
- Do NOT use `atoms.find()` for ID lookup — use `Structure.getAtom(id)` (O(1) map)
