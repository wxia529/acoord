/**
 * Reader / writer for ABACUS `INPUT` files.
 *
 * An ABACUS INPUT file is a flat list of `key value` pairs below an
 * `INPUT_PARAMETERS` header.  ACoord keeps the file as an ordered list of lines
 * so comments, blank lines, and unrelated parameters survive a rewrite.  Only
 * the parameters the wizard actually changes are touched.
 */

const KEY_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/;

/** Column at which values start when a file is written from scratch. */
const KEY_COLUMN = 20;

export interface AbacusInputEntry {
  key: string;
  value: string;
  comment: string;
}

type AbacusInputLine =
  | { kind: 'entry'; entry: AbacusInputEntry }
  | { kind: 'raw'; text: string }
  | { kind: 'blank' };

/**
 * Mutable, order-preserving ABACUS INPUT document.
 */
export class AbacusInput {
  private lines: AbacusInputLine[];
  private headerPresent: boolean;

  private constructor(lines: AbacusInputLine[], headerPresent: boolean) {
    this.lines = lines;
    this.headerPresent = headerPresent;
  }

  /** Parse an existing INPUT file. */
  static parse(content: string): AbacusInput {
    const lines: AbacusInputLine[] = [];
    let headerPresent = false;
    for (const raw of content.split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (!trimmed) {
        lines.push({ kind: 'blank' });
        continue;
      }
      if (/^INPUT_PARAMETERS$/i.test(trimmed)) {
        headerPresent = true;
        lines.push({ kind: 'raw', text: 'INPUT_PARAMETERS' });
        continue;
      }
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        lines.push({ kind: 'raw', text: raw.trimEnd() });
        continue;
      }
      const entry = AbacusInput.parseEntry(trimmed);
      if (entry) {
        lines.push({ kind: 'entry', entry });
      } else {
        lines.push({ kind: 'raw', text: raw.trimEnd() });
      }
    }
    return new AbacusInput(lines, headerPresent);
  }

  /** Create an empty (header-only) INPUT document. */
  static create(): AbacusInput {
    return new AbacusInput([], false);
  }

  private static parseEntry(trimmed: string): AbacusInputEntry | null {
    const match = KEY_PATTERN.exec(trimmed);
    if (!match) {
      return null;
    }
    const key = match[1].toLowerCase();
    let rest = match[2].trim();
    let comment = '';
    const commentIndex = rest.search(/(?:^|\s)(?:#|\/\/)/);
    if (commentIndex >= 0) {
      comment = rest.slice(commentIndex).trim();
      rest = rest.slice(0, commentIndex).trim();
    }
    if (!rest) {
      return null;
    }
    return { key, value: rest, comment };
  }

  /** Value of a parameter, or `undefined` when absent. */
  get(key: string): string | undefined {
    const normalized = key.toLowerCase();
    for (const line of this.lines) {
      if (line.kind === 'entry' && line.entry.key === normalized) {
        return line.entry.value;
      }
    }
    return undefined;
  }

  /** Numeric value of a parameter, or `undefined` when absent / non-numeric. */
  getNumber(key: string): number | undefined {
    const raw = this.get(key);
    if (raw === undefined) {
      return undefined;
    }
    const value = Number(raw.split(/\s+/)[0]);
    return Number.isFinite(value) ? value : undefined;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** Set (or add) a parameter.  Existing comments are kept unless overridden. */
  set(key: string, value: string | number, comment?: string): this {
    const normalized = key.toLowerCase();
    for (const line of this.lines) {
      if (line.kind === 'entry' && line.entry.key === normalized) {
        line.entry.value = String(value);
        if (comment !== undefined) {
          line.entry.comment = comment;
        }
        return this;
      }
    }
    this.lines.push({
      kind: 'entry',
      entry: { key: normalized, value: String(value), comment: comment ?? '' },
    });
    return this;
  }

  /** Remove a parameter entirely. */
  remove(key: string): this {
    const normalized = key.toLowerCase();
    this.lines = this.lines.filter(
      (line) => !(line.kind === 'entry' && line.entry.key === normalized)
    );
    return this;
  }

  /** All parameter names in file order. */
  keys(): string[] {
    return this.lines
      .filter((line): line is { kind: 'entry'; entry: AbacusInputEntry } => line.kind === 'entry')
      .map((line) => line.entry.key);
  }

  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of this.lines) {
      if (line.kind === 'entry') {
        result[line.entry.key] = line.entry.value;
      }
    }
    return result;
  }

  clone(): AbacusInput {
    return AbacusInput.parse(this.serialize());
  }

  /** Serialise back to ABACUS INPUT text (trailing newline included). */
  serialize(): string {
    const output: string[] = [];
    if (!this.headerPresent) {
      output.push('INPUT_PARAMETERS');
    }
    for (const line of this.lines) {
      if (line.kind === 'blank') {
        output.push('');
        continue;
      }
      if (line.kind === 'raw') {
        output.push(line.text);
        continue;
      }
      const key = line.entry.key.padEnd(KEY_COLUMN, ' ');
      const comment = line.entry.comment ? `  ${line.entry.comment}` : '';
      output.push(`${key}${line.entry.value}${comment}`);
    }
    const text = output.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
    return `${text}\n`;
  }
}
