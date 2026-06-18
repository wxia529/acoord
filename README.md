# ACoord

Atomic Coordinate Toolkit is a VS Code extension and TypeScript monorepo for
viewing, editing, and converting atomic, molecular, and crystal structure files.
It is built for users who keep simulation inputs and outputs in VS Code and want
an interactive 3D editor without switching tools.

- VS Code extension: `apps/vscode-acoord`
- Reusable Three.js renderer: `packages/acoord-3d`
- User documentation: https://wxia529.github.io/acoord/
- Marketplace: https://marketplace.visualstudio.com/items?itemName=wxia529.acoord

## What You Can Do

- Open common molecular, crystallographic, and simulation formats directly in
  VS Code.
- Inspect structures with an interactive Three.js viewer: rotate, pan, zoom,
  select atoms, measure distances, angles, and dihedrals.
- Edit atom positions, elements, colors, bonds, fixed states, and unit cells.
- Navigate trajectories from formats such as XYZ, XDATCAR, OUTCAR, QE output,
  and CASTEP output.
- Save edited inputs while preserving format-specific calculation sections where
  supported.
- Export structures to other writable formats with **Save As**.

## Supported Formats

| Format | Read | Write | Notes |
|---|---:|---:|---|
| XYZ | yes | yes | Single structures and multi-frame trajectories |
| CIF | yes | yes | Unit cells and symmetry-expanded atoms |
| POSCAR / CONTCAR / VASP | yes | yes | Unit cells and selective dynamics |
| XDATCAR | yes | no | VASP trajectory |
| OUTCAR | yes | no | VASP output structures |
| PDB | yes | yes | `CRYST1`, `ATOM`, and `HETATM` records |
| Gaussian input | yes | yes | Preserves route/header metadata |
| ORCA input | yes | yes | Preserves input header and blocks |
| Quantum ESPRESSO input | yes | yes | Preserves namelists and structure cards |
| Quantum ESPRESSO output | yes | no | Multi-frame output parsing |
| ABACUS STRU | yes | yes | Preserves species, orbitals, magnetism, velocity, spin extras |
| OpenMX DAT | yes | yes | Preserves calculation parameters and species rows |
| CASTEP cell | yes | yes | Lattice, positions, constraints, spin/label metadata |
| CASTEP output | yes | no | Geometry optimization and trajectory output |
| SIESTA FDF | yes | yes | Preserves non-structure parameters |
| ACoord native | yes | yes | JSON format for ACoord-specific metadata |

Read-only output formats can still be opened, inspected, edited in memory, and
exported to a writable format.

## Install and Use

### From VS Code Marketplace

1. Open VS Code.
2. Open the Extensions view.
3. Search for `ACoord`.
4. Install **ACoord** by `wxia529`.

### From Source

```bash
git clone https://github.com/wxia529/acoord.git
cd acoord
npm install
npm run build
```

Open the repository in VS Code and press `F5` to launch an Extension
Development Host.

### Open a Structure

1. Open a supported file such as `structure.cif`, `water.xyz`, `POSCAR`, or
   `STRU`.
2. Click the ACoord preview icon in the editor title bar, or run
   `ACoord: Open Structure Editor` from the Command Palette.
3. Use the 3D canvas and side panels to inspect or edit the structure.

Common controls:

| Action | Control |
|---|---|
| Rotate | Left-drag empty canvas |
| Pan | Right-drag or middle-drag |
| Zoom | Mouse wheel |
| Select atom | Click atom |
| Multi-select | Ctrl/Cmd-click |
| Box select | Shift-drag empty canvas |
| Delete selected atoms | Delete / Backspace |
| Save | Ctrl/Cmd-S |

## Editing and Save Behavior

ACoord keeps domain logic in the VS Code extension host. Parsing, bond
detection, color/radius assignment, edit history, and serialization happen in
TypeScript outside the webview; the webview focuses on rendering and user input.

Supported edits include:

