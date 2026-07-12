# Editing Atoms

This tutorial covers how to edit atomic structures in ACoord.

## Adding Atoms

### Method 1: Top Toolbar Atom Brush

1. Choose an element from **Add Atom...** in the top toolbar.
2. Enable **Brush**. The active button and crosshair cursor indicate brush mode.
3. Press the left mouse button on an existing atom, drag in the desired direction,
   and release to create one new atom at the preview endpoint.
4. Set **Max length** to cap how far the new atom can be pulled. The default is
   `1.54 Å`, approximately a typical C–C single-bond length. Dragging farther
   keeps the endpoint at this limit instead of creating atoms indefinitely.
5. Press `Esc`, press `A`, or click **Brush** again to leave brush mode.

The blue preview line shows direction and the endpoint ring shows the final
position. Tiny movements below the activation threshold are ignored, and a
drag must start on an existing atom. The gesture runs in the camera-facing plane
through the source atom. Atom color and radius come from the current display
brush settings.

### Copying Cartesian Coordinates

Select one atom and click **Copy x, y, z** in the right-side Properties panel.
The clipboard receives plain comma-separated values such as
`1.25,-2,3.123456789`, without spaces, parentheses, or an element label.

### Copying Selected Atom Indices

The right-side **Atom Selection** panel simultaneously lists 1-based and 0-based
atom indices, each with its own copy button. Runs of three or more consecutive
atoms are compressed, for example `1,2,5-8,10`, with no spaces.

### Method 2: Keyboard Shortcut

1. Press `A` to enter add atom mode
2. Type the element symbol (e.g., "C", "H", "O")
3. Click in the 3D canvas to place the atom
4. Press `Esc` to exit add mode

### Method 3: Right-Click Menu

1. Right-click in the 3D canvas
2. Navigate to **Add atom** submenu
3. Select the element
4. Atom is added at the click position

### Method 4: Quick Add Panel

1. Locate the **Quick Add** section in the Properties panel
2. Enter element symbol and coordinates (x, y, z)
3. Click **Add**

## Inserting Ghost Atoms

The right-side **Ghost Atom** panel inserts a basis-only center. ACoord uses an
H basis by default: Gaussian writes `Bq`, while ORCA writes `H:`.

1. Select one or more atoms.
2. Choose **Geometric center** or **Center of mass**.
3. Enter a signed **Plane-normal offset (Å)**. Use `0` to insert directly at
   the center; positive and negative values place the ghost on opposite sides.
4. Click **Insert H Ghost Atom**.

A non-zero normal offset requires at least three non-collinear selected atoms.
Three atoms define an exact plane. Four or more atoms use a PCA least-squares
best-fit plane, so every selected atom contributes to the normal. If the fitted
plane RMS deviation exceeds `0.1 Å`, ACoord warns that the selection is noticeably
non-planar but still inserts the ghost. Collinear selections are rejected. The
normal direction is normalized deterministically, so changing selection order
does not randomly swap the positive and negative sides. Ghost and dummy atoms
do not participate in automatic bonding or mass calculations.

::: warning Ghost versus dummy
A ghost atom has no nucleus or electrons but carries basis functions. A dummy
atom is only a geometric reference point and has no basis. They are stored and
exported as different atom roles.
:::

## Deleting Atoms

1. Select the atom(s) to delete
2. Press **Delete** or **Backspace**
3. Or right-click → **Delete atom**

## Moving Atoms

### Drag to Move

- **Left-click and drag** on an atom to move it in the viewing plane

### Precise Position

1. Select the atom
2. In the Properties panel, enter exact X, Y, Z coordinates
3. Click **Apply**

### Move Multiple Atoms

- Select atoms, then **right-click + Shift + Alt + drag**

### Rotate Selection

- Select atoms, then **right-click + Shift + drag** to rotate around center

## Copying Atoms

1. Select atom(s)
2. Press **Ctrl+C** (or right-click → Copy)
3. Press **Ctrl+V** to paste
4. New atoms appear at offset position

## Changing Atom Properties

### Change Element

1. Select the atom
2. Right-click → **Change element** → select new element
3. Color and radius update automatically

### Change Color

1. Select the atom(s)
2. Right-click → **Set color...**
3. Choose a new color

> **Note:** Custom colors are saved only in `.acoord` format

### Fix/Unfix Atoms

Fixed atoms are constrained during geometry optimization (e.g., in VASP calculations).

1. Select the atom(s)
2. Right-click → **Fix atom** or **Unfix atom**
3. A white 3D cross marker appears on fixed atoms

::: tip Visual Indicator
The 3D cross marker is visible from any viewing angle and respects depth occlusion (hidden when behind other atoms).
:::

::: info Constraint Export
Fixed atoms are synced with format-native movement constraints where supported:
- POSCAR: selective dynamics flags
- QE: `ATOMIC_POSITIONS` `if_pos` flags
- ABACUS STRU: atom movement flags
- OpenMX: `MD.Fixed.XYZ`
- CASTEP cell: `IONIC_CONSTRAINTS`

If every atom is free, ACoord omits redundant fixed/free flags when the target
format allows the constraint fields to be left blank.
:::

## Undo and Redo

- **Undo:** Ctrl+Z (or Cmd+Z on macOS)
- **Redo:** Ctrl+Y (or Cmd+Y on macOS)

## Saving Edits

- **Save:** Ctrl+S (or click Save button in toolbar)
- **Save As:** Click **Save As** button, choose format

For full fidelity (preserving colors, labels, etc.), save as `.acoord` format.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `A` | Enter add atom mode |
| `D` | Delete mode |
| `V` | Select mode |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+C` | Copy selected atoms |
| `Ctrl+V` | Paste atoms |
| `Delete/Backspace` | Delete selected |
| `Esc` | Cancel current operation |
