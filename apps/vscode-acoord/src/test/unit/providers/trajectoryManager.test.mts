import { describe, it } from 'mocha';
import * as assert from 'assert';
import { TrajectoryManager } from '../../../providers/trajectoryManager.js';
import { Structure } from '../../../models/structure.js';

describe('TrajectoryManager', () => {
  it('manages activeBondScheme', () => {
    const tm = new TrajectoryManager([new Structure('1')]);
    assert.strictEqual((tm as any).activeBondScheme, null);
    (tm as any).activeBondScheme = 'all';
    assert.strictEqual((tm as any).activeBondScheme, 'all');
  });
});
