# Supported File Formats

ACoord supports 15+ file formats for reading and writing atomic structures.

## Format Overview

| Format | Read | Write | Extensions | Description |
|--------|------|-------|------------|-------------|
| XYZ | ✅ | ✅ | `.xyz` | Simple atomic coordinates |
| CIF | ✅ | ✅ | `.cif` | Crystallographic Information File |
| POSCAR | ✅ | ✅ | `POSCAR`, `CONTCAR`, `.vasp`, `.poscar` | VASP input structure |
| XDATCAR | ✅ | ❌ | `XDATCAR`, `.xdatcar` | VASP MD trajectory |
| OUTCAR | ✅ | ❌ | `OUTCAR`, `.outcar` | VASP output file |
| PDB | ✅ | ✅ | `.pdb` | Protein Data Bank |
| Gaussian | ✅ | ✅ | `.gjf`, `.com` | Gaussian input |
| ORCA | ✅ | ✅ | `.inp` | ORCA input |
| Quantum ESPRESSO | ✅ | ✅ | `.in`, `.pwi` | QE input |
| QE Output | ✅ | ❌ | `.out`, `.pwo`, `.log` | QE output |
| ABACUS | ✅ | ✅ | `.stru` | ABACUS STRU |
| CASTEP Cell | ✅ | ✅ | `.cell` | CASTEP input structure |
| CASTEP Output | ✅ | ❌ | `.castep` | CASTEP output file |
| SIESTA fdf | ✅ | ✅ | `.fdf` | SIESTA input structure |
| ACoord Native | ✅ | ✅ | `.acoord` | Native format with full metadata |

## Format Details

### XYZ Format

The simplest format for atomic coordinates.

```
14
Benzene molecule
C     0.000    1.400    0.000
C     1.212    0.700    0.000
C     1.212   -0.700    0.000
...
```

**Support:**
- ✅ Atom positions
- ✅ Element types
- ✅ Comments
- ❌ Unit cell
- ❌ Bonds

### CIF Format

Crystallographic Information File for crystal structures.

**Support:**
- ✅ Atom positions (fractional and Cartesian)
- ✅ Unit cell parameters
- ✅ Space group symmetry operations (applied automatically on read)
- ✅ Atom labels and types

**Limitations:**
- ❌ Export always uses P 1 space group (symmetry-expanded atoms)

### VASP Formats

#### POSCAR/CONTCAR

```
Si crystal
1.0
5.43 0.0 0.0
0.0 5.43 0.0
0.0 0.0 5.43
Si
2
Direct
0.00 0.00 0.00
0.25 0.25 0.25
```

**Support:**
- ✅ Atom positions (Direct/Cartesian)
- ✅ Unit cell vectors
- ✅ Selective dynamics
- ✅ Multiple atom types

#### XDATCAR

Molecular dynamics trajectory format.

**Support:**
- ✅ Multiple frames (trajectory)
- ✅ Frame-by-frame navigation
- ✅ Animation playback
- ❌ Writing (export individual frames as POSCAR)

#### OUTCAR

VASP output file with structure information.

**Support:**
- ✅ Final structure extraction
- ✅ Multiple ionic steps
- ✅ Force information (display only)

### PDB Format

Protein Data Bank format for biomolecules.

**Support:**
- ✅ ATOM records
- ✅ HETATM records
- ✅ CRYST1 unit cell
- ✅ Element detection
- ❌ CONECT bonds (not parsed)

### Gaussian Input

Quantum chemistry input files.

**Support:**
- ✅ Atom coordinates
- ✅ Charge and multiplicity
- ✅ TV lattice vectors (for periodic systems)
- ✅ Format preservation (headers, route section preserved on save)

### Quantum ESPRESSO

**Support:**
- ✅ `pw.x` input format
- ✅ Cell parameters
- ✅ Atomic positions
- ✅ Output file parsing (final structure)

### ABACUS STRU

**Support:**
- ✅ Atom types and positions
- ✅ Unit cell
- ✅ Numerical orbital info

