import { describe, it } from 'mocha';
import { expect } from 'chai';
import { SIESTAParser } from '../../../io/parsers/siestaParser.js';
import { Structure } from '../../../models/structure.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('SIESTAParser', () => {
  const parser = new SIESTAParser();
  const fixturePath = join(__dirname, '../../fixtures/water.fdf');
  const fixtureContent = readFileSync(fixturePath, 'utf-8');

  describe('parse', () => {
    it('should parse water.fdf with 3 atoms', () => {
      const structure = parser.parse(fixtureContent);

      expect(structure.atoms.length).to.equal(3);
      expect(structure.isCrystal).to.be.true;
      expect(structure.name).to.equal('Water');
    });

    it('should parse unit cell correctly', () => {
      const structure = parser.parse(fixtureContent);

      expect(structure.unitCell).to.not.be.undefined;
      if (structure.unitCell) {
        const params = structure.unitCell.getParameters();
        
        expect(params[0]).to.be.closeTo(15.0, 0.01);
        expect(params[1]).to.be.closeTo(15.0, 0.01);
        expect(params[2]).to.be.closeTo(15.0, 0.01);
        expect(params[3]).to.be.closeTo(90.0, 0.1);
        expect(params[4]).to.be.closeTo(90.0, 0.1);
        expect(params[5]).to.be.closeTo(90.0, 0.1);
      }
    });

    it('should parse all 2 species correctly', () => {
      const structure = parser.parse(fixtureContent);

      const elements = new Set(structure.atoms.map((atom) => atom.element));
      expect(elements.size).to.equal(2);
      expect(elements.has('O')).to.be.true;
      expect(elements.has('H')).to.be.true;
    });

    it('should assign correct atom count per element', () => {
      const structure = parser.parse(fixtureContent);

      const counts: Record<string, number> = {};
      for (const atom of structure.atoms) {
        counts[atom.element] = (counts[atom.element] || 0) + 1;
      }

      expect(counts['O']).to.equal(1);
      expect(counts['H']).to.equal(2);
    });

    it('should convert fractional coordinates to cartesian', () => {
      const structure = parser.parse(fixtureContent);

      const oxygen = structure.atoms[0];
      expect(oxygen.element).to.equal('O');
      expect(oxygen.x).to.be.closeTo(7.5, 0.01);
      expect(oxygen.y).to.be.closeTo(7.5, 0.01);
      expect(oxygen.z).to.be.closeTo(7.5, 0.01);

      const hydrogen1 = structure.atoms[1];
      expect(hydrogen1.element).to.equal('H');
      expect(hydrogen1.x).to.be.closeTo(8.0625, 0.01);
      expect(hydrogen1.y).to.be.closeTo(7.5, 0.01);
      expect(hydrogen1.z).to.be.closeTo(10.125, 0.01);
    });

    it('should assign colors and radii to atoms', () => {
      const structure = parser.parse(fixtureContent);

      for (const atom of structure.atoms) {
        expect(atom.color).to.match(/^#[0-9A-F]{6}$/i);
        expect(atom.radius).to.be.greaterThan(0);
      }
    });

    it('should throw on empty input', () => {
      expect(() => parser.parse('')).to.throw('SIESTAParser: empty input');
    });

    it('should throw on missing ChemicalSpeciesLabel', () => {
      const invalidContent = `SystemName  Test
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      expect(() => parser.parse(invalidContent)).to.throw(
        'SIESTAParser: missing %block ChemicalSpeciesLabel'
      );
    });

    it('should throw on missing LatticeVectors', () => {
      const invalidContent = `SystemName  Test
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      expect(() => parser.parse(invalidContent)).to.throw(
        'SIESTAParser: missing %block LatticeVectors or LatticeParameters'
      );
    });

    it('should throw on missing AtomicCoordinatesAndAtomicSpecies', () => {
      const invalidContent = `SystemName  Test
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
`;
      expect(() => parser.parse(invalidContent)).to.throw(
        'SIESTAParser: missing %block AtomicCoordinatesAndAtomicSpecies'
      );
    });

    it('should throw on undefined species index', () => {
      const invalidContent = `SystemName  Test
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  99
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      expect(() => parser.parse(invalidContent)).to.throw(
        'SIESTAParser: undefined species index 99'
      );
    });
  });

  describe('serialize', () => {
    it('should serialize and round-trip preserve atom data', () => {
      const structure = parser.parse(fixtureContent);
      const serialized = parser.serialize(structure);
      const structure2 = parser.parse(serialized);

      expect(structure2.atoms.length).to.equal(structure.atoms.length);
      expect(structure2.name).to.equal(structure.name);

      for (let i = 0; i < structure.atoms.length; i++) {
        const a1 = structure.atoms[i];
        const a2 = structure2.atoms[i];
        expect(a1.element).to.equal(a2.element);
        expect(a1.x).to.be.closeTo(a2.x, 1e-4);
        expect(a1.y).to.be.closeTo(a2.y, 1e-4);
        expect(a1.z).to.be.closeTo(a2.z, 1e-4);
      }
    });

    it('should preserve non-block content during serialization', () => {
      const structure = parser.parse(fixtureContent);
      const serialized = parser.serialize(structure);

      expect(serialized).to.include('SystemName          Water');
      expect(serialized).to.include('XC.functional          GGA');
      expect(serialized).to.include('XC.authors             PBE');
      expect(serialized).to.include('Mesh.Cutoff            300.0 Ry');
      expect(serialized).to.include('kgrid_Monkhorst_Pack    1  1  1');
    });

    it('should generate default FDF when no raw content saved', () => {
      const structure = parser.parse(fixtureContent);
      structure.metadata.delete('fdfRawContent');

      const serialized = parser.serialize(structure);
      const structure2 = parser.parse(serialized);

      expect(structure2.atoms.length).to.equal(structure.atoms.length);
      expect(structure2.unitCell).to.not.be.undefined;
    });

    it('should use default SystemName if not provided', () => {
      const content = `%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);
      expect(structure.name).to.equal('SIESTA Structure');
    });

    it('should throw on empty structure', () => {
      const structure = new Structure('Test');
      expect(() => parser.serialize(structure)).to.throw(
        'SIESTAParser: cannot serialize empty structure'
      );
    });
  });

  describe('LatticeParameters support', () => {
    it('should parse LatticeParameters format', () => {
      const content = `SystemName  Test
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
LatticeParameters  10.0  10.0  10.0  90.0  90.0  90.0
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      expect(structure.unitCell).to.not.be.undefined;
      if (structure.unitCell) {
        const vectors = structure.unitCell.getLatticeVectors();
        expect(vectors[0][0]).to.be.closeTo(10.0, 1e-6);
        expect(vectors[1][1]).to.be.closeTo(10.0, 1e-6);
        expect(vectors[2][2]).to.be.closeTo(10.0, 1e-6);
      }
    });

    it('should throw on invalid gamma angle', () => {
      const content = `SystemName  Test
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
LatticeParameters  10.0  10.0  10.0  90.0  90.0  0.0
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      expect(() => parser.parse(content)).to.throw(
        'SIESTAParser: invalid LatticeParameters - gamma must not be 0° or 180°'
      );
    });

    it('should apply LatticeConstant scaling to LatticeVectors', () => {
      const content = `SystemName  Test
LatticeConstant  2.0 Ang
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  5.0  0.0  0.0
  0.0  5.0  0.0
  0.0  0.0  5.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      if (structure.unitCell) {
        const vectors = structure.unitCell.getLatticeVectors();
        expect(vectors[0][0]).to.be.closeTo(10.0, 1e-6);
        expect(vectors[1][1]).to.be.closeTo(10.0, 1e-6);
        expect(vectors[2][2]).to.be.closeTo(10.0, 1e-6);
      }
    });
  });

  describe('Coordinate format support', () => {
    it('should parse Ang coordinate format', () => {
      const content = `SystemName  Test
AtomicCoordinatesFormat  Ang
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  5.0  5.0  5.0  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      const atom = structure.atoms[0];
      expect(atom.x).to.be.closeTo(5.0, 1e-6);
      expect(atom.y).to.be.closeTo(5.0, 1e-6);
      expect(atom.z).to.be.closeTo(5.0, 1e-6);
    });

    it('should parse Bohr coordinate format', () => {
      const content = `SystemName  Test
AtomicCoordinatesFormat  Bohr
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  1.0  1.0  1.0  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      const bohrToAng = 0.529177210903;
      const atom = structure.atoms[0];
      expect(atom.x).to.be.closeTo(1.0 * bohrToAng, 1e-6);
      expect(atom.y).to.be.closeTo(1.0 * bohrToAng, 1e-6);
      expect(atom.z).to.be.closeTo(1.0 * bohrToAng, 1e-6);
    });

    it('should parse Fractional coordinate format', () => {
      const content = `SystemName  Test
AtomicCoordinatesFormat  Fractional
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      const atom = structure.atoms[0];
      expect(atom.x).to.be.closeTo(5.0, 1e-6);
      expect(atom.y).to.be.closeTo(5.0, 1e-6);
      expect(atom.z).to.be.closeTo(5.0, 1e-6);
    });

    it('should parse ScaledCartesian coordinate format', () => {
      const content = `SystemName  Test
LatticeConstant  2.0 Ang
AtomicCoordinatesFormat  ScaledCartesian
%block ChemicalSpeciesLabel
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  2.5  2.5  2.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      const atom = structure.atoms[0];
      expect(atom.x).to.be.closeTo(2.5 * 2.0, 1e-6);
      expect(atom.y).to.be.closeTo(2.5 * 2.0, 1e-6);
      expect(atom.z).to.be.closeTo(2.5 * 2.0, 1e-6);
    });
  });

  describe('Comment handling', () => {
    it('should handle inline comments', () => {
      const content = `SystemName  Test  # This is a comment
%block ChemicalSpeciesLabel
  1  6   C  # Carbon
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  10.0  0.0  0.0  # a vector
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  0.5  0.5  0.5  1  # First atom
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      expect(structure.name).to.equal('Test');
      expect(structure.atoms.length).to.equal(1);
      expect(structure.atoms[0].element).to.equal('C');
    });

    it('should handle comment-only lines', () => {
      const content = `# This is a comment
SystemName  Test
# Another comment
%block ChemicalSpeciesLabel
  # Species definition
  1  6   C
%endblock ChemicalSpeciesLabel
%block LatticeVectors
  # Lattice vectors
  10.0  0.0  0.0
  0.0  10.0  0.0
  0.0  0.0  10.0
%endblock LatticeVectors
%block AtomicCoordinatesAndAtomicSpecies
  # Atomic positions
  0.5  0.5  0.5  1
%endblock AtomicCoordinatesAndAtomicSpecies
`;
      const structure = parser.parse(content);

      expect(structure.atoms.length).to.equal(1);
    });
  });
});
