# Features Overview

ACoord provides a comprehensive set of tools for visualizing and editing atomic structures.

## Core Features

### [3D Visualization](/features/3d-visualization)

Interactive 3D rendering powered by Three.js:

- Real-time rotation, pan, and zoom
- High-quality atom and bond rendering
- Multiple rendering styles
- Adjustable lighting
- Smooth animations

### [Atom Selection](/features/atom-selection)

Powerful selection tools:

- Click to select single atoms
- Shift+click for multi-select
- Box selection for regions
- Selection persistence across frames
- Visual highlighting

### [Bond Measurement](/features/bond-measurement)

Bond analysis tools:

- Automatic bond detection
- Distance measurement
- Real-time updates
- Bond creation and deletion
- Custom bond radius

### [Unit Cell Editor](/features/unit-cell)

Crystal structure editing:

- Lattice parameter modification
- Unit cell visualization
- Supercell generation
- Fractional/Cartesian conversion
- Symmetry operations

### [Color Schemes](/features/color-schemes)

Customizable atom colors:

- Built-in presets (Bright, Jmol)
- Custom color scheme creation
- Import/export configurations
- Per-element color assignment
- Element-specific customization

## Additional Features

### Trajectory Support

- Multi-frame file visualization
- Animation playback controls
- Frame-by-frame navigation
- Timeline slider
- Export individual frames

### File Format Support

12+ formats supported:

| Category | Formats |
|----------|---------|
| Crystal | CIF, POSCAR, CONTCAR |
| Molecule | XYZ, PDB |
| Trajectory | XDATCAR |
| Quantum | Gaussian, ORCA, QE, ABACUS |
| Native | .acoord |

### Undo/Redo

Full undo/redo support:

- Unlimited history depth
- Configurable max depth
- Session-based storage
- All edit operations supported

### Keyboard Shortcuts

Customizable keyboard shortcuts:

- Navigation controls
- Selection tools
- Edit commands
- Display toggles
- Quick access to all features

### Display Settings

Comprehensive display options:

- Atom size adjustment
- Bond style selection
- Label visibility
- Lighting controls
- Background color

## Feature Comparison

| Feature | Read | Write | Edit |
|---------|------|-------|------|
| 3D View | ✅ | - | ✅ |
| Atom Selection | ✅ | - | ✅ |
| Bond Measurement | ✅ | - | ✅ |
| Add/Delete Atoms | - | ✅ | ✅ |
| Move Atoms | - | ✅ | ✅ |
| Unit Cell Edit | - | ✅ | ✅ |
| Color Schemes | ✅ | ✅ | ✅ |
| Trajectory | ✅ | ❌ | ❌ |
| Supercell | ✅ | ✅ | ✅ |

## Getting Started

1. [Installation](/guide/installation) — Install ACoord
2. [Getting Started](/guide/getting-started) — Open your first structure
3. [Viewing Tutorial](/tutorials/viewing-structures) — Learn navigation
4. [Editing Tutorial](/tutorials/editing-atoms) — Learn editing

## Keyboard Shortcut Reference

| Category | Shortcut | Action |
|----------|----------|--------|
| **Navigation** | Left-drag | Rotate |
| | Right-drag | Pan |
| | Scroll | Zoom |
| | A | Frame all |
| | S | Frame selection |
| **Selection** | Click | Select atom |
| | Shift+click | Multi-select |
| | Esc | Deselect |
| **Editing** | A | Add atom |
| | D | Delete selected |
| | Ctrl+Z | Undo |
| | Ctrl+Y | Redo |
| **Display** | B | Toggle bonds |
| | L | Toggle labels |
| | H | Hide selected |

## Tips and Tricks

### Performance

- Use InstancedMesh for efficient rendering
- Hide bonds for large structures
- Limit trajectory frame count

### Productivity

- Save custom color schemes
- Use keyboard shortcuts
- Create supercells for periodic visualization

### Best Practices

- Save working files as `.acoord`
- Export to standard formats for sharing
- Use undo frequently during edits

## Need More Help?

- Check individual feature pages for details
- Read [tutorials](/tutorials/) for step-by-step guides
- Report issues on [GitHub](https://github.com/wxia529/vscode-acoord/issues)
