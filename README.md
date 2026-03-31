# ACoord Monorepo

Atomic Coordinate Toolkit

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

# Affected tests (based on git changes)
npx nx affected:test
```

## Development Workflow

1. **Daily development**: `npm run watch` + F5 debug
2. **Before committing**: `npm run lint && npm run test`
3. **Check change impact**: `npx nx affected:build`

## Documentation

- [vscode-acoord Development Guide](vscode-acoord/DEVELOPMENT.md)
- [acoord-3d Usage Guide](packages/acoord-3d/README.md)
