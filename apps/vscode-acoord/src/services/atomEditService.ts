import { RenderMessageBuilder } from '../renderers/renderMessageBuilder.js';
import { Atom } from '../models/atom.js';
import { UndoManager } from '../providers/undoManager.js';
import { TrajectoryManager } from '../providers/trajectoryManager.js';
import { parseElement, getDefaultAtomRadius, ELEMENT_DATA } from '../utils/elementData.js';
import { BRIGHT_SCHEME } from '../config/presets/color-schemes/index.js';
import { DisplaySettings } from '../config/types.js';
import { ColorScheme } from '../shared/protocol.js';

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface CopyOffset {
  x: number;
  y: number;
  z: number;
}

/**
 * Service for atom editing operations (add, delete, move, copy, change element).
 * 
 * Color/radius priority when creating or modifying atoms:
 * 1. DisplaySettings.currentColorByElement / currentRadiusByElement (user overrides)
 * 2. ColorScheme.colors (current color scheme)
 * 3. ELEMENT_DATA defaults (JMol colors, covalent radii with visual scale)
 * 
 * Key principle: All color/radius computation happens here (Extension side).
 * The webview only renders the pre-computed values stored in atom.color/atom.radius.
 */
export class AtomEditService {
  private sessionRef?: { 
    displaySettings?: DisplaySettings;
    getColorScheme?: () => ColorScheme | null;
  };

  constructor(
    private renderer: RenderMessageBuilder,
    private trajectoryManager: TrajectoryManager,
    private undoManager: UndoManager
  ) {}

  setSessionRef(ref: { 
    displaySettings?: DisplaySettings;
    getColorScheme?: () => ColorScheme | null;
  }): void {
    this.sessionRef = ref;
  }

  /**
   * Add a new atom with color/radius from current DisplaySettings.
   * Uses the "current brush" concept - applies active color scheme and radius scale.
   * If the structure has selective dynamics enabled, new atoms default to [T, T, T].
   */
  addAtom(element: string, x: number, y: number, z: number): boolean {
    const parsedElement = parseElement(element);
    if (!parsedElement) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;

    const { color, radius } = this.computeAtomProperties(parsedElement);

    // Check if structure has selective dynamics enabled
    const hasSelectiveDynamics = editStructure.atoms.some(a => a.selectiveDynamics !== undefined);

    const atom = new Atom(parsedElement, x, y, z, undefined, {
      color,
      radius,
      selectiveDynamics: hasSelectiveDynamics ? [true, true, true] : undefined,
    });
    this.undoManager.push(editStructure);
    editStructure.addAtom(atom);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /** Insert a dummy atom at the geometric center or center of mass of selected atoms. */
  insertDummyAtom(atomIds: string[], centerMode: 'geometry' | 'mass'): string {
    return this.insertSpecialAtom(atomIds, centerMode, 'dummy', 'X');
  }

  /** Insert a ghost atom carrying the requested element basis (H by default). */
  insertGhostAtom(
    atomIds: string[],
    centerMode: 'geometry' | 'mass',
    basisElement: string = 'H',
    normalOffset: number = 0
  ): string {
    const element = parseElement(basisElement);
    if (!element) {
      throw new Error(`insertGhostAtom: invalid basis element "${basisElement}"`);
    }
    if (!Number.isFinite(normalOffset)) {
      throw new Error('insertGhostAtom: normal offset must be finite');
    }
    return this.insertSpecialAtom(atomIds, centerMode, 'ghost', element, normalOffset);
  }

  private insertSpecialAtom(
    atomIds: string[],
    centerMode: 'geometry' | 'mass',
    role: 'dummy' | 'ghost',
    element: string,
    normalOffset: number = 0
  ): string {
    const uniqueIds = [...new Set(atomIds)];
    if (uniqueIds.length === 0) {
      throw new Error('insertDummyAtom: select at least one atom');
    }
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    const atoms = uniqueIds.map((id) => {
      const atom = editStructure.getAtom(id);
      if (!atom) {
        throw new Error(`insertDummyAtom: atom "${id}" not found`);
      }
      return atom;
    });
    const weightedAtoms = centerMode === 'mass'
      ? atoms.filter((atom) => atom.role === 'real')
      : atoms;
    if (weightedAtoms.length === 0) {
      throw new Error('insertDummyAtom: center of mass requires at least one real atom');
    }
    let totalWeight = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const atom of weightedAtoms) {
      const weight = centerMode === 'mass' ? ELEMENT_DATA[atom.element]?.atomicMass ?? 0 : 1;
      if (weight <= 0) {
        continue;
      }
      totalWeight += weight;
      x += atom.x * weight;
      y += atom.y * weight;
      z += atom.z * weight;
    }
    if (totalWeight === 0) {
      throw new Error('insertDummyAtom: selected atoms have no valid mass');
    }
    let centerX = x / totalWeight;
    let centerY = y / totalWeight;
    let centerZ = z / totalWeight;
    if (normalOffset !== 0) {
      const [nx, ny, nz] = this.getPlaneNormal(atoms);
      centerX += nx * normalOffset;
      centerY += ny * normalOffset;
      centerZ += nz * normalOffset;
    }
    const specialAtom = new Atom(element, centerX, centerY, centerZ, undefined, {
      color: '#A0A0A0',
      radius: 0.18,
      label: role === 'ghost' ? `${element}:` : 'X',
      role,
    });
    this.undoManager.push(editStructure);
    editStructure.addAtom(specialAtom);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return specialAtom.id;
  }

