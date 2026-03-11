# Editing Atoms

This tutorial covers how to edit atomic structures in ACoord.

## Adding Atoms

### Method 1: Quick Add Panel

1. Locate the **Quick Add** panel in the sidebar
2. Enter the element symbol (e.g., "C", "H", "O")
3. Enter coordinates (x, y, z in Angstroms)
4. Click **Add**

### Method 2: Keyboard Shortcut

1. Press `A` to enter add atom mode
2. Type the element symbol (e.g., "C", "H", "O")
3. Click in the 3D canvas to place the atom
4. Press `Esc` to exit add mode

### Method 3: Right-Click Menu

1. Right-click in the 3D canvas
2. Navigate to **Add Atom** submenu
3. Select the element to add
4. Click to place the atom

## Deleting Atoms

### Delete Selected

1. Select the atom(s) to delete
2. Press the **Delete** key
3. Or use the **Delete Atom** command
4. The structure updates immediately

### Delete Multiple

1. Multi-select atoms (Ctrl/Cmd+click)
2. Press **Delete** or **Backspace**
3. All selected atoms are removed

## Moving Atoms

### Drag to Move (Left Mouse)

1. Click and drag the atom with **left mouse button**
2. The atom follows the mouse in the viewing plane
3. Release to place at the new position

### Precise Position

1. Select the atom
2. In the side panel, enter exact coordinates in the X, Y, Z fields
3. The atom moves to the exact location

### Move Multiple Atoms (Right Mouse)

1. Select multiple atoms (Ctrl/Cmd+click)
2. **Right-click + Shift + Alt + drag** to move all selected atoms together
3. Release to place

### Rotate Selection (Right Mouse)

1. Select multiple atoms (Ctrl/Cmd+click)
2. **Right-click + Shift + drag** to rotate the selection around its center
3. Release to apply

## Copying Atoms

### Duplicate Selection

1. Select atom(s)
2. Use **Copy Atom** command
3. New atom(s) appear at the same position
4. Move them to the desired location

### Create Supercell

1. Open the **Lattice** panel
2. Enter supercell dimensions (e.g., 2×2×2)
3. Click **Apply Supercell**
4. The structure expands with replicated atoms

## Changing Atom Properties

### Change Element

1. Select the atom
2. In the side panel, change the element symbol
3. Color and radius update automatically

### Change Color

1. Select the atom
2. Use the color picker in the side panel
3. Choose a new color
4. The color applies immediately

> **Note:** Custom colors are saved only in `.acoord` format

## Undo and Redo

### Undo

- Press `Ctrl+Z` (or `Cmd+Z` on macOS)
- Or use **Undo** command
- Reverts the last edit

### Redo

- Press `Ctrl+Y` (or `Cmd+Y` on macOS)
- Or use **Redo** command
- Restores the undone edit

### Undo History

- Up to 100 undo steps (or memory-limited)
- Large structures (>5000 atoms) may have limited undo
- History is cleared when file is closed

## Saving Edits

### Save to File

- Press `Ctrl+S` (or `Cmd+S` on macOS)
- Or click the **Save** button in the toolbar
- Changes are saved to the current file

### Save As New Format

- Click the **Save As** button in the toolbar
- Choose target format from the dropdown
- Specify filename
- Structure is exported

### Native Format

For full fidelity (preserving colors, labels, etc.):
1. Save as `.acoord` format
2. All edits are preserved exactly
3. Reopen later with full fidelity

## Tips and Best Practices

### Work Non-Destructively

- Save a backup before major edits
- Use `.acoord` format for working files
- Export to other formats for sharing

### Precise Editing

- Use coordinate input for exact positions
- Check bond distances after moving

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Enter add atom mode (type element symbol) |
| `D` | Delete mode |
| `V` | Select mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+C` | Copy selected atoms |
| `Ctrl+V` | Paste atoms |
| `Delete/Backspace` | Delete selected |
| `Esc` | Cancel current operation |

## Next Steps

- [Working with Unit Cells](/features/unit-cell) — Edit lattice parameters
- [Bond Measurement](/features/bond-measurement) — Measure and create bonds
- [File Formats](/guide/file-formats) — Understand format limitations
