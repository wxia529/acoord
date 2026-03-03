import { Structure } from '../models/structure';

/**
 * Manages the undo stack for a single open document.
 * Each snapshot is a full clone of the structure at the time an edit begins.
 */
export class UndoManager {
  private readonly stack: Structure[] = [];

  constructor(private readonly maxDepth: number = 100) {}

  /** Push a deep clone of `structure` onto the stack before an edit. */
  push(structure: Structure): void {
    this.stack.push(structure.clone());
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }
  }

  /** Pop and return the most recent snapshot, or `null` if the stack is empty. */
  pop(): Structure | null {
    return this.stack.pop() ?? null;
  }

  /** Discard all stored snapshots (e.g. after a trajectory frame change). */
  clear(): void {
    this.stack.length = 0;
  }

  get isEmpty(): boolean {
    return this.stack.length === 0;
  }
}
