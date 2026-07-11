import { expect } from 'chai';
import { formatCoordinate, formatCoordinateTriplet } from '../../../utils/coordinateFormat.js';

describe('coordinateFormat', () => {
  it('right-aligns positive and negative values to the same width', () => {
    expect(formatCoordinate(1.25)).to.have.lengthOf(16);
    expect(formatCoordinate(-1.25)).to.have.lengthOf(16);
  });

  it('formats stable three-column coordinate rows', () => {
    const row = formatCoordinateTriplet([1, -2, 30]);
    const fields = row.match(/.{16}(?:  |$)/g);
    expect(fields).to.have.lengthOf(3);
    expect(row).to.equal('    1.0000000000     -2.0000000000     30.0000000000');
  });

  it('rejects non-finite coordinates', () => {
    expect(() => formatCoordinate(Number.NaN)).to.throw(/non-finite/);
  });

  it('normalizes negative zero at the selected precision', () => {
    expect(formatCoordinate(-1e-14)).to.equal('    0.0000000000');
  });
});
