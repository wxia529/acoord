import { Structure } from '../models/structure.js';

export class TrajectoryManager {
  private _frames: Structure[] = [];
  private _activeIndex = 0;
  private _isEditing = false;
  private _editSnapshot: Structure | null = null;

  constructor(frames: Structure[] = [], activeIndex = 0) {
    this.set(frames, activeIndex);
  }

  set(frames: Structure[], activeIndex: number): void {
    this._frames = frames.length > 0 ? frames : [new Structure('')];
    this._activeIndex = Math.max(0, Math.min(this._frames.length - 1, Math.floor(activeIndex)));
    this._isEditing = false;
    this._editSnapshot = null;
  }

  setActiveIndex(index: number): void {
    this._activeIndex = Math.max(0, Math.min(this._frames.length - 1, Math.floor(index)));
    this._isEditing = false;
    this._editSnapshot = null;
  }

  updateActiveFrame(structure: Structure): void {
    this._frames[this._activeIndex] = structure;
    this._isEditing = false;
    this._editSnapshot = null;
  }

  get frames(): Structure[] {
    return this._frames;
  }

  get activeIndex(): number {
    return this._activeIndex;
  }

  get activeStructure(): Structure {
    return this._frames[this._activeIndex];
  }

  get frameCount(): number {
    return this._frames.length;
  }

  get isEditing(): boolean {
    return this._isEditing;
  }

  beginEdit(): Structure {
    if (!this._isEditing) {
      this._editSnapshot = this._frames[this._activeIndex].clone();
      this._isEditing = true;
    }
    return this._frames[this._activeIndex];
  }

  commitEdit(): void {
    this._isEditing = false;
    this._editSnapshot = null;
  }

  rollbackEdit(): Structure {
    if (this._editSnapshot) {
      this._frames[this._activeIndex] = this._editSnapshot;
      this._editSnapshot = null;
    }
    this._isEditing = false;
    return this._frames[this._activeIndex];
  }

  static defaultFrameIndex(frames: Structure[]): number {
    if (!frames || frames.length === 0) {
      return 0;
    }
    return Math.max(0, frames.length - 1);
  }
}
