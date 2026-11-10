import { expect } from 'chai';
import {
  STRUParser,
  collectStruSpeciesLabels,
  getStruAtomSpeciesLabel,
} from '../../../io/parsers/struParser.js';
import {
  buildBssePlan,
  detectBsseFragments,
  formatComposition,
} from '../../../io/abacus/bsseGenerator.js';
import { buildBsseFileSet } from '../../../io/abacus/bsseSetWriter.js';
import { createDefaultInput } from '../../../io/abacus/abacusPresets.js';

// Water on a Cu dimer, with the fragments spelled out by the species labels.
const LABELLED_STRU = `ATOMIC_SPECIES
O_water  15.999  O_ONCV_PBE-1.0.upf
H_water   1.008  H_ONCV_PBE-1.0.upf
Cu_surf  63.546  Cu_ONCV_PBE-1.0.upf

NUMERICAL_ORBITAL
O_gga_6au_60Ry_2s2p1d.orb
H_gga_8au_60Ry_2s1p.orb
Cu_gga_7au_60Ry_2s2p2d1f.orb

LATTICE_CONSTANT
1.889726

LATTICE_VECTORS
   20.0 0.0 0.0
   0.0 20.0 0.0
   0.0 0.0 20.0

ATOMIC_POSITIONS
Direct

O_water
0.0
1
  0.50 0.50 0.55

H_water
0.0
2
  0.53 0.50 0.53
  0.47 0.50 0.53

Cu_surf
0.0
2
  0.45 0.50 0.45
  0.55 0.50 0.45
`;

const SPECIES_ROW = (label: string): RegExp =>
  new RegExp(`^${label}[ \\t]+\\S+[ \\t]+(\\S+)$`, 'm');

describe('BSSE fragments defined inside the structure file', () => {
  const parser = new STRUParser();
  const structure = parser.parse(LABELLED_STRU);

  it('should keep the species label of real atoms', () => {
    expect(structure.atoms.map((atom) => atom.sourceLabel)).to.deep.equal([
      'O_water',
      'H_water',
      'H_water',
      'Cu_surf',
      'Cu_surf',
    ]);
    expect(structure.atoms.map((atom) => getStruAtomSpeciesLabel(atom))).to.deep.equal([
      'O_water',
      'H_water',
      'H_water',
      'Cu_surf',
      'Cu_surf',
    ]);
  });

  it('should build one fragment per species label', () => {
    const fragments = detectBsseFragments(structure, 'species');
    expect(fragments.map((fragment) => fragment.name)).to.deep.equal([
      'O_water',
      'H_water',
      'Cu_surf',
    ]);
    expect(fragments.map((fragment) => fragment.atomIds.length)).to.deep.equal([1, 2, 2]);
  });

  it('should keep the parent pseudopotential and orbital of an empty species', () => {
    const plan = buildBssePlan(structure, { mode: 'species' });
    expect(plan).to.have.lengthOf(4);
    const files = buildBsseFileSet({
      plan,
      inputTemplate: createDefaultInput({ kind: 'scf' }),
      title: 'water on Cu',
    });
    const stru0 = files.find((file) => file.name === 'STRU_0')?.content ?? '';
    const stru1 = files.find((file) => file.name === 'STRU_1')?.content ?? '';

    expect(stru1).to.contain('O_water');
    expect(stru1).to.contain('H_water_empty');
    expect(stru1).to.contain('Cu_surf_empty');

    // the empty row copies the pseudopotential of the parent species row
    const parent = SPECIES_ROW('Cu_surf').exec(stru0);
    const ghost = SPECIES_ROW('Cu_surf_empty').exec(stru1);
    expect(parent).to.not.equal(null);
    expect(ghost?.[1]).to.equal(parent?.[1]);
    expect(stru1).to.contain('H_gga_8au_60Ry_2s1p.orb');
    expect(stru1).to.contain('Cu_gga_7au_60Ry_2s2p2d1f.orb');
    expect(files.find((file) => file.name === 'INPUT_1')?.content).to.match(/ntype\s+3/);
  });

  it('should honour hand picked groups', () => {
    const water = structure.atoms.slice(0, 3).map((atom) => atom.id);
    const copper = structure.atoms.slice(3).map((atom) => atom.id);
    const groups = [
      { name: 'water', atomIds: water },
      { name: 'surface', atomIds: copper },
    ];
    const fragments = detectBsseFragments(structure, 'custom', groups);
    expect(fragments.map((fragment) => fragment.name)).to.deep.equal(['water', 'surface']);
    expect(fragments.map((fragment) => fragment.atomIds.length)).to.deep.equal([3, 2]);

    const plan = buildBssePlan(structure, { mode: 'custom', customGroups: groups });
    expect(plan).to.have.lengthOf(3);
    expect(plan[1].name).to.equal('water');
    const ghostIds = plan[1].structure.atoms
      .filter((atom) => atom.role === 'ghost')
      .map((atom) => atom.id);
    expect(ghostIds.sort()).to.deep.equal([...copper].sort());
  });

  it('should round trip species labels without merging them', () => {
    const saved = parser.serialize(structure);
    expect(saved).to.contain('O_water');
    expect(saved).to.contain('Cu_surf');
    const reread = parser.parse(saved);
    expect(collectStruSpeciesLabels(reread)).to.deep.equal(['O_water', 'H_water', 'Cu_surf']);
  });

  it('should name unnamed groups after their composition', () => {
    const water = structure.atoms.slice(0, 3).map((atom) => atom.id);
    const copper = structure.atoms.slice(3).map((atom) => atom.id);
    const fragments = detectBsseFragments(structure, 'custom', [
      { atomIds: water },
      { atomIds: copper },
    ]);
    expect(fragments.map((fragment) => fragment.name)).to.deep.equal(['H2O', 'Cu2']);
    expect(formatComposition(['H', 'H', 'O'])).to.equal('H2O');
  });
});
