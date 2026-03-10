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

1. Open **Display** panel
2. Click **Color Scheme** dropdown
3. Select a scheme (Bright, Jmol, etc.)
4. Colors update immediately

### Apply to Structure

**Apply scheme to atoms:**

1. Select color scheme
2. Click **Apply** button
3. Atom colors update
4. Changes saved in `.acoord` format

## Custom Color Schemes

### Create Custom Scheme

**Define custom colors:**

1. Open **Color Scheme** panel
2. Click **Create New Scheme**
3. Enter scheme name
4. Define colors for each element
5. Click **Save**

### Edit Element Colors

**Change element color:**

1. Open color scheme editor
2. Select element
3. Click color picker
4. Choose new color
5. Click **Apply**

### Import/Export Schemes

**Share color schemes:**

**Export:**
1. Open **Color Scheme** panel
2. Select scheme to export
3. Click **Export**
4. Save as `.json` file

**Import:**
1. Click **Import** button
2. Select `.json` file
3. Scheme added to list
4. Ready to use

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

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| C | Open color scheme panel |
| Ctrl+Shift+C | Import color scheme |

## Next Steps

- [3D Visualization](/features/3d-visualization) — View colored atoms
- [Display Settings](/features/display-settings) — Other display options
- [Editing Atoms](/tutorials/editing-atoms) — Change individual atom colors
