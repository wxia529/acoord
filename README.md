# ACoord

Atomic Coordinate Toolkit is a TypeScript monorepo for visualizing and editing
atomic, molecular, and crystal structures in VS Code. The workspace contains the
VS Code extension and a reusable Three.js rendering package.

## Project Structure

```
acoord/
├── packages/
│   └── acoord-3d/      # 3D rendering engine (Three.js) → published to npm
├── apps/
│   └── vscode-acoord/  # VS Code extension
├── nx.json             # Nx configuration
└── package.json        # Workspace configuration
```

## Quick Start

```bash
# Install dependencies
npm install

# Build all projects
npm run build

# Development mode
npm run watch

# Run all tests
npm run test
```

For extension debugging, open the repository in VS Code and press `F5`. The
debug task compiles `apps/vscode-acoord` and launches an Extension Development
Host.

## Common Commands

```bash
# Build specific projects
npx nx run acoord-3d:build
npx nx run vscode-acoord:build

# Test specific projects
npx nx run acoord-3d:test
npx nx run vscode-acoord:test

# View dependency graph
npx nx graph

# Affected tasks (based on git changes)
npx nx affected -t build
npx nx affected -t test

# Documentation site
npm run docs:dev
npm run docs:build
```

## Nx Build Model

This repository uses Nx as a lightweight task runner and cache layer. The actual
build commands live in each project's `package.json`; Nx wires project targets,
dependency order, affected runs, and cached outputs.

| Project | Type | Build Target | Script | Output |
|---|---|---|---|---|
| `acoord-3d` | Library | `acoord-3d:build` | `node build.config.mjs && tsc --emitDeclarationOnly` | `packages/acoord-3d/dist/` |
| `vscode-acoord` | Application | `vscode-acoord:build` | `tsc -p ./ && node build/webview.mjs` | `apps/vscode-acoord/out/` |

`vscode-acoord` depends on the workspace package `acoord-3d`, so
`npx nx run vscode-acoord:build` builds `acoord-3d` first through the
`dependsOn: ["^build"]` rule in `nx.json`.

Nx cache inputs are production-focused for builds: tests and specs are excluded
from build cache keys, while test targets use the full project input plus
production outputs from dependencies.

## Development Workflow

1. **Daily development**: `npm run watch` + F5 debug
2. **Before committing**: `npm run lint && npm run test`
3. **Check change impact**: `npx nx affected -t build`

## Documentation

- [User Documentation](https://wxia529.github.io/acoord/)
- [vscode-acoord Development Guide](apps/vscode-acoord/DEVELOPMENT.md)
- [acoord-3d Usage Guide](packages/acoord-3d/README.md)

## Publishing

- Extension package: `npm run package`
- Documentation: GitHub Pages builds from `docs/` using VitePress on pushes to
  `main`
