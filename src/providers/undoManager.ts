import { Structure } from '../models/structure';

const MAX_ATOMS_FOR_UNDO = 5000;
const MAX_MEMORY_MB = 100;
const ESTIMATED_BYTES_PER_ATOM = 200;

export class UndoManager {
  private readonly stack: Structure[] = [];
  private readonly maxDepth: number;
  private readonly maxAtoms: number;
  private warnedAboutSize = false;

  constructor(maxDepth: number = 100, maxAtoms: number = MAX_ATOMS_FOR_UNDO) {
    this.maxDepth = maxDepth;
    this.maxAtoms = maxAtoms;
  }

  private estimateMemoryUsage(structure: Structure): number {
    return structure.atoms.length * ESTIMATED_BYTES_PER_ATOM;
  }

  private canAffordUndo(structure: Structure): boolean {
    const atomCount = structure.atoms.length;
    if (atomCount > this.maxAtoms) {
      if (!this.warnedAboutSize) {
        console.warn(
          `UndoManager: Structure has ${atomCount} atoms (max: ${this.maxAtoms}). ` +
          `Undo disabled for this edit to prevent memory issues.`
        );
        this.warnedAboutSize = true;
      }
      return false;
    }

    const currentMemory = this.stack.reduce(
      (sum, s) => sum + this.estimateMemoryUsage(s),
      0
    );
    const newMemory = this.estimateMemoryUsage(structure);
    const maxMemoryBytes = MAX_MEMORY_MB * 1024 * 1024;
    
    if (currentMemory + newMemory > maxMemoryBytes) {
      while (
        this.stack.length > 0 &&
        currentMemory + newMemory > maxMemoryBytes
      ) {
        const removed = this.stack.shift()!;
        const removedMemory = this.estimateMemoryUsage(removed);
      }
    }

    return true;
  }

  push(structure: Structure): void {
    if (!this.canAffordUndo(structure)) {
      return;
    }
    this.stack.push(structure.clone());
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }
  }

  pop(): Structure | null {
    return this.stack.pop() ?? null;
  }

  clear(): void {
    this.stack.length = 0;
    this.warnedAboutSize = false;
  }

  get isEmpty(): boolean {
    return this.stack.length === 0;
  }

  get depth(): number {
    return this.stack.length;
  }

  get estimatedMemoryMB(): number {
    const bytes = this.stack.reduce(
      (sum, s) => sum + this.estimateMemoryUsage(s),
      0
    );
    return bytes / (1024 * 1024);
  }
}
