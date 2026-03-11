# Viewing Structures

This tutorial covers the basics of viewing atomic structures in ACoord.

## Opening a Structure File

### Method 1: Automatic Detection

1. Open a supported file in VS Code (`.cif`, `.xyz`, `POSCAR`, etc.)
2. Click the **ACoord Structure Editor** icon in the editor title bar
3. The structure loads in 3D view

### Method 2: Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type **"ACoord: Open Structure Editor"**
3. Press Enter

### Method 3: Right-Click Menu

1. Right-click on the file in the editor
2. Select **Reopen with → ACoord Structure Editor**

## Navigation Controls

### Rotate

- **Action:** Left-click and drag
- **Use:** View the structure from different angles

### Pan

- **Action:** Right-click and drag
- **Use:** Move the view horizontally or vertically

### Zoom

- **Action:** Scroll wheel up/down
- **Use:** Get closer or farther from the structure

### Reset View

- Click the **Reset** button in the toolbar
- Returns to the default view angle

## Display Settings

Access display settings from the side panels.

### Atom Size

Adjust the displayed size of atoms:

1. Open the **Lattice** panel
2. Use the **Atoms radius** slider to adjust selected atoms
3. Click **Reset to element default** or **Set to covalent radius** for defaults

### Bond Operations

Bonds are displayed automatically when atoms are close enough. To manage bonds:

- **Create bond:** Select two atoms → Right-click → Create Bond
- **Delete bond:** Click on bond → Press Delete
- **Recalculate:** Right-click → Calculate Bonds

### Color Scheme

Change atom colors:

1. Open the **Brush** panel (top of sidebar)
2. Select a color scheme from the dropdown (Bright, Jmol, or custom)
3. Click **Apply** to update selected atoms (or all if none selected)

### Lighting

Adjust scene lighting:

1. Open the **Lighting** panel
2. Adjust **Ambient**, **Key**, **Fill**, or **Rim** lights
3. Changes apply in real-time

## Selection

### Select Single Atom

- Click directly on an atom
- Selected atom highlights
- Info appears in the side panel

### Multi-Select

- Hold **Ctrl/Cmd** and click multiple atoms
- All selected atoms highlight
- Panel shows combined info

### Box Select

- Ensure the **Select** tool is active (press `V` or click Select in toolbar)
- Click and drag in empty space (not on an atom)
- A selection box appears
- Release to select all atoms inside the box
- Hold **Ctrl/Cmd** while releasing to add to current selection
- Hold **Alt** while releasing to subtract from current selection

### Deselect

- Click in empty space
- Or press **Esc** to clear selection

## Measuring Bonds

1. Select two bonded atoms (Ctrl/Cmd+click both)
2. The **Measurement** panel shows the distance
3. Distance updates in real-time if you move atoms

## Tips and Tricks

### Performance Tips

- Large structures (>1000 atoms) may render slower
- Hide bonds for faster rendering
- Use box selection for precise atom picking

## Next Steps

- [Editing Atoms](/tutorials/editing-atoms) — Learn to modify structures
- [Bond Measurement](/features/bond-measurement) — Advanced measurement features
- [Color Schemes](/features/color-schemes) — Customize atom colors
