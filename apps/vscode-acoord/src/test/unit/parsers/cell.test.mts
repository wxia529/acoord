import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { CellParser } from '../../../io/parsers/cellParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('CellParser', () => {
  const parser = new CellParser();

  const BASIC_CELL = `%BLOCK LATTICE_CART ang
  10.0  0.0   0.0
  0.0   10.0  0.0
  0.0   0.0   10.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
H  0.6  0.6  0.5
H  0.4  0.6  0.5
%ENDBLOCK POSITIONS_FRAC`;

  describe('basic parsing', () => {
    it('should parse minimal .cell file', () => {
      const structure = parser.parse(BASIC_CELL);
      expect(structure.atoms).to.have.lengthOf(3);
      expect(structure.isCrystal).to.be.true;
    });

    it('should handle empty lines and comments', () => {
      const content = `# Comment at top

%BLOCK LATTICE_CART ang
  10.0  0.0   0.0  ! inline comment
  0.0   10.0  0.0  # another comment
  0.0   0.0   10.0
%ENDBLOCK LATTICE_CART

; semicolon comment
%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.atoms).to.have.lengthOf(1);
    });

    it('should be case-insensitive for keywords', () => {
      const content = `%block lattice_cart ang
  10.0  0.0   0.0
  0.0   10.0  0.0
  0.0   0.0   10.0
%endblock LATTICE_CART

%BLOCK positions_frac
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.atoms).to.have.lengthOf(1);
    });

    it('should throw on missing lattice block', () => {
      const content = `%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      expect(() => parser.parse(content)).to.throw('missing LATTICE_CART or LATTICE_ABC');
    });

    it('should throw on missing positions block', () => {
      const content = `%BLOCK LATTICE_CART ang
  10.0  0.0   0.0
  0.0   10.0  0.0
  0.0   0.0   10.0
%ENDBLOCK LATTICE_CART`;
      expect(() => parser.parse(content)).to.throw('missing POSITIONS_ABS or POSITIONS_FRAC');
    });

    it('should throw on empty input', () => {
      expect(() => parser.parse('')).to.throw('empty input');
      expect(() => parser.parse('   ')).to.throw('empty input');
    });
  });

  describe('lattice formats', () => {
    it('should parse LATTICE_CART with angstrom units', () => {
      const structure = parser.parse(BASIC_CELL);
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-6);
    });

    it('should parse LATTICE_ABC (lattice parameters)', () => {
      const content = `%BLOCK LATTICE_ABC ang
  4.35  4.35  4.35
  90.0  90.0  90.0
%ENDBLOCK LATTICE_ABC

%BLOCK POSITIONS_FRAC
Si  0.0  0.0  0.0
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.unitCell!.a).to.be.closeTo(4.35, 1e-6);
      expect(structure.unitCell!.alpha).to.be.closeTo(90.0, 1e-6);
    });

    it('should handle unitless LATTICE_CART (default angstrom)', () => {
      const content = `%BLOCK LATTICE_CART
  5.0  0.0  0.0
  0.0  5.0  0.0
  0.0  0.0  5.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.unitCell!.a).to.be.closeTo(5.0, 1e-6);
    });
  });

  describe('atom position formats', () => {
    it('should parse POSITIONS_ABS (Cartesian coordinates)', () => {
      const content = `%BLOCK LATTICE_CART ang
  10.0  0.0   0.0
  0.0   10.0  0.0
  0.0   0.0   10.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_ABS ang
O  5.0  5.0  5.0
H  6.0  6.0  5.0
%ENDBLOCK POSITIONS_ABS`;
      const structure = parser.parse(content);
      expect(structure.atoms).to.have.lengthOf(2);
      expect(structure.atoms[0].x).to.be.closeTo(5.0, 1e-6);
    });

    it('should parse POSITIONS_FRAC (fractional coordinates)', () => {
      const structure = parser.parse(BASIC_CELL);
      expect(structure.atoms[0].x).to.be.closeTo(5.0, 1e-6);
      expect(structure.atoms[0].y).to.be.closeTo(5.0, 1e-6);
      expect(structure.atoms[0].z).to.be.closeTo(5.0, 1e-6);
    });

    it('should convert fractional to Cartesian correctly', () => {
      const structure = parser.parse(BASIC_CELL);
      expect(structure.atoms[1].x).to.be.closeTo(6.0, 1e-6);
      expect(structure.atoms[1].y).to.be.closeTo(6.0, 1e-6);
      expect(structure.atoms[1].z).to.be.closeTo(5.0, 1e-6);
    });
  });

  describe('unit conversion', () => {
    it('should convert bohr to angstrom (CODATA 2018)', () => {
      const content = readFileSync(join(FIXTURES, 'sic_bohr.cell'), 'utf-8');
      const structure = parser.parse(content);
      const bohrToAng = 0.529177210903;
      expect(structure.unitCell!.a).to.be.closeTo(4.35 * bohrToAng, 1e-3);
    });

    it('should convert nm to angstrom', () => {
      const content = `%BLOCK LATTICE_CART nm
  1.0  0.0  0.0
  0.0  1.0  0.0
  0.0  0.0  1.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-6);
    });

    it('should handle unknown unit (fallback to angstrom)', () => {
      const content = `%BLOCK LATTICE_CART unknownunit
  5.0  0.0  0.0
  0.0  5.0  0.0
  0.0  0.0  5.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_FRAC
O  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC`;
      const structure = parser.parse(content);
      expect(structure.unitCell!.a).to.be.closeTo(5.0, 1e-6);
    });
  });

  describe('custom species', () => {
    it('should parse custom species (Fe:1, O:custom)', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms).to.have.lengthOf(3);
      expect(structure.atoms[0].element).to.equal('Si:1');
      expect(structure.atoms[2].element).to.equal('O:1');
    });

    it('should get correct color/radius for base element', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[0].color).to.equal('#E3B224');
      expect(structure.atoms[0].radius).to.be.closeTo(0.3885, 1e-3);
    });

    it('should preserve custom species on serialization', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);
      expect(reparsed.atoms[0].element).to.equal('Si:1');
    });

    it('should parse SPECIES_MASS block', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const structure = parser.parse(content);
      const speciesMass = structure.metadata.get('speciesMass') as Record<string, number>;
      expect(speciesMass).to.exist;
      expect(speciesMass['Si:1']).to.be.closeTo(28.0855, 1e-4);
    });
  });

  describe('ionic constraints', () => {
    it('should parse single atom constraint', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, false, true]);
    });

    it('should parse multiple constraints per atom (FixAtoms)', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, false, false]);
    });

    it('should map constraints to selectiveDynamics', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[2].selectiveDynamics).to.be.undefined;
    });

    it('should set fixed=true when all directions constrained', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[0].fixed).to.be.true;
      expect(structure.atoms[1].fixed).to.be.false;
    });

    it('should handle custom species in constraints', () => {
      const content = `%BLOCK LATTICE_CART ang
  5.0  0.0  0.0
  0.0  5.0  0.0
  0.0  0.0  5.0
%ENDBLOCK LATTICE_CART

%BLOCK POSITIONS_FRAC
Fe:1  0.0  0.0  0.0
Fe:1  0.5  0.5  0.5
%ENDBLOCK POSITIONS_FRAC

%BLOCK IONIC_CONSTRAINTS
1  Fe:1  1  1 0 0
%ENDBLOCK IONIC_CONSTRAINTS`;
      const structure = parser.parse(content);
      expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, true, true]);
    });
  });

  describe('metadata', () => {
    it('should extract SPIN values to metadata', () => {
      const content = readFileSync(join(FIXTURES, 'water.cell'), 'utf-8');
      const structure = parser.parse(content);
      const spin = structure.metadata.get('spin') as number[];
      expect(spin).to.deep.equal([0, 0.5, -0.5]);
    });

    it('should extract LABEL values to atom.label', () => {
      const content = readFileSync(join(FIXTURES, 'water.cell'), 'utf-8');
      const structure = parser.parse(content);
      expect(structure.atoms[1].label).to.equal('H1');
      expect(structure.atoms[2].label).to.equal('H2');
    });

    it('should preserve metadata on serialization', () => {
      const content = readFileSync(join(FIXTURES, 'water.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);
      
      const originalSpin = original.metadata.get('spin') as number[];
      const reparsedSpin = reparsed.metadata.get('spin') as number[];
      expect(reparsedSpin).to.deep.equal(originalSpin);
    });

    it('should handle missing optional metadata gracefully', () => {
      const structure = parser.parse(BASIC_CELL);
      const spin = structure.metadata.get('spin') as number[];
      expect(spin).to.deep.equal([0, 0, 0]);
    });
  });

  describe('round-trip', () => {
    it('should round-trip LATTICE_CART + POSITIONS_FRAC', () => {
      const original = parser.parse(BASIC_CELL);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(3);
      expect(reparsed.unitCell!.a).to.be.closeTo(original.unitCell!.a, 1e-3);
    });

    it('should round-trip custom species', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms[0].element).to.equal('Si:1');
      expect(reparsed.atoms[2].element).to.equal('O:1');
    });

    it('should round-trip IONIC_CONSTRAINTS', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms[0].selectiveDynamics).to.deep.equal([false, false, false]);
      expect(reparsed.atoms[0].fixed).to.be.true;
      expect(reparsed.atoms[1].selectiveDynamics).to.deep.equal([true, false, true]);
    });

    it('should round-trip SPIN and LABEL', () => {
      const content = readFileSync(join(FIXTURES, 'water.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms[1].label).to.equal('H1');
      expect(reparsed.atoms[2].label).to.equal('H2');
    });

    it('should preserve structure integrity after parse→serialize→parse', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms.length).to.equal(original.atoms.length);
      
      for (let i = 0; i < original.atoms.length; i++) {
        expect(reparsed.atoms[i].element).to.equal(original.atoms[i].element);
        expect(reparsed.atoms[i].x).to.be.closeTo(original.atoms[i].x, 1e-3);
        expect(reparsed.atoms[i].y).to.be.closeTo(original.atoms[i].y, 1e-3);
        expect(reparsed.atoms[i].z).to.be.closeTo(original.atoms[i].z, 1e-3);
      }
    });
  });

  describe('fixture file parsing', () => {
    it('should parse water.cell correctly', () => {
      const content = readFileSync(join(FIXTURES, 'water.cell'), 'utf-8');
      const structure = parser.parse(content);
      
      expect(structure.atoms).to.have.lengthOf(3);
      expect(structure.atoms[0].element).to.equal('O');
      expect(structure.atoms[1].element).to.equal('H');
      expect(structure.atoms[2].element).to.equal('H');
    });

    it('should parse sic_bohr.cell with unit conversion', () => {
      const content = readFileSync(join(FIXTURES, 'sic_bohr.cell'), 'utf-8');
      const structure = parser.parse(content);
      
      expect(structure.atoms).to.have.lengthOf(2);
      expect(structure.atoms[0].element).to.equal('Si');
      expect(structure.atoms[1].element).to.equal('C');
    });

    it('should parse custom_species.cell with custom species', () => {
      const content = readFileSync(join(FIXTURES, 'custom_species.cell'), 'utf-8');
      const structure = parser.parse(content);
      
      expect(structure.atoms).to.have.lengthOf(3);
      expect(structure.atoms[0].element).to.equal('Si:1');
    });

    it('should parse water_constraints.cell with constraints', () => {
      const content = readFileSync(join(FIXTURES, 'water_constraints.cell'), 'utf-8');
      const structure = parser.parse(content);
      
      expect(structure.atoms[0].fixed).to.be.true;
      expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, false, true]);
    });
  });

  describe('cell metadata preservation', () => {
    it('should parse single-line keywords', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const structure = parser.parse(content);
      const cellKeywords = structure.metadata.get('cellKeywords') as Record<string, string>;
      
      expect(cellKeywords).to.exist;
      expect(cellKeywords['kpoint_mp_grid']).to.equal('1 1 1');
      expect(cellKeywords['snap_to_symmetry']).to.equal('true');
    });

    it('should parse unparsed blocks', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const structure = parser.parse(content);
      const cellBlocks = structure.metadata.get('cellBlocks') as Record<string, string>;
      
      expect(cellBlocks).to.exist;
      expect(cellBlocks['species_pot']).to.equal('C19MK2');
    });

    it('should round-trip cell metadata', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);
      
      const originalKeywords = original.metadata.get('cellKeywords') as Record<string, string>;
      const reparsedKeywords = reparsed.metadata.get('cellKeywords') as Record<string, string>;
      
      expect(reparsedKeywords['kpoint_mp_grid']).to.equal(originalKeywords['kpoint_mp_grid']);
      expect(reparsedKeywords['snap_to_symmetry']).to.equal(originalKeywords['snap_to_symmetry']);
      
      const originalBlocks = original.metadata.get('cellBlocks') as Record<string, string>;
      const reparsedBlocks = reparsed.metadata.get('cellBlocks') as Record<string, string>;
      
      expect(reparsedBlocks['species_pot']).to.equal(originalBlocks['species_pot']);
    });

    it('should preserve structure with metadata', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const structure = parser.parse(content);
      
      expect(structure.atoms).to.have.lengthOf(1);
      expect(structure.atoms[0].element).to.equal('Si');
      expect(structure.unitCell).to.exist;
    });

    it('should serialize keywords with proper format', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      
      expect(serialized).to.include('KPOINT_MP_GRID: 1 1 1');
      expect(serialized).to.include('SNAP_TO_SYMMETRY: true');
    });

    it('should serialize blocks with proper format', () => {
      const content = readFileSync(join(FIXTURES, 'metadata.cell'), 'utf-8');
      const original = parser.parse(content);
      const serialized = parser.serialize(original);
      
      expect(serialized).to.include('%BLOCK SPECIES_POT');
      expect(serialized).to.include('C19MK2');
      expect(serialized).to.include('%ENDBLOCK SPECIES_POT');
    });
  });
});
