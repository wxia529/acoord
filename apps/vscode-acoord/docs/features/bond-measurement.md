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

## Bond Display

### Toggle Bonds

**Show/hide bonds:**

- Press `B` key
- Or use **Toggle Bonds** command
- Or check **Show Bonds** in Display panel

### Bond Styling

**Bond appearance:**

- **Radius:** Adjust bond thickness
- **Color:** Element-based or uniform
- **Style:** Cylinder (default) or lines (future)

## Distance Measurement

### Measure Bond Length

**Two-atom selection:**

1. Select first atom (click)
2. Hold **Shift**, select second atom
3. Distance displays in side panel
4. Updates in real-time if atoms move

### Units

- **Default:** Angstroms (Å)
- **Alternative:** Nanometers, Bohr (future)

### Precision

- Displayed to 0.001 Å
- Internal precision: double (15 digits)

## Manual Bond Creation

### Create Bond

**Force bond between atoms:**

1. Select two atoms
2. Use **Create Bond** command
3. Bond appears immediately
4. Saved in `.acoord` format

### Delete Bond

**Remove specific bond:**

1. Select bonded atoms
2. Use **Delete Bond** command
3. Bond is removed
4. May auto-recreate if atoms are close

## Bond Analysis

### Bond Statistics

For selected atoms:

- **Min distance:** Shortest bond
- **Max distance:** Longest bond
- **Average:** Mean bond length
- **Count:** Number of bonds

### Coordination Number

**Count neighbors:**

1. Select central atom
2. View coordination in panel
3. Lists all bonded neighbors

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
| B | Toggle bonds |
| Shift+click | Select 2 atoms for measurement |
| M | Enter measurement mode |

## Next Steps

- [Atom Selection](/features/atom-selection) — Select atoms to measure
- [3D Visualization](/features/3d-visualization) — View bonds in 3D
- [Unit Cell](/features/unit-cell) — Periodic bonding
