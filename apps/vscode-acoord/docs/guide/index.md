# Introduction

Welcome to **ACoord** — Atomic Coordinate Toolkit for VS Code.

ACoord is a powerful extension for visualizing and editing atomic, molecular, and crystal structures directly within Visual Studio Code.

## What is ACoord?

ACoord provides:

- 🎨 **Interactive 3D Visualization** — Render atomic structures with full rotation, zoom, and pan controls
- 📁 **Multi-Format Support** — Open and save 12+ file formats including CIF, XYZ, POSCAR, XDATCAR, PDB, and more
- ✏️ **Full Editing Capabilities** — Add, delete, move atoms; create and measure bonds; edit unit cells
- 🎬 **Trajectory Visualization** — Animate molecular dynamics trajectories from simulation output files
- 🎯 **Precise Selection** — Select individual atoms or use box selection for complex structures
- 🎨 **Customizable Display** — Color schemes, atom sizes, bond styles, and lighting controls

## Quick Example

Open any supported structure file (e.g., `.cif`, `.xyz`, `POSCAR`) in VS Code, and ACoord will offer to open it in the 3D Structure Editor.

## Supported File Formats

| Format | Extensions | Description |
|--------|------------|-------------|
| XYZ | `.xyz` | Simple atomic coordinates |
| CIF | `.cif` | Crystallographic Information File |
| VASP | `POSCAR`, `CONTCAR`, `.vasp` | VASP input/output structures |
| VASP Trajectory | `XDATCAR` | VASP molecular dynamics trajectories |
| VASP Output | `OUTCAR` | VASP output with structure data |
| PDB | `.pdb` | Protein Data Bank format |
| Gaussian | `.gjf`, `.com` | Gaussian input files |
| ORCA | `.inp` | ORCA input files |
| Quantum ESPRESSO | `.in`, `.pwi`, `.out`, `.pwo`, `.log` | QE input and output files |
| ABACUS | `.stru` | ABACUS STRU format |
| ACoord Native | `.acoord` | Native format with full metadata |

## Next Steps

- [Getting Started](/guide/getting-started) — Install and open your first structure
- [Installation](/guide/installation) — Detailed installation instructions
- [File Formats](/guide/file-formats) — Complete format reference
