import { Atom } from './atom.js';
import { Bond, type BondOptions } from './bond.js';
import { UnitCell } from './unitCell.js';
import { ELEMENT_DATA, parseElement } from '../utils/elementData.js';
import type { BondSchemeId } from '../shared/protocol.js';
import { BOND_SCHEMES, DEFAULT_BOND_SCHEME } from '../config/bondSchemes.js';

export class Structure {
  id: string;
  name: string;
  atoms: Atom[] = [];
  private atomIndex: Map<string, Atom> = new Map();
  bonds: Bond[] = [];
  private bondIndex: Map<string, Bond> = new Map();
  periodicBondImages: Map<string, [number, number, number]> = new Map();
  unitCell?: UnitCell;
  isCrystal: boolean = false;
  supercell: [number, number, number] = [1, 1, 1];
  metadata: Map<string, unknown> = new Map();
  hasCalculatedBonds: boolean = false;

  constructor(name: string = 'Untitled', isCrystal: boolean = false) {
    this.id = `struct_${crypto.randomUUID()}`;
    this.name = name;
    this.isCrystal = isCrystal;
    if (isCrystal) {
      this.unitCell = new UnitCell();
    }
  }

  /**
   * Add an atom to the structure
   */
  addAtom(atom: Atom): void {
    this.atoms.push(atom);
    this.atomIndex.set(atom.id, atom);
  }

  /**
   * Remove an atom by ID
   */
  removeAtom(atomId: string): void {
    this.atoms = this.atoms.filter((a) => a.id !== atomId);
    this.atomIndex.delete(atomId);
    
    const bondsToRemove: string[] = [];
    for (const bond of this.bonds) {
      if (bond.atomId1 === atomId || bond.atomId2 === atomId) {
        bondsToRemove.push(Structure.bondKey(bond.atomId1, bond.atomId2));
      }
    }
    
    this.bonds = this.bonds.filter((bond) => bond.atomId1 !== atomId && bond.atomId2 !== atomId);
    
    for (const key of bondsToRemove) {
      this.periodicBondImages.delete(key);
      this.bondIndex.delete(key);
    }
  }

  static normalizeBondPair(atomId1: string, atomId2: string): [string, string] {
    return atomId1 < atomId2 ? [atomId1, atomId2] : [atomId2, atomId1];
  }

  static bondKey(atomId1: string, atomId2: string): string {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    return `${a}|${b}`;
  }

  static bondKeyToPair(key: string): [string, string] | null {
    if (!key || typeof key !== 'string') {
      return null;
    }
    const parts = key.split('|');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    return Structure.normalizeBondPair(parts[0], parts[1]);
  }

  private setBondIndex(bond: Bond): void {
    const key = Structure.bondKey(bond.atomId1, bond.atomId2);
    this.bondIndex.set(key, bond);
  }

  private rebuildBondIndex(): void {
    this.bondIndex.clear();
    for (const bond of this.bonds) {
      this.setBondIndex(bond);
    }
  }

  private addBondEntry(atomId1: string, atomId2: string, options?: BondOptions): Bond {
    const bond = new Bond(atomId1, atomId2, undefined, options);
    this.bonds.push(bond);
    this.setBondIndex(bond);
    return bond;
  }

