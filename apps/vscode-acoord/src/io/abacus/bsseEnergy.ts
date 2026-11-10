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
  /** Sum of the finite fragment energies (0 when none were usable). */
  fragmentSum: number;
  /**
   * E_total - sum(E_fragment).
   * Omitted when any required complex or fragment energy is missing or not finite.
   */
  corrected?: number;
  /** Labels whose energy is missing or not finite. */
  missing: string[];
  /**
   * Why `corrected` was not computed. Names every missing or non-finite calculation.
   */
  error?: string;
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

/**
 * Combine the complex (full-system) energy and the per-fragment energies.
 *
 * `corrected` is set only when every required energy is present and finite.
 * Otherwise the result is invalid: `corrected` is omitted and `error` names
 * the calculations that are missing or not finite.
 *
 * @param reference - Full-system energy, when it was read successfully.
 * @param fragments - Fragment energies that were read.
 * @param missingLabels - Required calculations whose energy was not found.
 */
export function computeCounterpoise(
  reference: AbacusEnergyReading | undefined,
  fragments: AbacusEnergyReading[],
  missingLabels: readonly string[] = []
): BsseEnergyResult {
  const missing = dedupeLabels(missingLabels);
  const nonFinite: string[] = [];
  const seen = new Set(missing);

  const noteNonFinite = (reading: AbacusEnergyReading): void => {
    if (Number.isFinite(reading.energy) || seen.has(reading.label)) {
      return;
    }
    seen.add(reading.label);
    nonFinite.push(reading.label);
  };

  if (reference) {
    noteNonFinite(reference);
  }
  for (const fragment of fragments) {
    noteNonFinite(fragment);
  }

  let fragmentSum = 0;
  for (const fragment of fragments) {
    if (Number.isFinite(fragment.energy)) {
      fragmentSum += fragment.energy;
    }
  }

  const result: BsseEnergyResult = {
    fragments,
    fragmentSum,
    missing: dedupeLabels([...missing, ...nonFinite]),
  };

  if (
    reference !== undefined &&
    Number.isFinite(reference.energy) &&
    missing.length === 0 &&
    nonFinite.length === 0
  ) {
    const corrected = reference.energy - fragmentSum;
    if (Number.isFinite(corrected)) {
      result.reference = reference;
      result.corrected = corrected;
      return result;
    }
  }

  if (reference !== undefined && Number.isFinite(reference.energy)) {
    result.reference = reference;
  }
  result.error = formatBsseEnergyError(reference, missing, nonFinite);
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
  if (result.reference && Number.isFinite(result.reference.energy)) {
    lines.push(
      `| ${result.reference.label} (full system) | ${formatEnergy(result.reference.energy)} | ${result.reference.source} |`
    );
  }
  for (const reading of result.fragments) {
    const energyText = Number.isFinite(reading.energy) ? formatEnergy(reading.energy) : 'invalid';
    lines.push(`| ${reading.label} | ${energyText} | ${reading.source} |`);
  }
  lines.push('');
  const corrected = result.corrected;
  if (
    !result.error &&
    result.reference &&
    corrected !== undefined &&
    Number.isFinite(corrected)
  ) {
    lines.push(`Sum of fragments: **${formatEnergy(result.fragmentSum)} eV**`);
    lines.push('');
    lines.push('```text');
    lines.push('E_BSSE = E_total - sum_i E_i');
    lines.push('```');
    lines.push('');
    lines.push(`**BSSE-corrected energy: ${formatEnergy(corrected)} eV**`);
  } else if (result.error) {
    lines.push(`> ${result.error}`);
  } else {
    lines.push('> No reference (full-system) energy was found, so the sum could not be');
    lines.push('> corrected. Run `STRU_0` as well, or select the correct folder.');
  }
  const missing = dedupeLabels([...(options?.missing ?? []), ...result.missing]);
  if (missing.length > 0) {
    lines.push('');
    lines.push(`Missing energies: ${missing.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatBsseEnergyError(
  reference: AbacusEnergyReading | undefined,
  missing: readonly string[],
  nonFinite: readonly string[]
): string {
  const items: string[] = [];
  if (reference === undefined) {
    items.push('full system (complex)');
  }
  items.push(...missing);
  for (const label of nonFinite) {
    items.push(`${label} (not finite)`);
  }
  if (items.length === 0) {
    items.push('a required energy is missing or not finite');
  }
  return `Cannot compute a BSSE-corrected energy. Missing or invalid calculations: ${items.join(', ')}.`;
}

function dedupeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

function formatEnergy(value: number): string {
  return value.toFixed(10);
}
