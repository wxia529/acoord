# Atom Selection

ACoord provides powerful atom selection tools for analysis and editing.

## Selection Methods

### Single Selection

**Click to select:**

1. Move cursor over an atom
2. Click the left mouse button
3. Atom highlights (glow effect)
4. Info appears in side panel

### Multi-Selection

**Shift+click for multiple:**

1. Click first atom
2. Hold **Shift**
3. Click additional atoms
4. All selected atoms highlight
5. Panel shows combined info

### Box Selection

**Drag to select region:**

1. Hold the box-select modifier key
2. Click and drag to draw a rectangle
3. Release to select
4. All atoms in box are selected

### Deselect

**Clear selection:**

- Click in empty space
- Or press **Esc**
- Or use **Deselect All** command

## Visual Feedback

### Highlighting

Selected atoms are highlighted with:

- **Glow effect** — Emissive outline
- **Color change** — Slightly brighter
- **Label emphasis** — Bold labels (if shown)

### Selection Info

The side panel displays:

- **Element** — Atom type
- **Position** — Cartesian coordinates
- **Distance** — Between selected atoms
- **Count** — Number of selected atoms

## Selection Persistence

### Across Operations

Selection persists during:

- View rotation/pan/zoom
- Display setting changes
- Lighting adjustments
- Color scheme changes

### Across Frames (Trajectories)

For trajectory visualization:

- Selection carries across frames
- Same atom index is selected
- Watch atom move through simulation

## Selection Actions

Once atoms are selected, you can:

### View Information

- **Position:** (x, y, z) coordinates
- **Element:** Atom type
- **Label:** Custom label if assigned
- **Distance:** To other selected atoms

### Edit Atoms

- **Delete:** Press Delete key
- **Move:** Drag to new position
- **Copy:** Duplicate selected atoms
- **Recolor:** Change atom color

### Measure

- **Bond distance:** Select 2 atoms
- **Angle:** Select 3 atoms (future)
- **Dihedral:** Select 4 atoms (future)

### Hide/Show

- **Hide:** Temporarily hide selected
- **Show All:** Restore hidden atoms
- **Isolate:** Hide all except selected

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Click | Select single atom |
| Shift+click | Add to selection |
| Esc | Deselect all |
| Delete | Delete selected |
| Ctrl+C | Copy selected atoms |
| Ctrl+V | Paste atoms |
| S | Center view on selection |
| H | Hide selected atoms |
| U | Show all hidden atoms |

## Selection Tips

### Precise Selection

- Zoom in for small/dense structures
- Rotate to access occluded atoms
- Use element filter (if available)

### Efficient Workflow

1. Select atoms of interest
2. Center view on selection (S)
3. Perform desired operation
4. Deselect when done

### Large Structures

For structures with many atoms:

- Use box selection for regions
- Select by element type (future)
- Use search/filter (future)

## Use Cases

### Bond Analysis

1. Select two bonded atoms
2. View bond distance in panel
3. Compare with expected values

### Defect Identification

1. Select atoms around defect
2. Measure local distortions
3. Compare with bulk positions

### Surface Selection

1. Use box selection on surface
2. Analyze surface atoms
3. Calculate surface properties

### Molecule Extraction

1. Select molecule of interest
2. Copy to new file
3. Analyze separately

## Troubleshooting

### Can't Select Atom

**Problem:** Click doesn't select
- **Solution:** Ensure cursor is over atom, zoom in closer

**Problem:** Wrong atom selected
- **Solution:** Rotate view, try from different angle

### Selection Not Clearing

**Problem:** Click in empty space doesn't deselect
- **Solution:** Press Esc or use Deselect All command

## Next Steps

- [Editing Atoms](/tutorials/editing-atoms) — Modify selected atoms
- [Bond Measurement](/features/bond-measurement) — Measure distances
- [3D Visualization](/features/3d-visualization) — Navigation basics