  addBond(atomId1: string, atomId2: string, options?: BondOptions): Bond | null {
    if (!this.getAtom(atomId1) || !this.getAtom(atomId2) || atomId1 === atomId2) {
      return null;
    }
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    const key = Structure.bondKey(a, b);
    const existing = this.bondIndex.get(key);
    if (existing) {
      return existing;
    }

    const bond = this.addBondEntry(a, b, options);
    
    if (this.isCrystal && this.unitCell) {
      const atom1 = this.getAtom(a);
      const atom2 = this.getAtom(b);
      if (!atom1 || !atom2) {return bond;}
      const vectors = this.unitCell.getLatticeVectors();
      
      let minDistSq = Infinity;
      let bestImage: [number, number, number] = [0, 0, 0];
      
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const offsetX = ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0];
            const offsetY = ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1];
            const offsetZ = ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2];
            
            const dx = (atom2.x + offsetX) - atom1.x;
            const dy = (atom2.y + offsetY) - atom1.y;
            const dz = (atom2.z + offsetZ) - atom1.z;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            
            if (distanceSq < minDistSq) {
              minDistSq = distanceSq;
              bestImage = [ox, oy, oz];
            }
          }
        }
      }
      
      this.periodicBondImages.set(key, bestImage);
    }

    return bond;
  }

  removeBond(atomId1: string, atomId2: string): void {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    const key = Structure.bondKey(a, b);
    this.bonds = this.bonds.filter((bond) => !(bond.atomId1 === a && bond.atomId2 === b));
    this.bondIndex.delete(key);
    this.periodicBondImages.delete(key);
  }

  hasBond(atomId1: string, atomId2: string): boolean {
    const [a, b] = Structure.normalizeBondPair(atomId1, atomId2);
    return this.bondIndex.has(Structure.bondKey(a, b));
  }

  getBond(bondKey: string): Bond | undefined {
    return this.bondIndex.get(bondKey);
  }

  clearBonds(): void {
    this.bonds = [];
    this.bondIndex.clear();
    this.periodicBondImages.clear();
    this.hasCalculatedBonds = false;
  }

  /**
   * Get atom by ID - O(1) lookup using Map index
   */
  getAtom(atomId: string): Atom | undefined {
    return this.atomIndex.get(atomId);
  }

  /**
   * Get list of bonds based on covalent radii
   * Uses spatial hashing for O(n) performance instead of O(n²)
   */
  private static readonly BOND_TOLERANCE = 1.1; // 10% tolerance for covalent radii comparison
  private static readonly MAX_COVALENT_RADIUS = 2.5; // Maximum covalent radius in Angstroms

  private buildSpatialHash(cellSize: number): Map<string, Atom[]> {
    const grid = new Map<string, Atom[]>();
    for (const atom of this.atoms) {
      const cx = Math.floor(atom.x / cellSize);
      const cy = Math.floor(atom.y / cellSize);
      const cz = Math.floor(atom.z / cellSize);
      const key = `${cx},${cy},${cz}`;
      const cell = grid.get(key);
      if (cell) {
        cell.push(atom);
      } else {
        grid.set(key, [atom]);
      }
    }
    return grid;
  }

  private *getNeighboringAtoms(
    atom: Atom,
    grid: Map<string, Atom[]>,
    cellSize: number,
    maxDistance: number
  ): Generator<Atom> {
    const cx = Math.floor(atom.x / cellSize);
    const cy = Math.floor(atom.y / cellSize);
    const cz = Math.floor(atom.z / cellSize);
    const range = Math.ceil(maxDistance / cellSize);

    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        for (let dz = -range; dz <= range; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = grid.get(key);
          if (cell) {
            for (const other of cell) {
              if (other.id !== atom.id) {
                yield other;
              }
            }
          }
        }
      }
    }
  }

  getBonds(): Array<{ atomId1: string; atomId2: string; distance: number; radius: number; color?: string }> {
    return this.bonds
      .map((bond) => {
        const id1 = bond.atomId1;
        const id2 = bond.atomId2;
        const atom1 = this.getAtom(id1);
        const atom2 = this.getAtom(id2);
        if (!atom1 || !atom2) {return null;}
        return {
          atomId1: id1,
          atomId2: id2,
          distance: atom1.distanceTo(atom2),
          radius: bond.radius,
          color: bond.color,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }

  calculateBonds(schemeId?: BondSchemeId): void {
    const scheme = BOND_SCHEMES[schemeId ?? DEFAULT_BOND_SCHEME];
    this.bonds = [];
    this.bondIndex.clear();
    this.periodicBondImages.clear();
    this.hasCalculatedBonds = true;
    
    const seen = new Set<string>();

    const atomData = new Map<string, { symbol: string; radius: number; atomicNumber: number }>();
    for (const atom of this.atoms) {
      const symbol = parseElement(atom.element) || atom.element;
      const data = ELEMENT_DATA[symbol];
      const radius = data?.covalentRadius || 1.5;
      const atomicNumber = data?.atomicNumber || 0;
      atomData.set(atom.id, { symbol, radius, atomicNumber });
    }

    if (this.isCrystal && this.unitCell) {
      this.calculatePeriodicBonds(scheme, atomData, seen);
    } else {
      this.calculateNonPeriodicBonds(scheme, atomData, seen);
    }
  }

  private calculateNonPeriodicBonds(
    scheme: import('../config/bondSchemes.js').BondScheme,
    atomData: Map<string, { symbol: string; radius: number; atomicNumber: number }>,
    seen: Set<string>
  ): void {
    const tolerance = Structure.BOND_TOLERANCE;
    let maxBondLength = 0;
    for (const atom of this.atoms) {
      const data = atomData.get(atom.id);
      if (!data) {continue;}
      maxBondLength = Math.max(maxBondLength, data.radius * 2 * tolerance);
    }
    maxBondLength = Math.max(maxBondLength, Structure.MAX_COVALENT_RADIUS * 2);

    const cellSize = maxBondLength;
    const grid = this.buildSpatialHash(cellSize);

    for (const atom1 of this.atoms) {
      const data1 = atomData.get(atom1.id);
      if (!data1) {continue;}
      if (scheme.excludedAtomicNumbers.has(data1.atomicNumber)) {
        continue;
      }
      const radius1 = data1.radius;

      for (const atom2 of this.getNeighboringAtoms(atom1, grid, cellSize, maxBondLength)) {
        if (atom1.id >= atom2.id) {
          continue;
        }

        const data2 = atomData.get(atom2.id);
        if (!data2) {continue;}
        if (scheme.excludedAtomicNumbers.has(data2.atomicNumber)) {
          continue;
        }
        const radius2 = data2.radius;
        const bondLength = (radius1 + radius2) * tolerance;

        const dx = atom1.x - atom2.x;
        const dy = atom1.y - atom2.y;
        const dz = atom1.z - atom2.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq < bondLength * bondLength) {
          const key = Structure.bondKey(atom1.id, atom2.id);
          if (seen.has(key)) {
            continue;
          }
          this.addBondEntry(atom1.id, atom2.id);
          seen.add(key);
        }
      }
    }
  }

  private calculatePeriodicBonds(
    scheme: import('../config/bondSchemes.js').BondScheme,
    atomData: Map<string, { symbol: string; radius: number; atomicNumber: number }>,
    seen: Set<string>
  ): void {
    if (!this.unitCell) {return;}

    const tolerance = Structure.BOND_TOLERANCE;
    const vectors = this.unitCell.getLatticeVectors();

    const offsets: Array<[number, number, number]> = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          offsets.push([ox, oy, oz]);
        }
      }
    }

    for (const atom1 of this.atoms) {
      const data1 = atomData.get(atom1.id);
      if (!data1) {continue;}
      if (scheme.excludedAtomicNumbers.has(data1.atomicNumber)) {
        continue;
      }
      const radius1 = data1.radius;

      for (const atom2 of this.atoms) {
        if (atom1.id >= atom2.id) {
          continue;
        }

        const data2 = atomData.get(atom2.id);
        if (!data2) {continue;}
        if (scheme.excludedAtomicNumbers.has(data2.atomicNumber)) {
          continue;
        }
        const radius2 = data2.radius;
        const bondLength = (radius1 + radius2) * tolerance;

        let minDistSq = Infinity;
        let bestImage: [number, number, number] = [0, 0, 0];
        
        for (const [ox, oy, oz] of offsets) {
          const offsetX = ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0];
          const offsetY = ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1];
          const offsetZ = ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2];

          const dx = (atom2.x + offsetX) - atom1.x;
          const dy = (atom2.y + offsetY) - atom1.y;
          const dz = (atom2.z + offsetZ) - atom1.z;
          const distanceSq = dx * dx + dy * dy + dz * dz;

          if (distanceSq < minDistSq) {
            minDistSq = distanceSq;
            bestImage = [ox, oy, oz];
          }
        }

        if (minDistSq < bondLength * bondLength) {
          const key = Structure.bondKey(atom1.id, atom2.id);
          if (!seen.has(key)) {
            this.addBondEntry(atom1.id, atom2.id);
            this.periodicBondImages.set(key, bestImage);
            seen.add(key);
          }
        }
      }
    }
  }

  /**
   * Get center of mass
   */
  getCenterOfMass(): [number, number, number] {
    if (this.atoms.length === 0) {
      return [0, 0, 0];
    }

    let totalMass = 0;
    let cx = 0,
      cy = 0,
      cz = 0;

    for (const atom of this.atoms) {
      const symbol = parseElement(atom.element) || atom.element;
      const mass = ELEMENT_DATA[symbol]?.atomicMass || 1;
      cx += atom.x * mass;
      cy += atom.y * mass;
      cz += atom.z * mass;
      totalMass += mass;
    }

    return [cx / totalMass, cy / totalMass, cz / totalMass];
  }

  /**
   * Translate all atoms
   */
  translate(dx: number, dy: number, dz: number): void {
    for (const atom of this.atoms) {
      atom.x += dx;
      atom.y += dy;
      atom.z += dz;
    }
  }

  /**
   * Center structure at origin
   */
  centerAtOrigin(): void {
    const [cx, cy, cz] = this.getCenterOfMass();
    this.translate(-cx, -cy, -cz);
  }

  /**
   * Generate supercell
   */
  generateSupercell(nx: number, ny: number, nz: number): Structure {
    if (!this.isCrystal || !this.unitCell) {
      throw new Error('Supercell generation requires a crystal structure');
    }

    const supercell = new Structure(`${this.name}_supercell`, true);
    supercell.unitCell = new UnitCell(
      this.unitCell.a * nx,
      this.unitCell.b * ny,
      this.unitCell.c * nz,
      this.unitCell.alpha,
      this.unitCell.beta,
      this.unitCell.gamma
    );

    const latticeVectors = this.unitCell.getLatticeVectors();

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const displacement = [
            i * latticeVectors[0][0] +
              j * latticeVectors[1][0] +
              k * latticeVectors[2][0],
            i * latticeVectors[0][1] +
              j * latticeVectors[1][1] +
              k * latticeVectors[2][1],
            i * latticeVectors[0][2] +
              j * latticeVectors[1][2] +
              k * latticeVectors[2][2],
          ];

          for (const atom of this.atoms) {
            const newAtom = new Atom(atom.element, atom.x, atom.y, atom.z, undefined, {
              color: atom.color,
              radius: atom.radius,
              fixed: atom.fixed,
              selectiveDynamics: atom.selectiveDynamics,
            });
            newAtom.x += displacement[0];
            newAtom.y += displacement[1];
            newAtom.z += displacement[2];
            supercell.addAtom(newAtom);
          }
        }
      }
    }

    return supercell;
  }

  /**
   * Clone this structure
   */
  clone(): Structure {
    const cloned = new Structure(this.name, this.isCrystal);
    for (const atom of this.atoms) {
      cloned.addAtom(atom.clone());
    }
    cloned.bonds = this.bonds.map((bond) => bond.clone());
    cloned.rebuildBondIndex();
    cloned.periodicBondImages = new Map(this.periodicBondImages);
    if (this.unitCell) {
      cloned.unitCell = this.unitCell.clone();
    }
    cloned.supercell = [...this.supercell];
    cloned.metadata = new Map(this.metadata);
    cloned.hasCalculatedBonds = this.hasCalculatedBonds;
    return cloned;
  }

  /**
   * Rebuild the atom index - called after bulk operations
   */
  rebuildAtomIndex(): void {
    this.atomIndex.clear();
    for (const atom of this.atoms) {
      this.atomIndex.set(atom.id, atom);
    }
  }

  /**
   * Get the number of atoms in the index (for debugging/testing)
   */
  getAtomIndexSize(): number {
    return this.atomIndex.size;
  }

  /**
   * Get periodic bonds using spatial hashing for O(n) performance
   * This is the periodic equivalent of getBonds() for crystal structures
   */
  getPeriodicBonds(): Array<{ atomId1: string; atomId2: string; distance: number; image?: [number, number, number]; radius: number; color?: string }> {
    if (!this.isCrystal || !this.unitCell) {
      return [];
    }

    const bonds: Array<{ atomId1: string; atomId2: string; distance: number; image?: [number, number, number]; radius: number; color?: string }> = [];
    const vectors = this.unitCell.getLatticeVectors();

    for (const bond of this.bonds) {
      const id1 = bond.atomId1;
      const id2 = bond.atomId2;
      const atom1 = this.getAtom(id1);
      const atom2 = this.getAtom(id2);
      if (!atom1 || !atom2) {continue;}

      const bondKey = Structure.bondKey(id1, id2);
      const storedImage = this.periodicBondImages.get(bondKey);
      
      if (storedImage) {
        const [ox, oy, oz] = storedImage;
        const offsetX = ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0];
        const offsetY = ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1];
        const offsetZ = ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2];
        
        const dx = (atom2.x + offsetX) - atom1.x;
        const dy = (atom2.y + offsetY) - atom1.y;
        const dz = (atom2.z + offsetZ) - atom1.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        bonds.push({
          atomId1: id1,
          atomId2: id2,
          distance,
          image: storedImage,
          radius: bond.radius,
          color: bond.color,
        });
      } else {
        let minDist = Infinity;
        let bestImage: [number, number, number] = [0, 0, 0];

        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let oz = -1; oz <= 1; oz++) {
              const offsetX = ox * vectors[0][0] + oy * vectors[1][0] + oz * vectors[2][0];
              const offsetY = ox * vectors[0][1] + oy * vectors[1][1] + oz * vectors[2][1];
              const offsetZ = ox * vectors[0][2] + oy * vectors[1][2] + oz * vectors[2][2];

              const imageX = atom2.x + offsetX;
              const imageY = atom2.y + offsetY;
              const imageZ = atom2.z + offsetZ;

              const dx = imageX - atom1.x;
              const dy = imageY - atom1.y;
              const dz = imageZ - atom1.z;
              const distSq = dx * dx + dy * dy + dz * dz;

              if (distSq < minDist * minDist) {
                minDist = Math.sqrt(distSq);
                bestImage = [ox, oy, oz];
              }
            }
          }
        }

        bonds.push({
          atomId1: id1,
          atomId2: id2,
          distance: minDist,
          image: bestImage,
          radius: bond.radius,
          color: bond.color,
        });
      }
    }

    return bonds;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      atoms: this.atoms.map((a) => a.toJSON()),
      bonds: this.bonds.map((bond) => bond.toJSON()),
      periodicBondImages: Array.from(this.periodicBondImages.entries()),
      unitCell: this.unitCell?.toJSON(),
      isCrystal: this.isCrystal,
      supercell: this.supercell,
      metadata: Array.from(this.metadata.entries()),
    };
  }

  static fromJSON(data: ReturnType<Structure['toJSON']>): Structure {
    const s = new Structure(data.name, data.isCrystal);
    s.id = data.id;
    for (const a of data.atoms) {
      const atom = new Atom(a.element, a.x, a.y, a.z, a.id, {
        color: a.color,
        radius: a.radius,
        fixed: a.fixed ?? false,
        selectiveDynamics: a.selectiveDynamics,
      });
      s.addAtom(atom);
    }
    const rawBonds = (data as Record<string, unknown>).bonds;
    const legacyManualBonds = (data as Record<string, unknown>).manualBonds as Array<[string, string]> | undefined;
    const sourceBonds = Array.isArray(rawBonds) ? rawBonds : legacyManualBonds ?? [];

    for (const entry of sourceBonds) {
      if (Array.isArray(entry)) {
        const [atomId1, atomId2] = entry;
        if (typeof atomId1 === 'string' && typeof atomId2 === 'string') {
          s.addBond(atomId1, atomId2);
        }
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const atomId1 = record.atomId1;
      const atomId2 = record.atomId2;
      if (typeof atomId1 !== 'string' || typeof atomId2 !== 'string') {
        continue;
      }

      const radius = typeof record.radius === 'number' && Number.isFinite(record.radius) && record.radius > 0
        ? record.radius
        : undefined;
      const color = typeof record.color === 'string' && record.color.length > 0
        ? record.color
        : undefined;
      const bond = s.addBond(atomId1, atomId2, { radius, color });
      if (bond && typeof record.id === 'string' && record.id.length > 0) {
        bond.id = record.id;
      }
    }
    s.rebuildBondIndex();
    
    const periodicBondImagesData = (data as Record<string, unknown>).periodicBondImages as
      | Array<[string, [number, number, number]]>
      | undefined;
    if (periodicBondImagesData) {
      s.periodicBondImages = new Map(periodicBondImagesData);
    } else {
      s.periodicBondImages.clear();
    }
    
    if (data.unitCell) {
      const uc = data.unitCell;
      s.unitCell = new UnitCell(uc.a, uc.b, uc.c, uc.alpha, uc.beta, uc.gamma);
    }
    s.supercell = data.supercell ?? [1, 1, 1];
    s.metadata = new Map(data.metadata ?? []);
    return s;
  }
}
