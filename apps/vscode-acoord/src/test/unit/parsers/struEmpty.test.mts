import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Atom } from '../../../models/atom.js';
import { Structure } from '../../../models/structure.js';
import {
  STRUParser,
  baseElementFromSpeciesLabel,
  collectStruSpeciesLabels,
  getStruSpeciesLabel,
  isGhostSpeciesLabel,
} from '../../../io/parsers/struParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures/bsse_water');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

describe('STRU empty (ghost) species', () => {
  const parser = new STRUParser();

  describe('label helpers', () => {
    it('should detect the empty suffix', () => {
      expect(isGhostSpeciesLabel('H_empty')).to.equal(true);
      expect(isGhostSpeciesLabel('O_empty')).to.equal(true);
      expect(isGhostSpeciesLabel('H_empty_2')).to.equal(true);
      expect(isGhostSpeciesLabel('H')).to.equal(false);
      expect(isGhostSpeciesLabel('O1')).to.equal(false);
    });

    it('should resolve the base element of an empty label', () => {
      expect(baseElementFromSpeciesLabel('H_empty_2')).to.equal('H');
      expect(baseElementFromSpeciesLabel('O_empty')).to.equal('O');
      expect(baseElementFromSpeciesLabel('Si')).to.equal('Si');
      expect(baseElementFromSpeciesLabel('empty')).to.equal(undefined);
    });

    it('should give ghost atoms the _empty suffix', () => {
      const real = new Atom('H', 0, 0, 0);
      const ghost = new Atom('O', 0, 0, 0, undefined, { role: 'ghost' });
      const labelled = new Atom('O', 0, 0, 0, undefined, { role: 'ghost', sourceLabel: 'O_empty_3' });

      expect(getStruSpeciesLabel(real)).to.equal('H');
      expect(getStruSpeciesLabel(ghost)).to.equal('O_empty');
      expect(getStruSpeciesLabel(labelled)).to.equal('O_empty_3');
    });
  });

  describe('parsing', () => {
    it('should parse H_empty blocks as ghost centres', () => {
      const structure = parser.parse(fixture('STRU_1'));

      expect(structure.atoms).to.have.lengthOf(3);
      const ghosts = structure.atoms.filter((atom) => atom.role === 'ghost');
      expect(ghosts).to.have.lengthOf(2);
      expect(ghosts.map((atom) => atom.element)).to.deep.equal(['H', 'H']);
      expect(ghosts[0].sourceLabel).to.equal('H_empty');
      expect(structure.atoms[2].role).to.equal('real');
      expect(structure.atoms[2].element).to.equal('O');
      expect(structure.unitCell).to.not.equal(undefined);
    });

    it('should keep numbered empty labels separate from real species', () => {
      const structure = parser.parse(fixture('STRU_2'));

      expect(collectStruSpeciesLabels(structure)).to.deep.equal(['H', 'H_empty_2', 'O_empty']);
      expect(structure.atoms.map((atom) => atom.role)).to.deep.equal(['real', 'ghost', 'ghost']);
      expect(structure.atoms[1].sourceLabel).to.equal('H_empty_2');
    });

    it('should round-trip every official BSSE STRU file', () => {
      for (const name of ['STRU_0', 'STRU_1', 'STRU_2', 'STRU_3']) {
        const original = parser.parse(fixture(name));
        const labels = collectStruSpeciesLabels(original);
        const serialized = parser.serialize(original);
        const reparsed = parser.parse(serialized);

        expect(reparsed.atoms, name).to.have.lengthOf(original.atoms.length);
        expect(collectStruSpeciesLabels(reparsed), name).to.deep.equal(labels);
        expect(reparsed.atoms.map((atom) => atom.role), name)
          .to.deep.equal(original.atoms.map((atom) => atom.role));
      }
    });

    it('should keep the number of species rows equal to ntype', () => {
      const structure = parser.parse(fixture('STRU_3'));
      const serialized = parser.serialize(structure);
      const lines = serialized.split('\n');

      const trimmed = lines.map((line) => line.trim());
      const speciesStart = trimmed.indexOf('ATOMIC_SPECIES');
      const orbitalStart = trimmed.indexOf('NUMERICAL_ORBITAL');
      const rows = trimmed
        .slice(speciesStart + 1, orbitalStart)
        .filter((line) => line && !/^\d+$/.test(line));

      expect(rows).to.have.lengthOf(collectStruSpeciesLabels(structure).length);
      expect(rows.map((line) => line.split(/\s+/)[0])).to.deep.equal(['H_empty_1', 'H', 'O_empty']);
    });
  });

  describe('serializing editor-created ghosts', () => {
    it('should write _empty for an atom marked as ghost', () => {
      const structure = parser.parse(fixture('STRU_0'));
      structure.atoms[1].role = 'ghost';
      structure.atoms[1].sourceLabel = undefined;

      const serialized = parser.serialize(structure);

      expect(serialized).to.match(/H_empty\s+1\.008\s+H_ONCV_PBE-1\.0\.upf/);
      expect(serialized).to.match(/^\s*H_empty\s*$/m);
      const reparsed = parser.parse(serialized);
      expect(reparsed.atoms.filter((atom) => atom.role === 'ghost')).to.have.lengthOf(1);
      expect(collectStruSpeciesLabels(reparsed)).to.deep.equal(['H', 'H_empty', 'O']);
    });

    it('should inherit mass and pseudopotential rows for generated empty species', () => {
      const structure = parser.parse(fixture('STRU_0'));
      structure.metadata.delete('struRawContent');
      structure.atoms[1].role = 'ghost';
      structure.atoms[1].sourceLabel = undefined;

      const serialized = parser.serialize(structure);

      expect(serialized).to.match(/H_empty\s+1\.008\s+H_ONCV_PBE-1\.0\.upf/);
      expect(serialized).to.match(/O\s+15\.9994?\s+O_ONCV_PBE-1\.0\.upf/);
      expect(serialized.split('\n').filter((line) => line.endsWith('.orb'))).to.have.lengthOf(3);
    });

    it('should not move empty centres in a relaxation input', () => {
      const structure = new Structure('bsse');
      const real = new Atom('H', 0, 0, 0);
      real.fixed = true;
      const ghost = new Atom('O', 1, 0, 0, undefined, { role: 'ghost' });
      structure.addAtom(real);
      structure.addAtom(ghost);

      const serialized = parser.serialize(structure);
      const lines = serialized.split('\n').map((line) => line.trim());

      expect(lines).to.include('H');
      expect(lines).to.include('O_empty');
      expect(lines.some((line) => /0\.000000000000\s+0\.000000000000\s+0\.000000000000\s+0 0 0/.test(line)))
        .to.equal(true);
    });
  });
});
