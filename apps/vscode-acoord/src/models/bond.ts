import { DEFAULT_BOND_RADIUS } from '../config/defaults.js';

export interface BondOptions {
  radius?: number;
  color?: string;
}

export class Bond {
  id: string;
  atomId1: string;
  atomId2: string;
  radius: number;
  color?: string;

  constructor(
    atomId1: string,
    atomId2: string,
    id?: string,
    options?: BondOptions
  ) {
    const [a, b] = Bond.normalizePair(atomId1, atomId2);
    this.id = id || `bond_${crypto.randomUUID()}`;
    this.atomId1 = a;
    this.atomId2 = b;
    this.radius = options?.radius ?? DEFAULT_BOND_RADIUS;
    this.color = options?.color;
  }

  static normalizePair(atomId1: string, atomId2: string): [string, string] {
    return atomId1 < atomId2 ? [atomId1, atomId2] : [atomId2, atomId1];
  }

  clone(): Bond {
    return new Bond(this.atomId1, this.atomId2, this.id, {
      radius: this.radius,
      color: this.color,
    });
  }

  toJSON(): {
    id: string;
    atomId1: string;
    atomId2: string;
    radius: number;
    color?: string;
  } {
    return {
      id: this.id,
      atomId1: this.atomId1,
      atomId2: this.atomId2,
      radius: this.radius,
      color: this.color,
    };
  }
}
