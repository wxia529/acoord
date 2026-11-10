import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AbacusInput } from '../../../io/abacus/abacusInput.js';
import {
  applyCalculationPreset,
  buildGammaOnlyKpt,
  createDefaultInput,
} from '../../../io/abacus/abacusPresets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures/bsse_water');

describe('AbacusInput', () => {
  const input = AbacusInput.parse(readFileSync(join(FIXTURES, 'INPUT'), 'utf-8'));

  it('should read keys, values and comments', () => {
    expect(input.get('ecutwfc')).to.equal('60');
    expect(input.getNumber('ecutwfc')).to.equal(60);
    expect(input.get('basis_type')).to.equal('lcao');
    expect(input.get('pseudo_dir')).to.equal('../../../tests/PP_ORB');
    expect(input.getNumber('missing_key')).to.equal(undefined);
  });

  it('should keep unrelated parameters and comments when updating a value', () => {
    const updated = input.clone();
    updated.set('ecutwfc', 80);
    const text = updated.serialize();

    expect(text).to.contain('INPUT_PARAMETERS');
    expect(text).to.contain('ecutwfc');
    expect(text).to.match(/ecutwfc\s+80/);
    expect(text).to.match(/pseudo_dir\s+\.\.\/\.\.\/\.\.\/tests\/PP_ORB/);
    expect(text).to.match(/gamma_only\s+1/);
    expect(text).to.contain('#this is the input of using counterpoise');
  });

  it('should add new keys and remove keys on request', () => {
    const updated = input.clone();
    updated.set('ntype', 3, 'number of species');
    expect(updated.get('ntype')).to.equal('3');
    expect(updated.serialize()).to.match(/ntype\s+3\s+number of species/);

    updated.remove('smearing_method');
    expect(updated.has('smearing_method')).to.equal(false);
    expect(updated.serialize()).to.not.contain('smearing_method');
  });

  it('should round-trip without losing parameters', () => {
    const text = input.serialize();
    const reparsed = AbacusInput.parse(text);
    expect(reparsed.toObject()).to.deep.equal(input.toObject());
    expect(reparsed.serialize()).to.equal(text);
  });

  it('should parse a minimal INPUT without a header', () => {
    const minimal = AbacusInput.parse('ecutwfc 50\ncalculation scf\n');
    expect(minimal.get('ecutwfc')).to.equal('50');
    expect(minimal.serialize()).to.match(/^INPUT_PARAMETERS\n/);
    expect(minimal.serialize()).to.match(/ecutwfc\s+50/);
  });
});

describe('ABACUS calculation presets', () => {
  it('should build a relax INPUT with forces enabled', () => {
    const input = createDefaultInput({ kind: 'relax', ecutwfc: 70, relaxNmax: 60, forceThrEv: 0.02 });
    expect(input.get('calculation')).to.equal('relax');
    expect(input.getNumber('ecutwfc')).to.equal(70);
    expect(input.getNumber('relax_nmax')).to.equal(60);
    expect(input.getNumber('force_thr_ev')).to.equal(0.02);
    expect(input.getNumber('cal_force')).to.equal(1);
    expect(input.getNumber('cal_stress')).to.equal(0);
    expect(input.has('stress_thr')).to.equal(false);
  });

  it('should enable stress for a variable-cell relaxation', () => {
    const input = createDefaultInput({ kind: 'cell-relax', stressThrKbar: 0.3 });
    expect(input.get('calculation')).to.equal('cell-relax');
    expect(input.getNumber('cal_stress')).to.equal(1);
    expect(input.getNumber('stress_thr')).to.equal(0.3);
    expect(input.getNumber('cal_force')).to.equal(1);
  });

  it('should strip relaxation keywords for a single point', () => {
    const input = createDefaultInput({ kind: 'cell-relax' });
    applyCalculationPreset(input, { kind: 'scf' });
    expect(input.get('calculation')).to.equal('scf');
    expect(input.has('relax_nmax')).to.equal(false);
    expect(input.has('stress_thr')).to.equal(false);
    expect(input.getNumber('cal_force')).to.equal(0);
  });

  it('should configure MD steps', () => {
    const input = createDefaultInput({ kind: 'md', mdNstep: 250, mdDt: 2 });
    expect(input.get('calculation')).to.equal('md');
    expect(input.getNumber('md_nstep')).to.equal(250);
    expect(input.getNumber('md_dt')).to.equal(2);
    expect(input.has('relax_nmax')).to.equal(false);
  });

  it('should provide a Gamma-only KPT file', () => {
    expect(buildGammaOnlyKpt()).to.contain('Gamma');
  });
});
