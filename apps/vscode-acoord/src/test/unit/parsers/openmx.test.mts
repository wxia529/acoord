import { describe, it } from 'mocha';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Atom } from '../../../models/atom.js';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { OpenMXParser } from '../../../io/parsers/openmxParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('OpenMX Parser', () => {
  const parser = new OpenMXParser();
  const fixtureContent = readFileSync(join(FIXTURES, 'water.dat'), 'utf-8');

  it('should parse atom coordinates and unit cell from OpenMX input', () => {
    const structure = parser.parse(fixtureContent);

    expect(structure.name).to.equal('Water');
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.atoms).to.have.lengthOf(3);
    expect(structure.atoms[0].element).to.equal('O');
    expect(structure.atoms[0].x).to.be.closeTo(7.5, 1e-6);
    expect(structure.atoms[1].z).to.be.closeTo(10.125, 1e-6);
  });

  it('should assign colors and radii to atoms', () => {
    const structure = parser.parse(fixtureContent);

    for (const atom of structure.atoms) {
      expect(atom.color).to.match(/^#[0-9A-F]{6}$/i);
      expect(atom.radius).to.be.greaterThan(0);
    }
  });

  it('should parse Cartesian Angstrom coordinates', () => {
    const content = `System.Name Silicon
Atoms.SpeciesAndCoordinates.Unit Ang
<Atoms.SpeciesAndCoordinates
  1 Si 0.0 0.0 0.0 2.0 2.0
  2 Si 1.3575 1.3575 1.3575 2.0 2.0
Atoms.SpeciesAndCoordinates>
Atoms.UnitVectors.Unit Ang
<Atoms.UnitVectors
  2.715 2.715 0.0
  0.0 2.715 2.715
  2.715 0.0 2.715
Atoms.UnitVectors>`;

    const structure = parser.parse(content);

    expect(structure.atoms).to.have.lengthOf(2);
    expect(structure.atoms[1].x).to.be.closeTo(1.3575, 1e-6);
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should parse MD.Fixed.XYZ constraints', () => {
    const content = `System.Name Constrained
Atoms.SpeciesAndCoordinates.Unit Ang
<Atoms.SpeciesAndCoordinates
  1 O 0.0 0.0 0.0 3.0 3.0
  2 H 0.7 0.0 0.0 0.5 0.5
Atoms.SpeciesAndCoordinates>
Atoms.UnitVectors.Unit Ang
<Atoms.UnitVectors
  10.0 0.0 0.0
  0.0 10.0 0.0
  0.0 0.0 10.0
Atoms.UnitVectors>
<MD.Fixed.XYZ
  1  1 1 1
  2  1 0 0
MD.Fixed.XYZ>`;

    const structure = parser.parse(content);

    expect(structure.atoms[0].fixed).to.equal(true);
    expect(structure.atoms[0].selectiveDynamics).to.deep.equal([false, false, false]);
    expect(structure.atoms[1].fixed).to.equal(false);
    expect(structure.atoms[1].selectiveDynamics).to.deep.equal([false, true, true]);
  });

  it('should serialize default OpenMX input parameters', () => {
    const structure = new Structure('Water', true);
    structure.unitCell = new UnitCell(15, 15, 15, 90, 90, 90);
    structure.addAtom(new Atom('O', 7.5, 7.5, 7.5, undefined, { color: '#FF0000', radius: 0.5 }));
    structure.addAtom(new Atom('H', 8.0625, 7.5, 10.125, undefined, { color: '#FFFFFF', radius: 0.3 }));
    const serialized = parser.serialize(structure);

    expect(serialized).to.contain('System.Name                   Water');
    expect(serialized).to.contain('Atoms.SpeciesAndCoordinates.Unit   Ang');
    expect(serialized).to.contain('scf.energycutoff              220.0');
    expect(serialized).to.contain('scf.Kgrid');
    expect(serialized).to.contain('MD.Type                       nomd');
    expect(serialized).to.contain('Dos.fileout                   off');
    expect(serialized).to.not.contain('Band.Nkpath');
  });

  it('should preserve original OpenMX calculation parameters when saving parsed input', () => {
    const content = fixtureContent.replace(
      'scf.energycutoff              220.0',
      'scf.energycutoff              100.0'
    ) + '\nscf.maxIter                   250\n';
    const structure = parser.parse(content);
    structure.atoms[0].x += 0.25;

    const serialized = parser.serialize(structure);

    expect(serialized).to.contain('scf.energycutoff              100.0');
    expect(serialized).to.contain('scf.maxIter                   250');
    expect(serialized).to.not.contain('MD.Type                       nomd');
    expect(serialized).to.contain('      0.5166667');
  });

  it('should serialize MD.Fixed.XYZ constraints', () => {
    const structure = parser.parse(fixtureContent);
    structure.atoms[0].fixed = true;
    structure.atoms[0].selectiveDynamics = [false, false, false];
    structure.atoms[1].selectiveDynamics = [false, true, true];

    const serialized = parser.serialize(structure);

    expect(serialized).to.contain('<MD.Fixed.XYZ');
    expect(serialized).to.contain('     1  1 1 1');
    expect(serialized).to.contain('     2  1 0 0');
    expect(serialized).to.contain('     3  0 0 0');
    expect(serialized).to.contain('MD.Fixed.XYZ>');
  });

  it('should round-trip parse → serialize → parse', () => {
    const original = parser.parse(fixtureContent);
    const serialized = parser.serialize(original);
    const reparsed = parser.parse(serialized);

    expect(reparsed.atoms).to.have.lengthOf(original.atoms.length);
    expect(reparsed.atoms[0].element).to.equal(original.atoms[0].element);
    expect(reparsed.atoms[0].x).to.be.closeTo(original.atoms[0].x, 1e-6);
    expect(reparsed.unitCell).to.be.instanceOf(UnitCell);
  });

  it('should serialize a generated crystal structure', () => {
    const structure = new Structure('NaCl Cell', true);
    structure.unitCell = new UnitCell(5.64, 5.64, 5.64, 90, 90, 90);
    structure.addAtom(new Atom('Na', 0, 0, 0, undefined, { color: '#AB5CF2', radius: 0.5 }));
    structure.addAtom(new Atom('Cl', 2.82, 2.82, 2.82, undefined, { color: '#1FF01F', radius: 0.5 }));

    const serialized = parser.serialize(structure);

    expect(serialized).to.contain('System.Name                   NaCl_Cell');
    expect(serialized).to.contain('Na   Na9.0-s3p2d1   Na_PBE19');
    expect(serialized).to.contain('Cl   Cl7.0-s2p2d1f1   Cl_PBE19');
  });

  it('should throw on malformed input', () => {
    expect(() => parser.parse('System.Name Broken')).to.throw('OpenMXParser: missing <Atoms.UnitVectors block');
  });
});
