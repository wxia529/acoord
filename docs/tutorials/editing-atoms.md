# Editing Atoms

This tutorial covers how to edit atomic structures in ACoord.

## Adding Atoms

### Method 1: Add Atom Command

1. Open the **Edit** panel
2. Click **Add Atom**
3. Enter the element symbol (e.g., "C", "H", "O")
4. Enter coordinates (x, y, z in Angstroms)
5. Click **Add**

### Method 2: Copy Existing Atom

1. Select an atom
2. Right-click and choose **Copy Atom**
3. Modify the position of the new atom
4. Click **Add**

### Method 3: From Clipboard

1. Copy atom data from another file
2. In ACoord, use **Paste Atom** command
3. The atom is added at the specified position

## Deleting Atoms

### Delete Selected

1. Select the atom(s) to delete
2. Press the **Delete** key
3. Or use the **Delete Atom** command
4. The structure updates immediately

### Delete Multiple

1. Multi-select atoms (Shift+click)
2. Press **Delete**
3. All selected atoms are removed

## Moving Atoms

### Drag to Move

1. Click and hold on an atom
2. Drag to the new position
3. Release to drop
4. The atom moves in real-time

### Precise Position

1. Select the atom
2. In the **Edit** panel, enter exact coordinates
3. Press **Update Position**
4. The atom moves to the exact location

### Nudge Atoms

Use arrow keys for small movements:
- **Arrow keys:** Move along X/Y axis
- **Shift + Arrow:** Move along Z axis
- **Ctrl + Arrow:** Fine adjustment (0.01 Å)

## Copying Atoms

### Duplicate Selection

1. Select atom(s)
2. Use **Copy Atom** command
3. New atom(s) appear at the same position
4. Move them to the desired location

### Create Supercell

1. Open the **Lattice** panel
2. Enter supercell dimensions (e.g., 2x2x2)
3. Click **Build Supercell**
4. The structure expands with replicated atoms

## Changing Atom Properties

### Change Element

1. Select the atom
2. In the **Edit** panel, change the element
3. Click **Update**
4. Color and radius update automatically

### Change Color

1. Select the atom
2. Open the **Color** picker
3. Choose a new color
4. Click **Apply**

> **Note:** Custom colors are saved only in `.acoord` format

### Add Label

1. Select the atom
2. Enter label text in the **Edit** panel
3. Press **Update Label**
4. Label appears next to the atom

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

- Unlimited undo/redo within session
- History is cleared when file is closed
- Max depth configurable in settings

## Saving Edits

### Save to File

1. Use **File → Save** (or `Ctrl+S`)
2. Changes are saved to the current file
3. Format-specific serialization applies

### Save As New Format

1. Use **File → Export Structure**
2. Choose target format
3. Specify filename
4. Structure is exported

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
- Enable grid snapping if available
- Check bond distances after moving

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Add atom |
| `D` | Delete selected |
| `M` | Move mode toggle |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy atom |
| `Ctrl+V` | Paste atom |

## Next Steps

- [Working with Unit Cells](/features/unit-cell) — Edit lattice parameters
- [Bond Measurement](/features/bond-measurement) — Measure and create bonds
- [File Formats](/guide/file-formats) — Understand format limitations