- Add, delete, move, copy, paste, and change atoms.
- Edit Cartesian and fractional coordinates.
- Create, delete, and recalculate bonds.
- Edit unit cell parameters and generate supercells.
- Mark atoms as fixed or free for geometry optimization workflows.
- Apply built-in or custom color schemes.

When saving an existing input file, ACoord tries to update only structural data
and preserve calculation settings:

- Gaussian, ORCA, QE, STRU, OpenMX, SIESTA, and related formats preserve
  non-structure sections where the parser supports round-trip metadata.
- Fixed-atom or selective-dynamics flags are written only when there is a real
  constraint. If all atoms are unconstrained, writable formats omit the redundant
  fixed/free flags where the format allows it.
- Output/trajectory formats such as XDATCAR, OUTCAR, QE output, and CASTEP
  output are read-only; use **Save As** to export the current frame or structure.

## Monorepo Layout

```text
acoord/
├── apps/
│   └── vscode-acoord/      # VS Code extension, parsers, services, webview
├── packages/
│   └── acoord-3d/          # Three.js rendering engine package
├── docs/                   # VitePress user documentation
├── nx.json                 # Nx task graph configuration
├── package.json            # Workspace scripts and dependencies
└── package-lock.json
```

### `apps/vscode-acoord`

The extension contains the file parsers, structure model, edit services, custom
editor provider, webview UI, tests, and VS Code package metadata.

Key paths:

- `src/io/parsers/` - format parsers and serializers
- `src/models/` - atoms, bonds, structures, unit cells
- `src/services/` - edit, selection, bond, clipboard, display services
- `src/shared/protocol.ts` - typed extension-host/webview messages
- `media/webview/` - browser UI and interaction code

### `packages/acoord-3d`

The renderer package exposes the Three.js rendering engine used by the VS Code
webview. It owns the low-level scene, atom/bond rendering, camera, lighting, and
selection visuals.

## Development

### Prerequisites

- Node.js compatible with the workspace lockfile
- npm
- VS Code 1.90 or later for extension debugging

### Root Commands

```bash
npm install              # Install workspace dependencies
npm run build            # Build all projects
npm run test             # Run all tests through Nx
npm run watch            # Watch all projects
npm run lint             # Lint all projects
npm run package          # Build the VS Code extension VSIX
npm run docs:dev         # Run the VitePress docs site
```

### Project Commands

```bash
npx nx run acoord-3d:build
npx nx run acoord-3d:test
npx nx run vscode-acoord:build
npx nx run vscode-acoord:test
npx nx run vscode-acoord:lint
npx nx graph
```

Single parser test example:

```bash
cd apps/vscode-acoord
npx mocha src/test/unit/parsers/qe.test.mts
```

Before opening a pull request or publishing a build, run:

```bash
npm --workspace acoord run lint
npm --workspace acoord run test:unit
npm --workspace acoord run compile
npm run build
```

## Architecture Notes

The main design rule is that the extension host owns computation and the webview
is a renderer:

| Extension host | Webview |
|---|---|
| Parser and serializer logic | Three.js canvas |
| Bond detection | Mouse and keyboard input |
| Color/radius calculation | Rendering received data |
| Structure edits and undo/redo | Sending typed messages |
| File save/export behavior | Display controls |

This keeps file-format behavior testable in Node and avoids duplicating domain
logic in browser code.

## Documentation

- [User Documentation](https://wxia529.github.io/acoord/)
- [File Format Guide](docs/guide/file-formats.md)
- [Editing Tutorial](docs/tutorials/editing-atoms.md)
- [Extension Development Guide](apps/vscode-acoord/DEVELOPMENT.md)
- [Renderer Package Guide](packages/acoord-3d/README.md)

## Publishing

- VS Code extension package: `npm run package`
- Documentation site: VitePress content in `docs/`, deployed by GitHub Pages
  workflow on pushes to `main`

## License

MIT License. See [LICENSE](LICENSE).
