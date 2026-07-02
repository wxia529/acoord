import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { GJFParser } from '../../../io/parsers/gjfParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('GJF Parser', () => {
  const parser = new GJFParser();

  const METHANE_GJF = `#P B3LYP/6-31G*

methane

0 1
C  0.000  0.000  0.000
H  0.631  0.631  0.631
H -0.631 -0.631  0.631
H -0.631  0.631 -0.631
H  0.631 -0.631 -0.631

`;

  it('should parse atoms from GJF file', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.atoms).to.have.lengthOf(5);
    expect(structure.atoms[0].element).to.equal('C');
    expect(structure.atoms[1].element).to.equal('H');
    expect(structure.isCrystal).to.be.false;
  });

  it('should parse coordinates correctly', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.atoms[0].x).to.be.closeTo(0, 1e-6);
    expect(structure.atoms[1].x).to.be.closeTo(0.631, 1e-3);
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(METHANE_GJF);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(5);
    expect(reparsed.atoms[0].element).to.equal('C');
    expect(reparsed.atoms[0].x).to.be.closeTo(0, 1e-3);
  });

  it('should store charge and multiplicity in metadata', () => {
    const structure = parser.parse(METHANE_GJF);
    expect(structure.metadata.get('charge')).to.equal(0);
    expect(structure.metadata.get('multiplicity')).to.equal(1);
  });

  describe('fixture file round-trip (water.gjf)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.gjf'), 'utf-8');

    it('should parse correct atom count and elements', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
      const elements = structure.atoms.map(a => a.element);
      expect(elements).to.include('O');
      expect(elements).to.include('H');
    });

    it('should parse charge and multiplicity metadata', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.metadata.get('charge')).to.equal(0);
      expect(structure.metadata.get('multiplicity')).to.equal(1);
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
      
      const origLines = fixtureContent.split('\n');
      const serLines = serialized.split('\n');
      
      // Header lines should be preserved
      expect(serLines[0]).to.equal('%mem=2GB');
      expect(serLines[1]).to.equal('%nprocshared=8');
      expect(serLines[2]).to.contain('B3LYP/6-31G(d)');
      
      // Title should be preserved
      expect(serLines[4]).to.equal('Water molecule optimization');
    });
  });
  
  it('should preserve format on round-trip with header lines', () => {
    const gjfWithHeader = `%mem=4GB
%nprocshared=4
# B3LYP/6-31G(d) Opt Freq

Test molecule

0 1
C  0.000  0.000  0.000
H  0.631  0.631  0.631

`;
    const original = parser.parse(gjfWithHeader);
    const serialized = parser.serialize(original);
    
    const serLines = serialized.split('\n');
    expect(serLines[0]).to.equal('%mem=4GB');
    expect(serLines[1]).to.equal('%nprocshared=4');
    expect(serLines[2]).to.equal('# B3LYP/6-31G(d) Opt Freq');
  });

  it('should parse and round-trip Gaussian fixed atom flags', () => {
    const fixedAtomsGjf = `#p opt freq b3lyp/genecp nosymm em=gd3

Ga2

3 1
 Ga              -1    0.07039088    1.51823649    0.06441387
 Ga               0    0.06590553   -1.44565200    0.02305732
 O               -1    2.08191535    1.18864545   -0.03891934

`;
    const structure = parser.parse(fixedAtomsGjf);

    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms.map((atom) => atom.fixed)).to.deep.equal([true, false, true]);
    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, false, false]);
    expect(structure.atoms[1].selectiveDynamics).to.deep.equal([true, true, true]);
    expect(structure.atoms[0].x).to.be.closeTo(0.07039088, 1e-6);

    const serialized = parser.serialize(structure);
    expect(serialized).to.match(/Ga\s+-1\s+0\.0703908800/);
    expect(serialized).to.match(/Ga\s+0\s+0\.0659055300/);

    const reparsed = parser.parse(serialized);
    expect(reparsed.atoms.map((atom) => atom.fixed)).to.deep.equal([true, false, true]);
  });

  it('should write freeze codes when an atom is marked fixed', () => {
    const structure = parser.parse(METHANE_GJF);
    structure.atoms[0].fixed = true;
    structure.atoms[0].selectiveDynamics = [false, false, false];

    const serialized = parser.serialize(structure);
    expect(serialized).to.match(/C\s+-1\s+0\.0000000000/);
    expect(serialized).to.match(/H\s+0\s+0\.6310000000/);
  });
});
