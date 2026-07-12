import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { ORCAParser } from '../../../io/parsers/orcaParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('ORCA Parser', () => {
  const parser = new ORCAParser();

  const WATER_ORCA = `! B3LYP def2-SVP
%maxcore 4096

* xyz 0 1
O   0.000   0.000   0.000
H   0.757   0.586   0.000
H  -0.757   0.586   0.000
*`;

  it('should parse atoms from * xyz block', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse charge and multiplicity', () => {
    const structure = parser.parse(WATER_ORCA);
    expect(structure.metadata.get('charge')).to.equal(0);
    expect(structure.metadata.get('multiplicity')).to.equal(1);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(WATER_ORCA);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(3);
    expect(reparsed.atoms[0].element).to.equal('O');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
    expect(reparsed.atoms[1].x).to.be.closeTo(0.757, 1e-3);
  });

  it('should throw on missing * xyz block', () => {
    expect(() => parser.parse('! just a comment\n')).to.throw(/missing/i);
  });

  describe('fixture file round-trip (water.orca)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.orca'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse charge and multiplicity metadata', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.metadata.get('charge')).to.equal(-1);
      expect(structure.metadata.get('multiplicity')).to.equal(2);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find(a => a.element === 'O')!;
      expect(o).to.not.be.undefined;
      expect(o.x).to.be.closeTo(0.0, 1e-3);
    });

    it('should serialize → re-parse preserving charge and multiplicity', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      const reparsed = parser.parse(serialized);

      expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
      expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
      expect(reparsed.metadata.get('charge')).to.equal(original.metadata.get('charge'));
      expect(reparsed.metadata.get('multiplicity')).to.equal(original.metadata.get('multiplicity'));
    });

    it('should preserve original header lines (format preservation)', () => {
      const original = parser.parse(fixtureContent);
      const serialized = parser.serialize(original);
      
      const serLines = serialized.split('\n');
      
      // Header lines should be preserved
      expect(serLines[0]).to.contain('!');  // Should start with !
      expect(serLines[1]).to.contain('%');  // Should contain %maxcore or similar
    });
  });
  
  it('should preserve format on round-trip with header lines', () => {
    const orcaWithHeader = `! PBE0 D3BJ def2-TZVP
%pal nprocs 4 end
%maxcore 8192

* xyz 0 1
O  0.000  0.000  0.000
H  0.757  0.586  0.000
*`;
    const original = parser.parse(orcaWithHeader);
    const serialized = parser.serialize(original);
    
    const serLines = serialized.split('\n');
    expect(serLines[0]).to.equal('! PBE0 D3BJ def2-TZVP');
    expect(serLines[1]).to.equal('%pal nprocs 4 end');
    expect(serLines[2]).to.equal('%maxcore 8192');
  });

  it('should parse and round-trip Cartesian atom constraints', () => {
    const constrainedOrca = `! B3LYP def2-SVP Opt
%geom Constraints
  { C 0 C }
  { C 2:3 C }
  { B 0 1 1.0 C }
end
end

* xyz 0 1
O  0.000  0.000  0.000
H  0.757  0.586  0.000
H -0.757  0.586  0.000
H  0.000 -0.586  0.757
*`;
    const structure = parser.parse(constrainedOrca);

    expect(structure.atoms.map((atom) => atom.fixed)).to.deep.equal([true, false, true, true]);
    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, false, false]);

    const serialized = parser.serialize(structure);
    expect(serialized).to.contain('{ C 0 C }');
    expect(serialized).to.contain('{ C 2:3 C }');
    expect(serialized).to.contain('{ B 0 1 1.0 C }');

    const reparsed = parser.parse(serialized);
    expect(reparsed.atoms.map((atom) => atom.fixed)).to.deep.equal([true, false, true, true]);
  });

  it('should preserve partial Cartesian constraints', () => {
    const constrainedOrca = `%geom
Constraints
  { X 1 C }
  { Z 1 C }
end
end
* xyz 0 1
H 0 0 0
H 0 0 1
*`;
    const structure = parser.parse(constrainedOrca);

    expect(structure.atoms[1].fixed).to.equal(false);
    expect(structure.atoms[1].selectiveDynamics).to.deep.equal([false, true, false]);
    const serialized = parser.serialize(structure);
    expect(serialized).to.contain('{ X 1 C }');
    expect(serialized).to.contain('{ Z 1 C }');
  });

  it('should add and remove fixed atom constraints without changing other geom settings', () => {
    const structure = parser.parse(WATER_ORCA);
    structure.atoms[1].fixed = true;
    structure.atoms[1].selectiveDynamics = [false, false, false];

    const constrained = parser.serialize(structure);
    expect(constrained).to.match(/%geom\s+Constraints\s+\{ C 1 C \}\s+end\s+end/i);

    const reparsed = parser.parse(constrained);
    reparsed.atoms[1].fixed = false;
    reparsed.atoms[1].selectiveDynamics = [true, true, true];
    const unconstrained = parser.serialize(reparsed);
    expect(unconstrained).to.not.contain('{ C 1 C }');
  });
});

