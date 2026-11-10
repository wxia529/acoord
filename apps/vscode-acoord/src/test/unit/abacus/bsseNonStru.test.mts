import { expect } from 'chai';
import { FileManager } from '../../../io/fileManager.js';
import {
  buildBssePlan,
  ensureVacuumBox,
} from '../../../io/abacus/bsseGenerator.js';
import { buildBsseFileSet } from '../../../io/abacus/bsseSetWriter.js';
import { createDefaultInput } from '../../../io/abacus/abacusPresets.js';

const WATER_XYZ = `3
water
O   0.000000   0.000000   0.119262
H   0.000000   0.763239  -0.477047
H   0.000000  -0.763239  -0.477047
`;

describe('BSSE from a non-STRU source', () => {
  const xyzStructure = FileManager.loadStructures('water.xyz', WATER_XYZ)[0];

  it('should wrap a cell-free structure into a cubic vacuum box', () => {
    expect(xyzStructure.unitCell).to.equal(undefined);
    const wrapped = ensureVacuumBox(xyzStructure);
    expect(wrapped.unitCell).to.not.equal(undefined);
    const box = wrapped.unitCell!.a;
    expect(box).to.be.greaterThan(20);
    for (const atom of wrapped.atoms) {
      for (const value of [atom.x, atom.y, atom.z]) {
        expect(value).to.be.greaterThan(0);
        expect(value).to.be.lessThan(box);
      }
    }
    // Source structure is untouched.
    expect(xyzStructure.unitCell).to.equal(undefined);
    expect(xyzStructure.atoms[0].x).to.equal(0);
  });

  it('should leave a structure that already has a cell untouched', () => {
    const wrapped = ensureVacuumBox(xyzStructure);
    expect(ensureVacuumBox(wrapped)).to.equal(wrapped);
  });

  it('should still emit ABACUS STRU files with empty species', () => {
    const structure = ensureVacuumBox(xyzStructure);
    const plan = buildBssePlan(structure, { mode: 'atom' });
    const files = buildBsseFileSet({
      plan,
      inputTemplate: createDefaultInput({ kind: 'scf' }),
      title: 'water.xyz atoms',
      notes: ['source was xyz'],
    });
    const byName = new Map(files.map((file) => [file.name, file.content]));

    expect(plan).to.have.lengthOf(4);
    const stru1 = byName.get('STRU_1') ?? '';
    const stru2 = byName.get('STRU_2') ?? '';
    // STRU_1 keeps the O nucleus, both H atoms stay as empty centres.
    expect(stru1).to.contain('H_empty');
    expect(stru1).to.not.contain('O_empty');
    // STRU_2 keeps the first H nucleus, O and the other H are empty centres.
    expect(stru2).to.contain('O_empty');
    expect(stru2).to.contain('H_empty');
    expect(stru1).to.contain('LATTICE_VECTORS');
    expect(stru1).to.contain('Direct');
    // Ghost and real species share the same pseudopotential file.
    const real = /^H\s+1\.008\s+(\S+)$/m.exec(stru2);
    const ghost = /^H_empty\s+1\.008\s+(\S+)$/m.exec(stru2);
    expect(real).to.not.equal(null);
    expect(ghost?.[1]).to.equal(real?.[1]);
    expect(byName.get('INPUT_2')).to.match(/ntype\s+3/);
    expect(byName.get('README_bsse.md')).to.contain('## Notes');
    expect(byName.get('README_bsse.md')).to.contain('source was xyz');
  });
});
