# ABACUS BSSE and Optimisation Workflows

ACoord understands ABACUS "empty" atoms and can generate the complete input set
for a counterpoise (BSSE) correction or a geometry / variable-cell relaxation.

> 中文速查：`ACoord: Generate BSSE (Counterpoise) Set` 一键生成 BSSE 计算目录；
> `ACoord: Collect BSSE Energies` 汇总能量并写出 `bsse_result.md`；
> `ACoord: Generate ABACUS INPUT (SCF / Relax / Cell-Relax)` 生成几何优化 / 变胞优化
> 的 `INPUT`；空原子写作 `X_empty`，在 3D 视图中显示为半透明线框球。

## Empty (ghost) atoms

ABACUS defines an empty atom by an `empty` suffix on the species label:

```text
ATOMIC_SPECIES
H_empty   1.008   H_ONCV_PBE-1.0.upf
O         15.9994 O_ONCV_PBE-1.0.upf

ATOMIC_POSITIONS
Cartesian
H_empty
0.5
2
  0.9584  0.0000  0.0000  0 0 0
 -0.2392  0.9281  0.0000  0 0 0

O
0.5
1
  0.0000  0.0000  0.0000  0 0 0
```

Such an atom contributes its basis functions to the Hamiltonian but no ionic
potential. ACoord

- parses `X_empty`, `X_empty_2`, ... as ghost atoms (element `X`, role `ghost`),
- keeps the original label on save, including numbered variants,
- writes `X_empty` for any atom you mark as a ghost in the editor,
- reuses the mass and pseudopotential of the parent element row, so the empty
  centre really carries the same basis,
- renders empty centres as translucent wireframe shells with their `X_empty`
  label, and excludes them from bond detection and from `move` flags.

Saving a file that already contains empty species round-trips the species rows,
orbital rows, and `ntype`-relevant block order unchanged.

## Generate a BSSE (counterpoise) set

1. Open a structure — **any** format ACoord can read: `STRU` (whatever the file
   is called), `xyz`, `cif`, `POSCAR`/`vasp`, `pdb`, `fdf` (SIESTA), `cell`,
   `gjf`/`com` (Gaussian), `in`/`pwi` (QE), `inp` (ORCA), `dat` (OpenMX),
   `.acoord`. Not a STRU yet? ACoord converts it: the BSSE set it writes is
   always ABACUS `STRU_i` + `INPUT_i`.
2. Run **ACoord: Generate BSSE (Counterpoise) Set** — or click the **BSSE**
   button in the editor title bar, which now appears on every supported
   structure file (it is also in the right-click menu).
3. Choose how fragments are defined:

   | Mode | Fragment = | Typical use |
   | --- | --- | --- |
   | Molecules / connected fragments | one bonded molecule | molecular complexes, adsorption |
   | One fragment per element | one element | simple sanity checks |
   | One fragment per atom | one atom | same as the ABACUS water example |
   | Pick the fragments by hand | the atoms you select | any grouping the automatic modes get wrong |
   | One fragment per species label | one `ATOMIC_SPECIES` label | fragments written into the file, e.g. `O_water` / `Cu_surf` |

4. Accept the output folder, `ecutwfc`, and `basis_type` (defaults come from the
   `INPUT` in the same folder when it exists).

The generated folder contains:

```text
STRU_0  INPUT_0     full system                        (E_total)
STRU_1  INPUT_1     fragment 1 + empty basis of the rest
...
run_bsse.sh         one single point per calculation, energies -> energies.txt
bsse_index.json     machine readable mapping (index, ntype, species)
README_bsse.md      what was generated, with the formula
KPT                 Gamma-only KPT (when gamma_only = 1)
```

Every `INPUT_i` has an explicit `ntype` matching its `STRU_i`, so the runs are
self-contained and no manual editing is needed.

### Non-STRU sources

`STRU` is only the *output* format — the input can be any structure file:

| Source | What ACoord does |
| --- | --- |
| `STRU` (any file name) | pseudopotential and orbital rows are copied from the file, so `X_empty` reuses exactly the same basis |
| `xyz`, `pdb`, `gjf`, `inp` (no cell) | a cubic box with 15 Å of vacuum is added around the molecule, because ABACUS needs `LATTICE_VECTORS` |
| `cif`, `POSCAR`, `cell`, `fdf` (periodic) | lattice vectors are taken over unchanged — check that the vacuum layer is thick enough for an isolated molecule |
| `.acoord` | everything stored in the ACoord file is used as-is |

