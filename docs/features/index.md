# Features Overview

ACoord provides a comprehensive set of tools for visualizing and editing atomic structures.

## Core Features

### [3D Visualization](/features/3d-visualization)

Interactive 3D rendering powered by Three.js:

- Real-time rotation, pan, and zoom
- High-quality atom and bond rendering
- Adjustable lighting
- Smooth animations

### [Atom Selection](/features/atom-selection)

Selection tools:

- Click to select single atoms
- Ctrl/Cmd+click for multi-select
- Box selection for regions
- Selection persistence across frames

### [Bond Measurement](/features/bond-measurement)

Bond analysis tools:

- Automatic bond detection
- Distance measurement
- Bond creation and deletion

### [Unit Cell Editor](/features/unit-cell)

Crystal structure editing:

- Lattice parameter modification
- Unit cell visualization
- Supercell generation

### [Color Schemes](/features/color-schemes)

Customizable atom colors:

- Built-in presets (Bright, Jmol)
- Custom color scheme creation
- Import/export configurations

### Fixed Atoms

Constraint management for geometry optimization:

- Mark atoms as fixed (constrained) or free
- Visual indicator: white 3D cross marker on atom surface
- Syncs with format-native constraints in POSCAR, QE, STRU, OpenMX, CASTEP cell,
  and native `.acoord` files where supported
- Omits redundant constraint flags when all atoms are unconstrained

### Directional Atom Brush

- Drag from an existing atom to pull out one new atom
- Live direction and endpoint preview
- `1.54 Å` default maximum length with a small activation threshold

### Ghost Atoms

- Distinct real, dummy, and ghost atom roles
- Gaussian `Bq` and element ghost syntax; ORCA element-colon syntax
- H-basis insertion at geometric or mass centers
- Signed plane-normal offset and translucent wireframe rendering

## Additional Features

### Trajectory Support

- Multi-frame file visualization
- Animation playback controls
- Frame-by-frame navigation

### File Format Support

15+ formats supported:

| Category | Formats |
|----------|---------|
| Crystal | CIF, POSCAR, CONTCAR |
| Molecule | XYZ, PDB |
| Trajectory | XDATCAR, OUTCAR |
| Quantum | Gaussian, ORCA, QE, ABACUS, CASTEP, SIESTA, OpenMX |
| Native | .acoord |

### Undo/Redo

- Up to 100 history steps
- All edit operations supported

## Getting Started

1. [Installation](/guide/installation) — Install ACoord
2. [Getting Started](/guide/getting-started) — Open your first structure
3. [Viewing Tutorial](/tutorials/viewing-structures) — Learn navigation
4. [Editing Tutorial](/tutorials/editing-atoms) — Learn editing

## Keyboard Shortcuts

| Category | Shortcut | Action |
|----------|----------|--------|
| **Navigation** | Left-drag | Rotate |
| | Right-drag | Pan |
| | Scroll | Zoom |
| **Selection** | Click | Select atom |
| | Ctrl/Cmd+click | Multi-select |
| | Ctrl+A | Select all |
| | Ctrl+I | Invert selection |
| | Esc | Deselect all |
| **Editing** | A | Enter add atom mode |
| | D | Delete mode |
| | V | Select mode |
| | Delete/Backspace | Delete selected |
| | Ctrl+Z | Undo |
| | Ctrl+Y | Redo |
| | Ctrl+S | Save |
| | Ctrl+C | Copy selected atoms |
| | Ctrl+V | Paste atoms |


## Need More Help?

- Check individual feature pages for details
- Read [tutorials](/tutorials/) for step-by-step guides
- Report issues on [GitHub](https://github.com/wxia529/acoord/issues)