  private getPlaneNormal(atoms: Atom[]): [number, number, number] {
    if (atoms.length < 3) {
      throw new Error('insertGhostAtom: non-zero normal offset requires at least three atoms');
    }
    for (let i = 0; i < atoms.length - 2; i++) {
      for (let j = i + 1; j < atoms.length - 1; j++) {
        for (let k = j + 1; k < atoms.length; k++) {
          const abx = atoms[j].x - atoms[i].x;
          const aby = atoms[j].y - atoms[i].y;
          const abz = atoms[j].z - atoms[i].z;
          const acx = atoms[k].x - atoms[i].x;
          const acy = atoms[k].y - atoms[i].y;
          const acz = atoms[k].z - atoms[i].z;
          let nx = aby * acz - abz * acy;
          let ny = abz * acx - abx * acz;
          let nz = abx * acy - aby * acx;
          const length = Math.hypot(nx, ny, nz);
          if (length <= 1e-12) {
            continue;
          }
          nx /= length;
          ny /= length;
          nz /= length;
          const components = [nx, ny, nz];
          let dominantIndex = 0;
          if (Math.abs(ny) > Math.abs(components[dominantIndex])) {
            dominantIndex = 1;
          }
          if (Math.abs(nz) > Math.abs(components[dominantIndex])) {
            dominantIndex = 2;
          }
          if (components[dominantIndex] < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          return [nx, ny, nz];
        }
      }
    }
    throw new Error('insertGhostAtom: selected atoms are collinear; plane normal is undefined');
  }

  deleteAtom(atomId: string): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    editStructure.removeAtom(atomId);
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  deleteAtoms(atomIds: string[]): void {
    const uniqueIds = Array.from(
      new Set(atomIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
    
    if (uniqueIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const atomId of uniqueIds) {
      editStructure.removeAtom(atomId);
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  moveAtom(atomId: string, x: number, y: number, z: number, preview: boolean = false): void {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atom = editStructure.getAtom(atomId);
    if (atom) {
      atom.setPosition(x, y, z);
      this.renderer.setStructure(editStructure);
      if (!preview) {
        this.trajectoryManager.commitEdit();
      }
    }
  }

  moveGroup(atomIds: string[], dx: number, dy: number, dz: number, preview: boolean = false): void {
    if (atomIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.setPosition(atom.x + dx, atom.y + dy, atom.z + dz);
      }
    }
    this.renderer.setStructure(editStructure);
    if (!preview) {
      this.trajectoryManager.commitEdit();
    }
  }

  rotateGroup(
    atomIds: string[],
    pivot: [number, number, number],
    axis: [number, number, number],
    angle: number,
    preview: boolean = false
  ): void {
    if (atomIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [ax, ay, az] = axis;
    const [px, py, pz] = pivot;
    
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (!atom) {
        continue;
      }
      
      const vx = atom.x - px;
      const vy = atom.y - py;
      const vz = atom.z - pz;
      
      const dot = vx * ax + vy * ay + vz * az;
      const newX = vx * cos + (ay * vz - az * vy) * sin + ax * dot * (1 - cos);
      const newY = vy * cos + (az * vx - ax * vz) * sin + ay * dot * (1 - cos);
      const newZ = vz * cos + (ax * vy - ay * vx) * sin + az * dot * (1 - cos);
      
      atom.setPosition(newX + px, newY + py, newZ + pz);
    }
    
    this.renderer.setStructure(editStructure);
    if (!preview) {
      this.trajectoryManager.commitEdit();
    }
  }

  setAtomPositions(updates: PositionUpdate[]): void {
    if (updates.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    for (const update of updates) {
      const atom = editStructure.getAtom(update.id);
      if (atom) {
        atom.setPosition(update.x, update.y, update.z);
      }
    }
    this.renderer.setStructure(editStructure);
  }

  copyAtoms(atomIds: string[], offset: CopyOffset): void {
    if (atomIds.length === 0) {
      return;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (!atom) {continue;}
      
      const copy = new Atom(
        atom.element,
        atom.x + (offset.x || 0),
        atom.y + (offset.y || 0),
        atom.z + (offset.z || 0),
        undefined,
        {
          color: atom.color,
          radius: atom.radius,
          label: atom.label,
          fixed: atom.fixed,
          selectiveDynamics: atom.selectiveDynamics,
          role: atom.role,
          sourceLabel: atom.sourceLabel,
        }
      );
      editStructure.addAtom(copy);
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
  }

  /**
   * Change the element type of atoms and update their color/radius accordingly.
   */
  changeAtoms(atomIds: string[], element: string): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    const parsedElement = parseElement(element);
    if (!parsedElement) {
      throw new Error(`changeAtoms: invalid element symbol "${element}"`);
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    
    const { color, radius } = this.computeAtomProperties(parsedElement);
    
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.element = parsedElement;
        atom.color = color;
        atom.radius = radius;
        atom.role = 'real';
        atom.sourceLabel = undefined;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setAtomColor(atomIds: string[], color: string): boolean {
    if (atomIds.length === 0 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.color = color;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setAtomRadius(atomIds: string[], radius: number): boolean {
    if (atomIds.length === 0 || !Number.isFinite(radius) || radius <= 0) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;

    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.radius = radius;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  setAtomFixed(atomIds: string[], fixed: boolean): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;

    this.undoManager.push(editStructure);

    // Set the target atoms
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        atom.fixed = fixed;
        // Sync selectiveDynamics: fixed = [F, F, F], unfixed = [T, T, T]
        atom.selectiveDynamics = fixed ? [false, false, false] : [true, true, true];
      }
    }

    // Ensure all atoms have selectiveDynamics set if any atom has it
    // This handles files originally loaded without selective dynamics
    const hasAnySelectiveDynamics = editStructure.atoms.some(a => a.selectiveDynamics !== undefined);
    if (hasAnySelectiveDynamics) {
      for (const atom of editStructure.atoms) {
        if (atom.selectiveDynamics === undefined) {
          atom.selectiveDynamics = [true, true, true];
          atom.fixed = false;
        }
      }
    }

    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /**
   * Set radius of selected atoms to their element's covalent radius (unscaled).
   */
  setCovalentRadius(atomIds: string[]): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);
    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        const covalentRadius = ELEMENT_DATA[atom.element]?.covalentRadius;
        atom.radius = covalentRadius ?? 0.3;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /**
   * Apply current DisplaySettings to selected atoms ("Apply to Selection" action).
   * Updates atom.color and atom.radius based on current brush settings.
   */
  applyDisplaySettings(atomIds: string[]): boolean {
    if (atomIds.length === 0) {
      return false;
    }

    const settings = this.sessionRef?.displaySettings;
    if (!settings) {
      return false;
    }

    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    this.undoManager.push(editStructure);

    for (const id of atomIds) {
      const atom = editStructure.getAtom(id);
      if (atom) {
        const { color, radius } = this.computeAtomProperties(atom.element);
        atom.color = color;
        atom.radius = radius;
      }
    }
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }

  /**
   * Compute color and radius for an element using current DisplaySettings.
   * Priority: user overrides > color scheme > element defaults.
   */
  private computeAtomProperties(element: string): { color: string; radius: number } {
    const settings = this.sessionRef?.displaySettings;
    const colorScheme = this.sessionRef?.getColorScheme?.();
    
    let color: string;
    if (settings?.currentColorByElement?.[element]) {
      color = settings.currentColorByElement[element];
    } else if (colorScheme?.colors[element]) {
      color = colorScheme.colors[element];
    } else {
      color = BRIGHT_SCHEME.colors[element] || '#C0C0C0';
    }
    
    let radius: number;
    if (settings?.currentRadiusByElement?.[element]) {
      radius = settings.currentRadiusByElement[element];
    } else {
      const baseRadius = getDefaultAtomRadius(element);
      radius = settings?.currentRadiusScale !== undefined 
        ? baseRadius * settings.currentRadiusScale 
        : baseRadius;
    }
    
    return { color, radius };
  }

  updateAtom(
    atomId: string,
    options: {
      element?: string;
      x?: number;
      y?: number;
      z?: number;
      fractionalPosition?: [number, number, number];
    }
  ): boolean {
    if (!this.trajectoryManager.isEditing) {
      this.trajectoryManager.beginEdit();
    }
    const editStructure = this.trajectoryManager.activeStructure;
    
    const atom = editStructure.getAtom(atomId);
    if (!atom) {
      return false;
    }

    let fractionalCartesianPosition: [number, number, number] | undefined;
    if (options.fractionalPosition) {
      if (!editStructure.unitCell) {
        throw new Error('updateAtom: fractional coordinates require a unit cell');
      }
      const [fx, fy, fz] = options.fractionalPosition;
      if (![fx, fy, fz].every(Number.isFinite)) {
        throw new Error('updateAtom: fractional coordinates must be finite numbers');
      }
      fractionalCartesianPosition = editStructure.unitCell.fractionalToCartesian(fx, fy, fz);
    }

    this.undoManager.push(editStructure);
    
    if (options.element) {
      const parsedElement = parseElement(options.element);
      if (parsedElement) {
        atom.element = parsedElement;
        atom.role = 'real';
        atom.sourceLabel = undefined;
      }
    }
    
    if (fractionalCartesianPosition) {
      const [x, y, z] = fractionalCartesianPosition;
      atom.setPosition(x, y, z);
    } else if (
      typeof options.x === 'number' &&
      typeof options.y === 'number' &&
      typeof options.z === 'number'
    ) {
      atom.setPosition(options.x, options.y, options.z);
    }
    
    this.renderer.setStructure(editStructure);
    this.trajectoryManager.commitEdit();
    return true;
  }
}