### CASTEP Formats

#### CASTEP Cell (.cell)

CASTEP input structure file.

**Support:**
- ✅ LATTICE_CART and LATTICE_ABC blocks
- ✅ POSITIONS_ABS (Cartesian) and POSITIONS_FRAC (fractional)
- ✅ Custom species notation (e.g., Fe:1, O:custom)
- ✅ IONIC_CONSTRAINTS mapping to selective dynamics
- ✅ SPIN, LABEL, SPECIES_MASS metadata
- ✅ Unit conversion (bohr, nm, pm, cm, m)
- ✅ Round-trip serialization preserving all metadata

#### CASTEP Output (.castep)

CASTEP output file from geometry optimization or MD runs.

**Support:**
- ✅ Lattice extraction from "Unit Cell" block
- ✅ Atomic positions from "Fractional coordinates of atoms"
- ✅ Trajectory extraction from BFGS and MD iterations
- ❌ Writing (export as .cell format)

### SIESTA fdf Format

SIESTA input file format with calculation parameters.

```fdf
SystemName          Water
SystemLabel         H2O

NumberOfAtoms       3
NumberOfSpecies     2

%block ChemicalSpeciesLabel
  1  8   O
  2  1   H
%endblock ChemicalSpeciesLabel

%block LatticeVectors
  15.0   0.0   0.0
  0.0   15.0   0.0
  0.0    0.0  15.0
%endblock LatticeVectors

AtomicCoordinatesFormat  Fractional

%block AtomicCoordinatesAndAtomicSpecies
  0.5   0.5   0.5   1
  0.5375   0.5   0.675   2
  0.4625   0.5   0.675   2
%endblock AtomicCoordinatesAndAtomicSpecies

# SIESTA calculation parameters
XC.functional          GGA
XC.authors             PBE
Mesh.Cutoff            300.0 Ry
kgrid_Monkhorst_Pack    1  1  1
```

**Support:**
- ✅ `%block LatticeVectors` - unit cell vectors
- ✅ `%block AtomicCoordinatesAndAtomicSpecies` - atomic positions and species
- ✅ `%block ChemicalSpeciesLabel` - element mapping
- ✅ Calculation parameters (XC.functional, Mesh.Cutoff, kgrid, etc.)
- ✅ Automatic update of `NumberOfAtoms` and `NumberOfSpecies` on edit
- ✅ Format preservation (all non-block parameters preserved on save)
- ❌ Selective Dynamics (per-atom fixed flags)
- ❌ Trajectory parsing (multi-frame)

### ACoord Native (.acoord)

Native JSON format preserving all information.

```json
{
  "atoms": [
    {
      "id": "atom_abc123",
      "element": "C",
      "x": 0.0,
      "y": 1.4,
      "z": 0.0,
      "color": "#909090",
      "radius": 0.77
    }
  ],
  "bonds": [...],
  "unitCell": {...},
  "metadata": {...}
}
```

**Advantages:**
- ✅ Preserves all edits (colors, radii, labels)
- ✅ Fast read/write
- ✅ Human-readable JSON
- ✅ Full fidelity round-trip

## Format Detection

ACoord automatically detects file formats by:

1. **File extension** (e.g., `.cif`, `.xyz`)
2. **Filename pattern** (e.g., `POSCAR`, `XDATCAR`)
3. **Content analysis** (for ambiguous cases)

## Tips

### Converting Between Formats

1. Open a file in ACoord
2. Click **Save As** button in the toolbar
3. Choose the target format
4. Save the converted file

### Trajectory Files

For trajectory files like XDATCAR:
- Use the timeline slider to navigate frames
- Press Play to animate
- Export individual frames as POSCAR or XYZ

### Best Practices

- Use `.acoord` for working projects (preserves edits)
- Use CIF for crystal structures (standard format)
- Use XYZ for simple molecules (universal compatibility)
- Use PDB for biomolecules (standard in structural biology)
- Use SIESTA fdf for SIESTA DFT calculations
