# Unit Cell Editor

ACoord provides comprehensive tools for editing crystal unit cells and generating supercells.

## Unit Cell Basics

### Lattice Parameters

A unit cell is defined by:

- **Lengths:** a, b, c (in Angstroms)
- **Angles:** α, β, γ (in degrees)

Or as lattice vectors:

```
⃗a = (a_x, a_y, a_z)
⃗b = (b_x, b_y, b_z)
⃗c = (c_x, c_y, c_z)
```

### Display Unit Cell

**Show/hide unit cell edges:**

- Use the Display panel to customize unit cell appearance
- Cell edges display as lines (color and thickness adjustable)

## Editing Lattice Parameters

### Edit Lengths

**Modify a, b, c:**

1. Open **Lattice** panel
2. Enter new values for a, b, c
3. Check/uncheck **Scale atoms with lattice**
4. Click **Apply Lattice**
5. Lattice vectors update

### Edit Angles

**Modify α, β, γ:**

1. Open **Lattice** panel
2. Enter new angle values
3. Check/uncheck **Scale atoms with lattice**
4. Click **Apply Lattice**
5. Cell shape changes

### Edit Vectors Directly

**Note:** Direct vector editing is not currently supported. Use lattice parameters (a, b, c, α, β, γ) to define the unit cell.

## Fractional vs Cartesian

### Coordinate Systems

**Fractional coordinates:**

- Expressed as fraction of lattice vectors
- Range: [0, 1) for atoms in unit cell
- Independent of cell size

**Cartesian coordinates:**

- Expressed in Angstroms
- Absolute positions
- Scale with cell

### Toggle Display

**Coordinate display:**

- Positions in the Properties panel are always shown in Cartesian coordinates (Å)

### Convert Coordinates

**Manual conversion:**

```
Cartesian = fractional_a × ⃗a + fractional_b × ⃗b + fractional_c × ⃗c
```

ACoord handles conversion automatically.

## Supercell Generation

### Build Supercell

**Create supercell display:**

1. Open **Lattice** panel
2. Enter supercell dimensions (n×m×p)
3. Click **Apply Supercell**
4. Structure expands with periodic images displayed

### Example: 2×2×2 Supercell

Original cell → 2×2×2 supercell display:
- Shows 8 unit cells
- Periodic images of atoms displayed
- Original atoms remain in their positions

### Use Cases

- **Defect calculations:** Create large cells for defects
- **Surface models:** Cleave and expand
- **Phonons:** Generate supercells for displacements
- **Visualization:** Show periodicity

## Centering Atoms

### Center in Cell

**Move atoms to cell center:**

1. Click **Center** button in the Lattice panel
2. Confirm the operation in the dialog
3. All atoms are translated so the geometric center aligns with the cell center

> **Note:** This operation moves all atoms and can be undone with Ctrl+Z.

## Lattice Visualization

### Cell Edges

**Display options in Display panel:**

- **Color:** Change unit cell edge color
- **Thickness:** Adjust edge line thickness (0.5-6)
- **Line style:** Solid or dashed

## Crystal Systems

ACoord supports all crystal systems:

| System | Parameters | Example |
|--------|------------|---------|
| Cubic | a=b=c, α=β=γ=90° | Si, NaCl |
| Tetragonal | a=b≠c, α=β=γ=90° | TiO₂ |
| Orthorhombic | a≠b≠c, α=β=γ=90° | FeB |
| Hexagonal | a=b≠c, α=β=90°, γ=120° | ZnO |
| Rhombohedral | a=b=c, α=β=γ≠90° | α-Al₂O₃ |
| Monoclinic | a≠b≠c, α=γ=90°≠β | SiO₂ |
| Triclinic | a≠b≠c, α≠β≠γ | K₂Cr₂O₇ |

## Common Operations

### Expand Vacuum

**Add vacuum layer:**

1. Open **Lattice** panel
2. Increase c parameter (for slab)
3. Uncheck **Scale atoms with lattice**
4. Click **Apply Lattice**
5. Vacuum added without moving atoms

### Change Cell Shape

**Modify angles:**

1. Edit α, β, or γ
2. Cell distorts
3. Atoms transform with cell
4. Preserves fractional coordinates

### Scale Cell

**Uniform scaling:**

1. Multiply a, b, c by factor
2. Cell expands/contracts
3. Atoms scale proportionally

### Strain Cell

**Apply strain:**

1. Modify specific lattice parameter
2. Uniaxial or biaxial strain
3. Atoms adjust positions

## Tips and Best Practices

### Symmetry

- Check symmetry after editing
- Use supercell to break symmetry intentionally
- Preserve symmetry for consistent results

### Atom Positions

- Use fractional for crystallographic work
- Use Cartesian for molecular systems

### Visualization

- Show cell edges for context
- Adjust edge color and thickness for visibility
- Use supercell display for periodicity

## Troubleshooting

### Atoms Outside Cell

**Problem:** Atoms appear outside cell
- **Solution:** This is normal for visualization; atoms can be outside the displayed unit cell
- **Note:** The structure is still valid; supercell display shows periodic images

### Distorted Structure

**Problem:** Structure looks wrong after edit
- **Solution:** Verify lattice parameters
- **Solution:** Check angle conventions

### Supercell Issues

**Problem:** Atoms overlap in supercell
- **Solution:** Check original cell is complete
- **Solution:** Verify no partial occupancies

## Next Steps

- [3D Visualization](/features/3d-visualization) — View crystal structures
- [Bond Measurement](/features/bond-measurement) — Analyze bonding
- [File Formats](/guide/file-formats) — CIF and POSCAR formats