For a non-STRU source there is no pseudopotential information inside the file, so
`ATOMIC_SPECIES` / `NUMERICAL_ORBITAL` are filled with ACoord's defaults. Ghost
and real atoms always get the *same* row, so the correction itself is still
consistent, but before submitting the jobs please confirm the file names (and
`pseudo_dir` / `orbital_dir` in `INPUT`) exist in your pseudopotential library.
The folder is also written with an `INPUT` template when one already exists in
the source directory, which keeps `pseudo_dir` from your earlier runs.

Run them on your cluster:

```bash
ABACUS=/path/to/abacus bash run_bsse.sh
# or copy the folder and run: abacus > log.txt   inside each calc_<i>/
```

Then run **ACoord: Collect BSSE Energies**, pick the folder, and ACoord reads
`energies.txt` (or `calc_<i>/log.txt`, `OUT.*/running_scf.log`) and writes
`bsse_result.md`:

```text
E_BSSE = E_total - sum_i E_i
```

The value is printed both in the report and in a notification.

### Defining the fragments yourself

Three levels of control, from least to most explicit:

1. **Separate the molecules.** In the `molecule` mode fragments are the connected
   components of the bond graph, so two molecules that are not bonded to each
   other automatically become two fragments. Break the connection in the 3D
   editor and the grouping follows your geometry.
2. **Label the groups in the `STRU`.** `ATOMIC_SPECIES` labels are free-form, and
   ABACUS only uses the element in front of the first underscore, so

   ```text
   ATOMIC_SPECIES
   O_water  15.999  O_ONCV_PBE-1.0.upf
   H_water   1.008  H_ONCV_PBE-1.0.upf
   Cu_surf  63.546  Cu_ONCV_PBE-1.0.upf
   ```

   defines exactly three fragments in the `One fragment per species label` mode:
   the water oxygen, the two water hydrogens and the two surface copper atoms.
   Every atom keeps its own pseudopotential and orbital row, and the generated
   ghosts are named after their parent (`H_water_empty`, `Cu_surf_empty`) so the
   basis stays identical. Labels are preserved when ACoord saves the file, and
   files that only use element labels keep working unchanged.
3. **Pick the atoms in the window.** The `Pick the fragments by hand` mode lists
   the real atoms with their coordinates (`#3  H   0.531, 0.500, 0.540`); tick the
   atoms of fragment 1, then fragment 2, and so on. The last fragment takes the
   remaining atoms, so nothing can be left out. The group names default to the
   composition (`H2O`, `Cu2`), which is also what the README reports.

A ready-to-read result of option 2 is in the repository examples:
`STRU_water_on_Cu` plus the generated `STRU_0..3` / `INPUT_0..3`, where
`STRU_1` keeps the water oxygen real and turns the two hydrogens and the two
copper atoms into `H_water_empty` / `Cu_surf_empty`.

## Generate an INPUT for relaxation

1. Open the structure you want to optimise.
2. Run **ACoord: Generate ABACUS INPUT (SCF / Relax / Cell-Relax)** (the
   **ABACUS INPUT** button in the editor title bar, or the right-click menu).
3. Pick the task:

   | Task | `calculation` | Keywords written |
   | --- | --- | --- |
   | SCF single point | `scf` | `cal_force 0`, `cal_stress 0` |
   | Geometry optimisation (fixed cell) | `relax` | `cal_force 1`, `relax_nmax`, `relax_method`, `force_thr_ev` |
   | Variable-cell optimisation | `cell-relax` | the above plus `cal_stress 1`, `stress_thr` |
   | Molecular dynamics | `md` | `cal_force 1`, `md_nstep`, `md_dt` |

4. Answer `ecutwfc`, `basis_type`, and the relax thresholds (`relax_nmax`,
   `relax_method` = `cg`/`bfgs`/`sd`, `force_thr_ev`, and for `cell-relax`
   `stress_thr` in kbar).

An existing `INPUT` in the same folder is used as the template, so `pseudo_dir`,
`orbital_dir`, smearing, and every other parameter you already tuned are kept.
The command only adds/removes the keywords that belong to the selected task.

If atoms are marked as fixed in the editor, ACoord offers to write them into
`STRU` as `0 0 0` move flags — the same flags a relaxation reads.

### Tips

- `relax` keeps the `STRU` lattice fixed; use `cell-relax` when the cell itself
  must relax (it requires `cal_stress 1`).
- Empty centres are never written with moving flags, and are ignored by bond
  detection, so a BSSE structure can be relaxed safely.
- For BSSE, all fragment calculations **must** use the same `ecutwfc`,
  `basis_type`, pseudopotentials, and box size; the generated set guarantees it.
- Converge `ecutwfc` before trusting the absolute numbers: the correction is a
  small difference of large energies.
