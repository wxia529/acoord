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

### Rotate View (Left Mouse)

- **Action:** Left-click and drag in empty space
- **Effect:** Rotate the camera around the structure
- **Use:** View from different angles

### Pan View (Right Mouse)

- **Action:** Right-click and drag in empty space
- **Effect:** Move the camera horizontally/vertically
- **Use:** Explore different regions

### Zoom (Scroll Wheel)

- **Action:** Scroll wheel up/down
- **Effect:** Move camera closer/farther
- **Use:** Examine details or see full structure

### Frame All (Reset View)

- **Action:** Click the **Reset** button in the toolbar
- **Effect:** Center and fit all atoms in view
- **Use:** Reset view after navigation

## Moving and Rotating Atoms

### Move Single Atom (Left Mouse Drag)

- **Action:** Left-click and drag on an atom
- **Effect:** Move the atom in the viewing plane
- **Use:** Reposition individual atoms

### Move Multiple Atoms (Right Mouse + Shift + Alt)

- **Action:** Select atoms, then right-click + Shift + Alt + drag
- **Effect:** Move all selected atoms together
- **Use:** Translate groups of atoms

### Rotate Selection (Right Mouse + Shift)

- **Action:** Select atoms, then right-click + Shift + drag
- **Effect:** Rotate selected atoms around their center
- **Use:** Rotate molecular fragments

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

### Bond Operations

- **Create bond:** Select two atoms → Right-click → Create Bond
- **Delete bond:** Click on bond → Press Delete
- **Recalculate:** Right-click → Calculate Bonds
- **Clear all:** Right-click → Clear Bonds
- **Adjust thickness:** Use bond thickness slider in Lattice panel

See [Bond Measurement](/features/bond-measurement) for details.

## Lighting

### Light Types

ACoord supports multiple light types:

| Type | Description |
|------|-------------|
| Ambient | Uniform base illumination |
| Key | Main directional light (like the sun) |
| Fill | Secondary light to fill shadows |
| Rim | Edge highlighting from behind |

### Adjusting Lighting

1. Open the **Lighting** panel
2. Adjust individual light intensity
3. Change light colors
4. Pick light direction by clicking **Pick in Canvas** and dragging in the 3D view
5. Toggle custom lighting on/off

## Background

### Background Color

Change the view background:

1. Open **Display** panel
2. Use the **Background** color picker
3. Applies immediately

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

### High Resolution Export

For publications:

1. Set up desired view
2. Click the **Export Image** button in the toolbar
3. High-resolution PNG (4x scale) is generated automatically

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
- **Solution:** Click **Reset** button in toolbar to frame all atoms
- **Solution:** Check zoom level

**Problem:** Choppy rotation
- **Solution:** Reduce atom count or geometry quality

### WebGL Errors

**Problem:** "WebGL not supported"
- **Solution:** Update graphics drivers, enable hardware acceleration in VS Code

## Next Steps

- [Atom Selection](/features/atom-selection) — Select and manipulate atoms
- [Bond Measurement](/features/bond-measurement) — Analyze bonding
- [Color Schemes](/features/color-schemes) — Customize appearance
