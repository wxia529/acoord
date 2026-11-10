/**
 * ABACUS calculation presets (SCF, geometry optimisation, variable-cell
 * optimisation, molecular dynamics).
 *
 * These helpers only *adjust* an `AbacusInput` document: parameters that are
 * irrelevant for the selected task are removed and the ones that are required
 * are added with sensible defaults plus an explanatory comment.  Everything
 * else in the user's INPUT file is preserved.
 */

import { AbacusInput } from './abacusInput.js';

export type AbacusCalculationKind = 'scf' | 'relax' | 'cell-relax' | 'md';

export type AbacusRelaxMethod = 'cg' | 'bfgs' | 'sd';

export type AbacusBasisType = 'lcao' | 'pw';

export interface AbacusCalculationOptions {
  kind: AbacusCalculationKind;
  ecutwfc?: number;
  basisType?: AbacusBasisType;
  relaxNmax?: number;
  relaxMethod?: AbacusRelaxMethod;
  forceThrEv?: number;
  stressThrKbar?: number;
  mdNstep?: number;
  mdDt?: number;
  mdTemperature?: number;
}

export const DEFAULT_CALCULATION_DEFAULTS = {
  ecutwfc: 60,
  basisType: 'lcao' as AbacusBasisType,
  scfNmax: 100,
  scfThr: 1e-6,
  relaxNmax: 100,
  relaxMethod: 'cg' as AbacusRelaxMethod,
  forceThrEv: 0.01,
  stressThrKbar: 0.5,
  mdNstep: 100,
  mdDt: 1,
};

export const CALCULATION_LABELS: Record<AbacusCalculationKind, string> = {
  scf: 'SCF single point (calculation scf)',
  relax: 'Geometry optimisation, fixed cell (calculation relax)',
  'cell-relax': 'Variable-cell optimisation (calculation cell-relax)',
  md: 'Molecular dynamics (calculation md)',
};

/** Fresh INPUT document with ACoord defaults for molecular / small-cell runs. */
export function createDefaultInput(options: AbacusCalculationOptions): AbacusInput {
  const input = AbacusInput.create();
  input.set('calculation', options.kind, 'scf | relax | cell-relax | md');
  input.set('ecutwfc', options.ecutwfc ?? DEFAULT_CALCULATION_DEFAULTS.ecutwfc, 'plane-wave cutoff (Ry), converge this value');
  input.set('basis_type', options.basisType ?? DEFAULT_CALCULATION_DEFAULTS.basisType, 'lcao: numerical orbitals, pw: plane waves');
  input.set('scf_nmax', DEFAULT_CALCULATION_DEFAULTS.scfNmax);
  input.set('scf_thr', DEFAULT_CALCULATION_DEFAULTS.scfThr);
  input.set('smearing_method', 'gauss');
  input.set('smearing_sigma', 0.015);
  input.set('gamma_only', 1, 'only the Gamma point; ABACUS regenerates KPT automatically');
  return applyCalculationPreset(input, options);
}

/**
 * Apply a calculation preset to `input` (in place) and return it.
 *
 * `scf` removes relaxation keywords, `relax` fixes the cell, `cell-relax` also
 * relaxes the lattice vectors, and `md` switches to Born-Oppenheimer MD.
 */
export function applyCalculationPreset(
  input: AbacusInput,
  options: AbacusCalculationOptions
): AbacusInput {
  const kind = options.kind;
  input.set('calculation', kind, 'scf | relax | cell-relax | md');
  if (options.ecutwfc !== undefined) {
    input.set('ecutwfc', options.ecutwfc);
  }
  if (options.basisType !== undefined) {
    input.set('basis_type', options.basisType);
  }

  if (kind === 'scf') {
    input.remove('relax_nmax');
    input.remove('relax_method');
    input.remove('stress_thr');
    input.remove('md_nstep');
    input.remove('md_dt');
    input.set('cal_force', 0, 'forces are not needed for a single-point energy');
    input.set('cal_stress', 0, 'stress is not needed for a single-point energy');
    return input;
  }

  if (kind === 'relax' || kind === 'cell-relax') {
    input.set('cal_force', 1, 'forces are required by the optimiser');
    input.set('relax_nmax', options.relaxNmax ?? DEFAULT_CALCULATION_DEFAULTS.relaxNmax, 'maximum number of ionic steps');
    input.set('relax_method', options.relaxMethod ?? DEFAULT_CALCULATION_DEFAULTS.relaxMethod, 'cg | bfgs | sd');
    input.set('force_thr_ev', options.forceThrEv ?? DEFAULT_CALCULATION_DEFAULTS.forceThrEv, 'force convergence threshold (eV/Angstrom)');
    input.remove('md_nstep');
    input.remove('md_dt');
    if (kind === 'cell-relax') {
      input.set('cal_stress', 1, 'stress is required to relax the lattice vectors');
      input.set('stress_thr', options.stressThrKbar ?? DEFAULT_CALCULATION_DEFAULTS.stressThrKbar, 'stress convergence threshold (kbar)');
    } else {
      // Fixed-cell relaxation: keep the cell exactly as given in STRU.
      input.set('cal_stress', 0, 'fixed cell in a relax calculation');
      input.remove('stress_thr');
      input.remove('latname');
    }
    return input;
  }

  input.set('cal_force', 1, 'forces are required by the MD propagator');
  input.set('md_nstep', options.mdNstep ?? DEFAULT_CALCULATION_DEFAULTS.mdNstep, 'number of MD steps');
  input.set('md_dt', options.mdDt ?? DEFAULT_CALCULATION_DEFAULTS.mdDt, 'MD time step (fs)');
  if (options.mdTemperature !== undefined) {
    input.set('md_tfirst', options.mdTemperature, 'initial temperature (K)');
  }
  input.remove('relax_nmax');
  input.remove('relax_method');
  input.remove('stress_thr');
  return input;
}

/** Human readable one-line description, used in generated README files. */
export function describeCalculation(kind: AbacusCalculationKind): string {
  switch (kind) {
    case 'scf':
      return 'single-point SCF energy';
    case 'relax':
      return 'ionic relaxation with a fixed unit cell';
    case 'cell-relax':
      return 'simultaneous ionic and lattice (variable-cell) relaxation';
    case 'md':
      return 'Born-Oppenheimer molecular dynamics';
  }
}

/** Gamma-only KPT file content (ABACUS regenerates KPT when gamma_only = 1). */
export function buildGammaOnlyKpt(): string {
  return ['K_POINTS', '0', 'Gamma', '1 1 1 0 0 0', ''].join('\n');
}
