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

**Show/hide unit cell:**

1. Open **Lattice** panel
2. Check **Show Unit Cell**
3. Cell edges display as lines
4. Optional: show cell faces

## Editing Lattice Parameters

### Edit Lengths

**Modify a, b, c:**

1. Open **Lattice** panel
2. Enter new values for a, b, c
3. Click **Apply**
4. Lattice vectors update
5. Atom positions scale accordingly

### Edit Angles

**Modify α, β, γ:**

1. Open **Lattice** panel
2. Enter new angle values
3. Click **Apply**
4. Cell shape changes
5. Atoms transform with cell

### Edit Vectors Directly

**Cartesian vector editing:**

1. Open **Lattice** panel
2. Switch to **Vector** mode
3. Edit vector components
4. Click **Apply**

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

**Switch coordinate display:**

1. Open **Lattice** panel
2. Toggle **Fractional/Cartesian**
3. Atom positions update

### Convert Coordinates

**Manual conversion:**

```
Cartesian = fractional_a × ⃗a + fractional_b × ⃗b + fractional_c × ⃗c
```

ACoord handles conversion automatically.

## Supercell Generation

### Build Supercell

**Create supercell:**

1. Open **Lattice** panel
2. Enter supercell dimensions (n×m×p)
3. Click **Build Supercell**
4. Structure expands with replicated atoms
5. New unit cell defined

### Example: 2×2×2 Supercell

Original cell → 2×2×2 supercell:
- Atoms: 8× increase
- Cell vectors: 2× longer
- Preserves crystal symmetry

### Use Cases

- **Defect calculations:** Create large cells for defects
- **Surface models:** Cleave and expand
- **Phonons:** Generate supercells for displacements
- **Visualization:** Show periodicity

## Centering Atoms

### Center in Cell

**Move atoms to cell center:**

1. Select atoms (or all)
2. Use **Center in Cell** command
3. Atoms wrap to [0, 1) fractional

### Wrap Atoms

**Apply periodic boundary:**

1. Use **Wrap Atoms** command
2. All atoms inside unit cell
3. Removes duplicates across boundaries

## Lattice Visualization

### Cell Edges

**Display options:**

- Show/hide edges
- Edge color
- Edge thickness

### Cell Faces

**Display options:**

- Show/hide faces
- Face transparency
- Face color

### Lattice Vectors

**Display option:**

- Show vector arrows
- Label vectors (⃗a, ⃗b, ⃗c)
- Show vector lengths

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
3. Atoms stay fixed
4. Vacuum added

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
- Wrap atoms after large cell changes

### Visualization

- Show cell edges for context
- Use transparency for faces
- Generate supercell for clarity

## Troubleshooting

### Atoms Outside Cell

**Problem:** Atoms appear outside cell
- **Solution:** Use **Wrap Atoms** command
- **Solution:** Check fractional coordinates

### Distorted Structure

**Problem:** Structure looks wrong after edit
- **Solution:** Verify lattice parameters
- **Solution:** Check angle conventions

### Supercell Issues

**Problem:** Atoms overlap in supercell
- **Solution:** Check original cell is complete
- **Solution:** Verify no partial occupancies

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| L | Toggle lattice display |
| Ctrl+L | Open lattice panel |

## Next Steps

- [3D Visualization](/features/3d-visualization) — View crystal structures
- [Bond Measurement](/features/bond-measurement) — Analyze bonding
- [File Formats](/guide/file-formats) — CIF and POSCAR formats
