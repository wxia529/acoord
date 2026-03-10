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

- **Action:** Double-click in empty space
- **Use:** Return to the default view angle

## Display Settings

Access display settings from the side panel or command palette.

### Atom Size

Adjust the displayed size of atoms:

1. Open the **Display** panel
2. Find **Atom Size** slider
3. Adjust to your preference
4. Click **Apply** to update the view

### Bond Display

Toggle bond visibility:

1. Open the **Display** panel
2. Check/uncheck **Show Bonds**
3. Bonds appear/disappear immediately

### Color Scheme

Change atom colors:

1. Open the **Display** panel
2. Click the **Color Scheme** dropdown
3. Select a preset (Bright, Jmol, etc.)
4. Click **Apply** to update

### Lighting

Adjust scene lighting:

1. Open the **Lighting** panel
2. Adjust **Ambient**, **Directional**, or **Point** lights
3. Changes apply in real-time

## Selection

### Select Single Atom

- Click directly on an atom
- Selected atom highlights
- Info appears in the side panel

### Multi-Select

- Hold **Shift** and click multiple atoms
- All selected atoms highlight
- Panel shows combined info

### Box Select

- Hold the box-select modifier key
- Drag to draw a selection box
- All atoms in the box are selected

### Deselect

- Click in empty space
- Or press **Esc** to clear selection

## Measuring Bonds

1. Select two bonded atoms (Shift+click both)
2. The **Measurement** panel shows the distance
3. Distance updates in real-time if you move atoms

## Tips and Tricks

### Focus on Selection

After selecting an atom, center the view on it:
- The view automatically centers on selected atoms
- Or double-click on the selected atom

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Frame all atoms |
| `S` | Frame selection |
| `B` | Toggle bonds |
| `L` | Toggle labels |
| `H` | Hide selected |
| `U` | Show all hidden |

### Performance Tips

- Large structures (>1000 atoms) may render slower
- Hide bonds for faster rendering
- Use box selection for precise atom picking

## Next Steps

- [Editing Atoms](/tutorials/editing-atoms) — Learn to modify structures
- [Bond Measurement](/features/bond-measurement) — Advanced measurement features
- [Color Schemes](/features/color-schemes) — Customize atom colors
