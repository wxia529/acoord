# 3D Visualization

ACoord provides high-quality 3D visualization of atomic structures using Three.js.

## Rendering Engine

ACoord uses **Three.js** (WebGL) for hardware-accelerated 3D rendering inside VS Code's webview.

### Key Features

- **InstancedMesh rendering** — Efficient rendering of thousands of atoms
- **Real-time interaction** — Smooth rotation, pan, and zoom
- **High-quality shading** — Physically-based material rendering
- **Responsive design** — Adapts to editor size

## Navigation

### Rotate

- **Action:** Left-click and drag
- **Effect:** Rotate the structure around its center
- **Use:** View from different angles

### Pan

- **Action:** Right-click and drag
- **Effect:** Move the view horizontally/vertically
- **Use:** Explore different regions

### Zoom

- **Action:** Scroll wheel
- **Effect:** Move camera closer/farther
- **Use:** Examine details or see full structure

### Frame All

- **Action:** Press `A` or double-click
- **Effect:** Center and fit all atoms in view
- **Use:** Reset view after navigation

## Atom Rendering

### Sphere Representation

Atoms are rendered as spheres with:

- **Element-specific colors** — Based on CPK convention or custom schemes
- **Configurable radius** — Adjust display size independently of element
- **Smooth shading** — High-quality sphere geometry

### Color Schemes

Choose from built-in or custom color schemes:

| Scheme | Description |
|--------|-------------|
| Bright | Vibrant, modern colors |
| Jmol | Traditional Jmol colors |
| Custom | User-defined colors |

See [Color Schemes](/features/color-schemes) for details.

## Bond Rendering

### Automatic Detection

Bonds are automatically calculated based on:

- **Interatomic distance** — Within bonding threshold
- **Element types** — Covalent radius consideration
- **Periodic boundaries** — Bonds across unit cell edges

### Display Options

- **Show/Hide bonds** — Toggle visibility
- **Bond radius** — Adjust thickness
- **Bond color** — Element-based or uniform

See [Bond Measurement](/features/bond-measurement) for details.

## Lighting

### Light Types

ACoord supports multiple light types:

| Type | Description |
|------|-------------|
| Ambient | Uniform base illumination |
| Directional | Sun-like parallel light rays |
| Point | Omnidirectional point source |

### Adjusting Lighting

1. Open the **Lighting** panel
2. Adjust individual light intensity
3. Change light positions (for point lights)
4. Toggle lights on/off

### Presets

Common lighting setups:

- **Default** — Balanced illumination
- **Bright** — Maximum visibility
- **Dramatic** — High contrast shadows
- **Flat** — Minimal shading (for publications)

## Display Styles

### Ball-and-Stick

Classic representation:

- Atoms as spheres
- Bonds as cylinders
- Clear structure visualization

### Space-Filling (CPK)

Atoms at full van der Waals radius:

- Shows molecular surface
- No bonds displayed
- Useful for packing analysis

### Polyhedral

Coordination polyhedra:

- Shows coordination environment
- Useful for crystal structures
- Custom polyhedron definition

## Background

### Background Color

Change the view background:

1. Open **Display** panel
2. Click **Background Color**
3. Choose a color
4. Applies immediately

### Transparent Background

For screenshots with transparency:

1. Set background alpha to 0
2. Export as PNG
3. Composite in image editor

## Performance

### Optimization Tips

- **Large structures (>1000 atoms):**
  - Use smaller atom display size
  - Hide bonds if not needed
  - Reduce geometry quality

- **Trajectories:**
  - Limit loaded frames
  - Use lower FPS for playback
  - Export subsets for analysis

### Hardware Requirements

- **Minimum:** Any GPU with WebGL support
- **Recommended:** Dedicated GPU for large structures
- **Integrated:** Works but may be slower

## Export Images

### Screenshot

1. Set up desired view
2. Use **Export → Image** command
3. Choose resolution
4. Save as PNG

### High Resolution

For publications:

1. Set view angle
2. Export at 2x or 4x resolution
3. High-quality PNG or SVG

## Tips and Tricks

### Best Views

- Align principal axes with view direction
- Use symmetry for aesthetically pleasing views
- Show unit cell boundaries for crystals

### Lighting Tips

- Use multiple lights for even illumination
- Avoid harsh shadows for presentations
- Test on different displays

### Performance Tips

- Close unused editor sessions
- Clear trajectory memory after analysis
- Use `.acoord` format for faster loading

## Troubleshooting

### Rendering Issues

**Problem:** Atoms appear black
- **Solution:** Check lighting settings, increase ambient light

**Problem:** Structure not visible
- **Solution:** Press `A` to frame all, check zoom level

**Problem:** Choppy rotation
- **Solution:** Reduce atom count or geometry quality

### WebGL Errors

**Problem:** "WebGL not supported"
- **Solution:** Update graphics drivers, enable hardware acceleration in VS Code

## Next Steps

- [Atom Selection](/features/atom-selection) — Select and manipulate atoms
- [Bond Measurement](/features/bond-measurement) — Analyze bonding
- [Color Schemes](/features/color-schemes) — Customize appearance
