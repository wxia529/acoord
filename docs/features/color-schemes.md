# Color Schemes

ACoord provides customizable color schemes for atom visualization.

## Built-in Color Schemes

ACoord includes preset color schemes:

### Bright Scheme

Modern, vibrant colors:

| Element | Color |
|---------|-------|
| H | White |
| C | Gray |
| N | Blue |
| O | Red |
| ... | ... |

### Jmol Scheme

Traditional Jmol colors (CPK convention):

| Element | Color |
|---------|-------|
| H | White (#FFFFFF) |
| C | Gray (#909090) |
| N | Blue (#3050F8) |
| O | Red (#FF0D0D) |
| F, Cl | Green (#1FF01F) |
| Br | Dark Red (#A62929) |
| I | Purple (#940094) |

## Using Color Schemes

### Select Scheme

**Change color scheme:**

1. Open the **Brush** panel (color scheme dropdown)
2. Select a scheme (Bright, Jmol, or custom)
3. Colors update for the current session

### Apply to Selected Atoms

**Apply scheme colors to atoms:**

1. Select atoms (or select none to apply to all)
2. Select desired color scheme
3. Click **Apply** in the Brush panel
4. Atom colors update permanently

## Custom Color Schemes

### Save Current Colors as Scheme

1. Set up colors using element-specific overrides
2. Open the **Display** panel
3. Click **Save As...** button
4. Enter a name for the scheme
5. Scheme is saved to your user schemes

### Import/Export Schemes

**Export:**
1. Open the **Display** panel
2. Select scheme in dropdown
3. Click **Export** button
4. Save as `.json` file

**Import:**
1. Open the **Display** panel
2. Click **Import** button
3. Select `.json` file
4. Scheme added to your schemes

### Delete Custom Scheme

1. Open the **Display** panel
2. Select the custom scheme in dropdown
3. Click **Delete** button
4. Confirm deletion

## Color Scheme Format

### JSON Structure

```json
{
  "name": "My Scheme",
  "colors": {
    "H": "#FFFFFF",
    "C": "#909090",
    "N": "#3050F8",
    "O": "#FF0D0D"
  },
  "description": "Custom color scheme"
}
```

### Element Keys

Use standard element symbols:
- Single letter: `H`, `B`, `C`, `N`, `O`, `F`, ...
- Two letters: `He`, `Li`, `Be`, `Ne`, `Na`, ...

### Color Format

CSS hex colors:
- Format: `#RRGGBB`
- Example: `#FF0000` (red)
- Case insensitive: `#ff0000` = `#FF0000`

## Element Color Reference

### Common Elements

| Element | Symbol | Jmol Color | Hex |
|---------|--------|------------|-----|
| Hydrogen | H | White | #FFFFFF |
| Carbon | C | Gray | #909090 |
| Nitrogen | N | Blue | #3050F8 |
| Oxygen | O | Red | #FF0D0D |
| Fluorine | F | Green | #1FF01F |
| Chlorine | Cl | Green | #1FF01F |
| Sodium | Na | Purple | #AB5CF2 |
| Potassium | K | Purple | #8F40D4 |
| Calcium | Ca | Green | #3DFF00 |
| Iron | Fe | Orange | #E06633 |
| Copper | Cu | Orange | #C88033 |
| Zinc | Zn | Gray | #7D80B0 |

### All Elements

Full periodic table colors available in built-in schemes.

## Use Cases

### Publication Figures

**Consistent coloring:**

- Use Jmol for traditional appearance
- Use Bright for modern look
- Export high-resolution images

### Element Highlighting

**Emphasize specific elements:**

1. Create custom scheme
2. Use bright colors for target elements
3. Use muted colors for others
4. Apply and visualize

### Teaching

**Clear visualization:**

- Use high-contrast colors
- Differentiate similar elements
- Consistent scheme across figures

## Tips and Best Practices

### Color Choice

- Use conventional colors for clarity
- Ensure good contrast
- Consider colorblind accessibility

### Scheme Organization

- Use descriptive names
- Document color choices
- Keep backup of custom schemes

### Sharing

- Export schemes for collaborators
- Include scheme file with project
- Document in publications

## Troubleshooting

### Colors Not Applying

**Problem:** Colors don't change
- **Solution:** Click **Apply** after selecting scheme
- **Solution:** Ensure atoms don't have fixed colors

### Missing Element Colors

**Problem:** Element shows gray
- **Solution:** Define color for that element
- **Solution:** Use scheme with complete element coverage

### Import Errors

**Problem:** Can't import scheme
- **Solution:** Check JSON format
- **Solution:** Verify element keys are valid

## Next Steps

- [3D Visualization](/features/3d-visualization) — View colored atoms
- [Atom Selection](/features/atom-selection) — Select atoms
- [Editing Atoms](/tutorials/editing-atoms) — Change individual atom colors
