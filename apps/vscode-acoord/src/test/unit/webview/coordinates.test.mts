import { expect } from 'chai';
import { formatCoordinatesForClipboard } from '../../../../media/webview/src/utils/coordinates.js';

describe('webview coordinate clipboard format', () => {
  it('copies x, y, z without brackets', () => {
    expect(formatCoordinatesForClipboard([1.25, -2, 3.12345678901]))
      .to.equal('1.25,-2,3.123456789');
  });
});
