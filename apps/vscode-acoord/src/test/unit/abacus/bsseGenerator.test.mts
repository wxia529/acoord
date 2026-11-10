import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { STRUParser, collectStruSpeciesLabels } from '../../../io/parsers/struParser.js';
import { AbacusInput } from '../../../io/abacus/abacusInput.js';
import {
  buildBssePlan,
  detectBsseFragments,
  formatComposition,
} from '../../../io/abacus/bsseGenerator.js';
import { buildBsseFileSet } from '../../../io/abacus/bsseSetWriter.js';
import { computeCounterpoise, parseAbacusTotalEnergy } from '../../../io/abacus/bsseEnergy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures/bsse_water');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('BSSE planner', () => {
  const parser = new STRUParser();
  const water = parser.parse(fixture('STRU_0'));

  it('should split a water molecule into one fragment per atom', () => {
    const fragments = detectBsseFragments(water, 'atom');
    expect(fragments).to.have.lengthOf(3);
    expect(fragments.map((fragment) => fragment.name)).to.deep.equal(['H1', 'H2', 'O3']);
    expect(fragments.every((fragment) => fragment.atomIds.length === 1)).to.equal(true);
  });

  it('should group fragments by element', () => {
    const fragments = detectBsseFragments(water, 'element');
    expect(fragments).to.have.lengthOf(2);
    expect(fragments.map((fragment) => fragment.name)).to.deep.equal(['H', 'O']);
    expect(fragments[0].atomIds).to.have.lengthOf(2);
  });

  it('should detect a single molecule from the bond graph', () => {
    const fragments = detectBsseFragments(water, 'molecule');
    expect(fragments).to.have.lengthOf(1);
    expect(fragments[0].composition).to.equal('H2O');
    expect(fragments[0].atomIds).to.have.lengthOf(3);
  });

  it('should build reference plus one calculation per fragment', () => {
    const plan = buildBssePlan(water, { mode: 'atom' });

    expect(plan).to.have.lengthOf(4);
    expect(plan[0].fileName).to.equal('STRU_0');
    expect(plan[0].isReference).to.equal(true);
    expect(plan[0].ntype).to.equal(2);
    expect(plan.slice(1).map((calculation) => calculation.fileName))
      .to.deep.equal(['STRU_1', 'STRU_2', 'STRU_3']);
    expect(plan.slice(1).map((calculation) => calculation.ntype)).to.deep.equal([3, 3, 2]);
  });

  it('should keep only the fragment nuclei and ghost the rest', () => {
    const plan = buildBssePlan(water, { mode: 'atom' });
    const h1Calculation = plan[1];

    const ghosts = h1Calculation.structure.atoms.filter((atom) => atom.role === 'ghost');
    expect(ghosts).to.have.lengthOf(2);
    expect(collectStruSpeciesLabels(h1Calculation.structure)).to.deep.equal(['H', 'H_empty', 'O_empty']);
    // Original structure must stay untouched.
    expect(water.atoms.every((atom) => atom.role === 'real')).to.equal(true);
  });

  it('should keep the same coordinates in every calculation', () => {
    const plan = buildBssePlan(water, { mode: 'element' });
    const positions = water.atoms.map((atom) => [atom.x, atom.y, atom.z]);
    for (const calculation of plan) {
      expect(calculation.structure.atoms.map((atom) => [atom.x, atom.y, atom.z]))
        .to.deep.equal(positions);
    }
  });
});

describe('BSSE file set', () => {
  const parser = new STRUParser();
  const water = parser.parse(fixture('STRU_0'));
  const plan = buildBssePlan(water, { mode: 'atom' });
  const template = AbacusInput.parse(fixture('INPUT'));
  const files = buildBsseFileSet({ plan, inputTemplate: template, title: 'water' });
  const byName = new Map(files.map((file) => [file.name, file.content]));

  it('should emit STRU and INPUT files for every calculation', () => {
    for (const calculation of plan) {
      expect(byName.has(calculation.fileName)).to.equal(true);
      expect(byName.has(calculation.inputFileName)).to.equal(true);
    }
    expect(byName.has('README_bsse.md')).to.equal(true);
    expect(byName.has('run_bsse.sh')).to.equal(true);
    expect(byName.has('bsse_index.json')).to.equal(true);
    expect(byName.has('KPT')).to.equal(true);
  });

  it('should write ntype into each INPUT file', () => {
    expect(byName.get('INPUT_0')).to.match(/ntype\s+2/);
    expect(byName.get('INPUT_1')).to.match(/ntype\s+3/);
    expect(byName.get('INPUT_1')).to.match(/calculation\s+scf/);
    expect(byName.get('INPUT_1')).to.match(/ecutwfc\s+60/);
  });

  it('should write empty species into the fragment STRU files', () => {
    expect(byName.get('STRU_1')).to.match(/^\s*H_empty\s*$/m);
    expect(byName.get('STRU_1')).to.contain('O_empty');
    expect(byName.get('STRU_0')).to.not.contain('_empty');
  });

  it('should reference every calculation in the run script and index', () => {
    expect(byName.get('run_bsse.sh')).to.contain('for i in 0 1 2 3; do');
    const index = JSON.parse(byName.get('bsse_index.json') ?? '{}') as {
      calculations?: Array<{ stru: string; ntype: number }>;
    };
    expect(index.calculations).to.have.lengthOf(4);
    expect(index.calculations?.[0].stru).to.equal('STRU_0');
  });

  it('should describe the formula in the README', () => {
    expect(byName.get('README_bsse.md')).to.contain('E_BSSE = E_total - sum_i E_i');
    expect(byName.get('README_bsse.md')).to.contain('STRU_3');
  });
});

describe('BSSE energy evaluation', () => {
  it('should read the final energy from an ABACUS log', () => {
    const log = `
E_KohnSham = -1.0 Ry
 !FINAL_ETOT_IS -466.1225988772539 eV
`;
    expect(parseAbacusTotalEnergy(log)).to.equal(-466.1225988772539);
    expect(parseAbacusTotalEnergy('no energy here')).to.equal(undefined);
  });

  it('should reproduce the ABACUS water example', () => {
    const result = computeCounterpoise(
      { label: 'STRU_0', energy: -466.1225988776397, source: 'calc_0/log.txt' },
      [
        { label: 'STRU_1', energy: -427.6271689751553, source: 'calc_1/log.txt' },
        { label: 'STRU_2', energy: -12.58872469295076, source: 'calc_2/log.txt' },
        { label: 'STRU_3', energy: -12.58872446212924, source: 'calc_3/log.txt' },
      ]
    );

    expect(result.fragmentSum).to.be.closeTo(-452.8046181302, 1e-6);
    expect(result.corrected).to.be.closeTo(-13.3179807474, 1e-6);
  });

  it('should not produce a correction without a reference energy', () => {
    const result = computeCounterpoise(undefined, [
      { label: 'STRU_1', energy: -1, source: 'log' },
    ]);
    expect(result.corrected).to.equal(undefined);
    expect(result.fragmentSum).to.equal(-1);
  });
});

describe('composition formatting', () => {
  it('should order elements with the Hill system', () => {
    expect(formatComposition(['H', 'H', 'O'])).to.equal('H2O');
    expect(formatComposition(['C', 'H', 'H', 'H', 'H'])).to.equal('CH4');
    expect(formatComposition(['Na', 'Cl'])).to.equal('ClNa');
  });
});