describe('ORCA dummy atoms', () => {
  it('should parse and preserve DA, X, and Xx labels', () => {
    const parser = new ORCAParser();
    const input = '! HF\n* xyz 0 1\nDA 0 0 0\nX 0 0 1\nXx 0 0 2\n*';
    const structure = parser.parse(input);
    expect(structure.atoms.every((atom) => atom.role === 'dummy')).to.be.true;
    const serialized = parser.serialize(structure);
    expect(serialized).to.include('DA  ');
    expect(serialized).to.include('X  ');
    expect(serialized).to.include('Xx  ');
    expect(parser.parse(serialized).atoms).to.have.lengthOf(3);
  });
});

describe('ORCA ghost atoms', () => {
  it('should parse and round-trip H: centers', () => {
    const parser = new ORCAParser();
    const input = '! HF def2-SVP\n* xyz 0 1\nC 0 0 0\nH: 0 0 1\n*';
    const structure = parser.parse(input);
    expect(structure.atoms[1].role).to.equal('ghost');
    expect(structure.atoms[1].element).to.equal('H');
    expect(parser.serialize(structure)).to.include('H:  ');
  });

  it('should preserve an inline NewGTO basis after ghost coordinates', () => {
    const parser = new ORCAParser();
    const basis = 'NewGTO S 1 1 1e6 1 end';
    const input = `! HF\n* xyz 0 1\nH:   0.000000   0.000000   0.000000   ${basis}\n*`;
    const structure = parser.parse(input);

    expect(structure.atoms).to.have.lengthOf(1);
    expect(structure.atoms[0].role).to.equal('ghost');
    expect(structure.atoms[0].element).to.equal('H');

    const serialized = parser.serialize(structure);
    expect(serialized).to.include(basis);
    const reparsed = parser.parse(serialized);
    expect(reparsed.atoms).to.have.lengthOf(1);
    expect(reparsed.atoms[0].role).to.equal('ghost');
  });

  it('should preserve non-H ghost basis elements', () => {
    const parser = new ORCAParser();
    const input = '! HF def2-SVP\n* xyz 0 1\nC: 0 0 0\nO: 0 0 1\n*';
    const structure = parser.parse(input);
    expect(structure.atoms.map((atom) => atom.element)).to.deep.equal(['C', 'O']);
    const serialized = parser.serialize(structure);
    expect(serialized).to.include('C:  ');
    expect(serialized).to.include('O:  ');
  });
});

describe('ORCA point charges', () => {
  it('should parse and round-trip Q charge X Y Z entries', () => {
    const parser = new ORCAParser();
    const input = '! HF\n* xyz 0 1\nC 0 0 0\nQ -0.5000 3.000 0.000 0.000\n*';
    const structure = parser.parse(input);

    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[1].role).to.equal('dummy');
    expect(structure.atoms[1].sourceLabel).to.equal('Q');
    expect(structure.atoms[1].x).to.equal(3);

    const serialized = parser.serialize(structure);
    expect(serialized).to.match(/Q\s+-0\.5000\s+3\.0000000000\s+0\.0000000000\s+0\.0000000000/);
    const reparsed = parser.parse(serialized);
    expect(reparsed.atoms[1].sourceLabel).to.equal('Q');
    expect(reparsed.atoms[1].x).to.equal(3);
  });

  it('should reject a Q entry without all required fields', () => {
    const parser = new ORCAParser();
    const input = '! HF\n* xyz 0 1\nQ -0.5 1.0 2.0\n*';
    expect(() => parser.parse(input)).to.throw('point charge requires charge, X, Y, and Z values');
  });
});
