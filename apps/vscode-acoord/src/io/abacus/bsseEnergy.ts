/**
 * Energy bookkeeping for the counterpoise (BSSE) workflow.
 *
 * ABACUS prints the converged SCF energy as
 *
 *     !FINAL_ETOT_IS  -466.1225988772539 eV
 *
 * which is what the BSSE correction needs (per-fragment single points in the
 * full basis).  These helpers read that value and combine the numbers into the
 * corrected interaction energy.
 */

export interface AbacusEnergyReading {
  /** Calculation label, e.g. `STRU_0` or a fragment name. */
  label: string;
  /** Total energy in eV. */
  energy: number;
  /** File the value was read from. */
  source: string;
}

export interface BsseEnergyResult {
  reference?: AbacusEnergyReading;
  fragments: AbacusEnergyReading[];
  /** Sum of the fragment energies (0 when no fragment was found). */
  fragmentSum: number;
  /** E_total - sum(E_fragment); undefined without a reference energy. */
  corrected?: number;
  /** Labels whose energy could not be found. */
  missing: string[];
}

const ENERGY_PATTERNS: RegExp[] = [
  /!FINAL_ETOT_IS\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
  /final\s+etot\s+is\s*[:=]?\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/i,
];

/**
 * Extract the last converged total energy (eV) from an ABACUS log.
 *
 * Returns `undefined` when the log has no `!FINAL_ETOT_IS` line yet.
 */
export function parseAbacusTotalEnergy(content: string): number | undefined {
  for (const pattern of ENERGY_PATTERNS) {
    const matches = Array.from(content.matchAll(new RegExp(pattern.source, 'gi')));
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const value = Number(matches[i][1]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return undefined;
}

/** Combine the reference energy and the per-fragment energies. */
export function computeCounterpoise(
  reference: AbacusEnergyReading | undefined,
  fragments: AbacusEnergyReading[]
): BsseEnergyResult {
  const fragmentSum = fragments.reduce((sum, reading) => sum + reading.energy, 0);
  const result: BsseEnergyResult = {
    fragments,
    fragmentSum,
    missing: [],
  };
  if (reference) {
    result.reference = reference;
    result.corrected = reference.energy - fragmentSum;
  }
  return result;
}

/** Markdown report written next to the calculation set. */
export function buildBsseResultMarkdown(
  result: BsseEnergyResult,
  options?: { title?: string; missing?: string[] }
): string {
  const lines: string[] = [];
  lines.push('# BSSE counterpoise result');
  lines.push('');
  if (options?.title) {
    lines.push(`_${options.title}_`);
    lines.push('');
  }
  lines.push('| calculation | energy (eV) | source |');
  lines.push('| --- | ---: | --- |');
  if (result.reference) {
    lines.push(
      `| ${result.reference.label} (full system) | ${formatEnergy(result.reference.energy)} | ${result.reference.source} |`
    );
  }
  for (const reading of result.fragments) {
    lines.push(`| ${reading.label} | ${formatEnergy(reading.energy)} | ${reading.source} |`);
  }
  lines.push('');
  if (result.reference) {
    lines.push(`Sum of fragments: **${formatEnergy(result.fragmentSum)} eV**`);
    lines.push('');
    lines.push('```text');
    lines.push('E_BSSE = E_total - sum_i E_i');
    lines.push('```');
    lines.push('');
    if (result.corrected !== undefined) {
      lines.push(`**BSSE-corrected energy: ${formatEnergy(result.corrected)} eV**`);
    }
  } else {
    lines.push('> No reference (full-system) energy was found, so the sum could not be');
    lines.push('> corrected. Run `STRU_0` as well, or select the correct folder.');
  }
  const missing = options?.missing ?? result.missing;
  if (missing.length > 0) {
    lines.push('');
    lines.push(`Missing energies: ${missing.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatEnergy(value: number): string {
  return value.toFixed(10);
}
