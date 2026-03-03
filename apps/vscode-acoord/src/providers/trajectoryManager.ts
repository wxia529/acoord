import { Structure } from '../models/structure';

/**
 * Tracks the active frame index and frame list for a trajectory.
 * Keeps `activeStructure` in sync with `frames[activeIndex]`.
 */
export class TrajectoryManager {
  private _frames: Structure[] = [];
  private _activeIndex = 0;

  constructor(frames: Structure[] = [], activeIndex = 0) {
    this.set(frames, activeIndex);
  }

  /** Replace the entire frame list and set the active frame. */
  set(frames: Structure[], activeIndex: number): void {
    this._frames = frames.length > 0 ? frames : [new Structure('')];
    this._activeIndex = Math.max(0, Math.min(this._frames.length - 1, Math.floor(activeIndex)));
  }

  /** Update the active frame index, clamped to valid range. */
  setActiveIndex(index: number): void {
    this._activeIndex = Math.max(0, Math.min(this._frames.length - 1, Math.floor(index)));
  }

  /** Overwrite the structure at the currently active frame slot. */
  updateActiveFrame(structure: Structure): void {
    this._frames[this._activeIndex] = structure;
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

  /**
   * Return the index of the default display frame (last frame, matching prior
   * behaviour of `getDefaultTrajectoryFrameIndex`).
   */
  static defaultFrameIndex(frames: Structure[]): number {
    if (!frames || frames.length === 0) {
      return 0;
    }
    return Math.max(0, frames.length - 1);
  }
}
