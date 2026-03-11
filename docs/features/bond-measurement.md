# Bond Measurement

ACoord provides automatic bond detection and interactive measurement tools.

## Automatic Bond Detection

### How It Works

Bonds are automatically calculated based on:

1. **Interatomic distance** — Atoms within threshold distance
2. **Element types** — Covalent radius consideration
3. **Bonding criteria** — Element-specific bonding radii

### Bonding Threshold

Default bonding uses:

```
bond_threshold = (radius_A + radius_B) × tolerance_factor
```

- **tolerance_factor:** Typically 1.1-1.2
- **Adjustable:** In advanced settings (future)

## Bond Operations

### Create Bond

**Manually create a bond between atoms:**

1. Select two atoms (Ctrl/Cmd+click)
2. Right-click and select **Create Bond**
3. Bond appears immediately
4. Saved in `.acoord` format

### Delete Bond

**Remove a specific bond:**

1. Select the bond (click on it in the 3D view)
2. Press **Delete** or **Backspace**
3. Or right-click and select **Delete Bond**
4. Bond is removed from the structure

### Recalculate Bonds

**Re-detect bonds based on distance:**

1. Right-click in the 3D canvas
2. Select **Calculate Bonds**
3. Bonds are recalculated based on current atom positions

### Clear All Bonds

**Remove all bonds from structure:**

1. Right-click in the 3D canvas
2. Select **Clear Bonds**
3. All bonds are removed

## Distance Measurement

### Measure Distance

**Select atoms to measure:**

1. Select first atom (click)
2. Hold **Ctrl/Cmd**, select second atom
3. Distance displays in the Properties panel
4. Updates in real-time if atoms move

### Measure Angle

**Select 3 atoms to measure angle:**

1. Select three atoms (Ctrl/Cmd+click)
2. Angle displays in the Properties panel
3. Angle is measured at the middle atom

### Units

- **Distance:** Angstroms (Å)
- **Angle:** Degrees (°)

## Bond Analysis

### Bond Statistics

When atoms are selected, the Properties panel shows:

- **Element** — Atom type
- **Position** — Cartesian coordinates
- **Distance** — Between 2 selected atoms
- **Angle** — Between 3 selected atoms

## Common Bond Lengths

Reference values (Å):

| Bond | Typical Length |
|------|----------------|
| C-C | 1.54 |
| C=C | 1.34 |
| C≡C | 1.20 |
| C-H | 1.09 |
| O-H | 0.96 |
| N-H | 1.01 |
| Si-O | 1.61 |

> **Note:** Actual values depend on chemical environment

## Use Cases

### Structure Validation

1. Measure key bond lengths
2. Compare with expected values
3. Identify unusual geometries

### Reaction Analysis

1. Measure bonds before/after
2. Track bond breaking/formation
3. Analyze transition states

### Crystal Analysis

1. Measure coordination bonds
2. Analyze polyhedral connectivity
3. Check bond valence sums

## Tips and Best Practices

### Accurate Measurement

- Ensure structure is relaxed/optimized
- Check for periodic boundary effects
- Consider thermal motion in MD trajectories

### Bond Visualization

- Use appropriate bond radius for clarity
- Adjust threshold if bonds missing/extra
- Color bonds by type for analysis

### Performance

- Bond calculation is fast (<1000 atoms)
- Large structures: bonds calculated on demand
- Disable bond display for very large systems

## Troubleshooting

### Missing Bonds

**Problem:** Expected bonds not shown
- **Solution:** Check bonding threshold, atoms may be too far
- **Solution:** Verify atom types are correct

### Extra Bonds

**Problem:** Unrealistic bonds displayed
- **Solution:** Reduce bonding tolerance
- **Solution:** Check for close contacts in structure

### Incorrect Distances

**Problem:** Distance seems wrong
- **Solution:** Verify units (Å vs nm)
- **Solution:** Check for periodic boundary crossing

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Ctrl/Cmd+click | Add/remove atom from selection |
| Ctrl+A | Select all atoms |
| Ctrl+I | Invert selection |
| Delete/Backspace | Delete selected atoms/bonds |

## Next Steps

- [Atom Selection](/features/atom-selection) — Select atoms to measure
- [3D Visualization](/features/3d-visualization) — View bonds in 3D
- [Unit Cell](/features/unit-cell) — Periodic bonding
