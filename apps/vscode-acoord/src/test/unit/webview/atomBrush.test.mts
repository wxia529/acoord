import { expect } from 'chai';
import {
  DEFAULT_ATOM_BRUSH_MAX_DISTANCE,
  MIN_ATOM_BRUSH_MAX_DISTANCE,
  normalizeAtomBrushMaxDistance,
  resolveAtomBrushDistance,
} from '../../../../media/webview/src/utils/atomBrush.js';

describe('webview atom brush utils', () => {
  it('normalizes invalid maximum distance to the default', () => {
    expect(normalizeAtomBrushMaxDistance(Number.NaN)).to.equal(DEFAULT_ATOM_BRUSH_MAX_DISTANCE);
    expect(normalizeAtomBrushMaxDistance('invalid')).to.equal(DEFAULT_ATOM_BRUSH_MAX_DISTANCE);
  });

  it('uses a typical C-C single-bond length by default', () => {
    expect(DEFAULT_ATOM_BRUSH_MAX_DISTANCE).to.equal(1.54);
  });

  it('clamps spacing to a safe positive minimum', () => {
    expect(normalizeAtomBrushMaxDistance(0)).to.equal(MIN_ATOM_BRUSH_MAX_DISTANCE);
    expect(normalizeAtomBrushMaxDistance(-2)).to.equal(MIN_ATOM_BRUSH_MAX_DISTANCE);
  });

  it('ignores tiny gestures and clamps long gestures', () => {
    expect(resolveAtomBrushDistance(0.1, 2)).to.equal(null);
    expect(resolveAtomBrushDistance(1.2, 2)).to.equal(1.2);
    expect(resolveAtomBrushDistance(5, 2)).to.equal(2);
  });
});
