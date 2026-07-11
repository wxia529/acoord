import { expect } from 'chai';
import { fitPlane } from '../../../utils/planeFit.js';

describe('fitPlane', () => {
  it('uses the exact plane for three non-collinear points', () => {
    const result = fitPlane([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }]);
    expect(result.method).to.equal('exact');
    expect(result.normal).to.deep.equal([0, 0, 1]);
    expect(result.rms).to.equal(0);
  });

  it('fits all points with PCA when four or more are selected', () => {
    const result = fitPlane([
      { x: -1, y: -1, z: 0.08 },
      { x: 1, y: -1, z: -0.08 },
      { x: 1, y: 1, z: 0.08 },
      { x: -1, y: 1, z: -0.08 },
    ]);
    expect(result.method).to.equal('pca');
    expect(result.normal[2]).to.be.greaterThan(0.99);
    expect(result.rms).to.be.greaterThan(0);
  });

  it('rejects collinear selections', () => {
    expect(() => fitPlane([
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
      { x: 3, y: 3, z: 3 },
    ])).to.throw(/collinear/);
  });

  it('normalizes the dominant normal component to the positive direction', () => {
    const result = fitPlane([{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }]);
    expect(result.normal[2]).to.equal(1);
  });
});
