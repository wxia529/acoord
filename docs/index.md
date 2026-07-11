---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'ACoord'
  text: 'Atomic Coordinate Toolkit'
  tagline: '3D visualization and editing for atomic, molecular, and crystal structures in VS Code'
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/wxia529/acoord

features:
  - title: 'Broad Format Support'
    details: 'Open and save common molecular, crystallographic, and simulation formats including XYZ, CIF, POSCAR, PDB, QE, STRU, SIESTA FDF, OpenMX DAT, and native .acoord.'
  - title: 'Interactive 3D Editing'
    details: 'Inspect structures with a Three.js viewer, pull out atoms with a directional brush, and select, move, delete, copy, or paste atoms without leaving VS Code.'
  - title: 'Quantum-Chemistry Ghost Centers'
    details: 'Parse Gaussian and ORCA dummy/ghost atoms, insert H-basis Bq centers at geometric or mass centers, and offset them along a molecular plane normal.'
  - title: 'Crystal and Trajectory Tools'
    details: 'Navigate multi-frame structures, edit unit cells, display supercells, and preserve selective dynamics where the source format supports it.'
  - title: 'Color and Measurement Workflow'
    details: 'Measure distances, angles, and dihedrals; manage bonds; and apply built-in or custom color schemes.'
  - title: 'VS Code Native'
    details: 'Uses the Custom Editor API, normal save/dirty semantics, workspace commands, keyboard shortcuts, and extension-host parsing.'
---

## Built for Structure Editing

ACoord is designed for researchers and engineers who already keep simulation
inputs and outputs in VS Code. The extension host owns parsing, bond detection,
serialization, and edit history; the webview is focused on rendering and input.

## Documentation Map

- Start with [Getting Started](/guide/getting-started) if you are opening your
  first structure.
- Use [File Formats](/guide/file-formats) to check read/write behavior.
- Follow [Editing Atoms](/tutorials/editing-atoms) for structural edits and
  saving behavior.
- Browse [Features](/features/) for visualization, selection, measurement, unit
  cell, and color-scheme details.
