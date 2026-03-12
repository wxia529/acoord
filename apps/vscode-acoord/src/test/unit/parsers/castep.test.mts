import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { CastepParser } from '../../../io/parsers/castepParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../fixtures');

describe('CastepParser', () => {
  const parser = new CastepParser();

  const CASTEP_CONTENT = `
**************************************************************************
**                                                                      **
**                          CASTEP CALCULATION                           **
**                                                                      **
**************************************************************************

Run started: 12-Mar-2026 10:00:00

Title: Test structure

**************************************************************************
Unit Cell
**************************************************************************
Real Lattice(A)
    10.000000    0.000000    0.000000
     0.000000   10.000000    0.000000
     0.000000    0.000000   10.000000

**************************************************************************
Cell Contents
**************************************************************************

Total number of ions in cell        =     3

Fractional coordinates of atoms
     x               y               z           Element
----------------------------------------------------------------------
  0.5000000000    0.5000000000    0.5000000000       O
  0.6000000000    0.5000000000    0.5000000000       H
  0.4500000000    0.5500000000    0.5000000000       H

Total time                   =          12.34 s
Calculation completed
`;

  it('should parse atoms from fractional coordinates block', () => {
    const structure = parser.parse(CASTEP_CONTENT);
    expect(structure.atoms).to.have.lengthOf(3);
    const elements = structure.atoms.map((a) => a.element);
    expect(elements).to.include('O');
    expect(elements.filter((e) => e === 'H')).to.have.lengthOf(2);
  });

  it('should parse lattice vectors', () => {
    const structure = parser.parse(CASTEP_CONTENT);
    expect(structure.isCrystal).to.be.true;
    expect(structure.unitCell).to.be.instanceOf(UnitCell);
    expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
    expect(structure.unitCell!.b).to.be.closeTo(10.0, 1e-3);
    expect(structure.unitCell!.c).to.be.closeTo(10.0, 1e-3);
  });

  it('should convert fractional to Cartesian coordinates', () => {
    const structure = parser.parse(CASTEP_CONTENT);
    const o = structure.atoms.find((a) => a.element === 'O')!;
    expect(o.x).to.be.closeTo(5.0, 1e-3);
    expect(o.y).to.be.closeTo(5.0, 1e-3);
    expect(o.z).to.be.closeTo(5.0, 1e-3);
  });

  it('should throw on serialize (read-only format)', () => {
    const structure = parser.parse(CASTEP_CONTENT);
    expect(() => parser.serialize(structure)).to.throw(/not supported/i);
  });

  it('should throw on empty content', () => {
    expect(() => parser.parse('')).to.throw(/no atom positions/i);
  });

  it('should throw on content without atom positions', () => {
    const invalid = `
Run started: 12-Mar-2026 10:00:00
Unit Cell
Total time = 12.34 s
`;
    expect(() => parser.parse(invalid)).to.throw(/no atom positions/i);
  });

  describe('fixture file (water.castep)', () => {
    const fixtureContent = readFileSync(join(FIXTURES, 'water.castep'), 'utf-8');

    it('should parse correct atom count', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.atoms).to.have.lengthOf(3);
    });

    it('should parse correct elements', () => {
      const structure = parser.parse(fixtureContent);
      const elements = structure.atoms.map((a) => a.element);
      expect(elements).to.include('O');
      expect(elements.filter((e) => e === 'H')).to.have.lengthOf(2);
    });

    it('should parse lattice vectors', () => {
      const structure = parser.parse(fixtureContent);
      expect(structure.isCrystal).to.be.true;
      expect(structure.unitCell).to.be.instanceOf(UnitCell);
      expect(structure.unitCell!.a).to.be.closeTo(10.0, 1e-3);
    });

    it('should parse positions within tolerance', () => {
      const structure = parser.parse(fixtureContent);
      const o = structure.atoms.find((a) => a.element === 'O')!;
      expect(o.x).to.be.closeTo(5.0, 1e-3);
      expect(o.y).to.be.closeTo(5.0, 1e-3);
      expect(o.z).to.be.closeTo(5.0, 1e-3);
    });
  });

  describe('custom species stripping', () => {
    const CUSTOM_SPECIES_CONTENT = `
Run started: 12-Mar-2026 10:00:00
Unit Cell
Real Lattice(A)
    10.000000    0.000000    0.000000
     0.000000   10.000000    0.000000
     0.000000    0.000000   10.000000

Total number of ions in cell = 2

Fractional coordinates of atoms
     x               y               z           Element
----------------------------------------------------------------------
  0.5000000000    0.5000000000    0.5000000000       Fe:1
  0.6000000000    0.6000000000    0.6000000000       O:custom

Total time = 12.34 s
Calculation completed
`;

    it('should strip custom species to base element', () => {
      const structure = parser.parse(CUSTOM_SPECIES_CONTENT);
      expect(structure.atoms).to.have.lengthOf(2);
      const elements = structure.atoms.map((a) => a.element);
      expect(elements).to.include('Fe');
      expect(elements).to.include('O');
    });
  });

  describe('multi-frame trajectory', () => {
    const TRAJECTORY_CONTENT = `
Run started: 12-Mar-2026 10:00:00
Unit Cell
Real Lattice(A)
    10.000000    0.000000    0.000000
     0.000000   10.000000    0.000000
     0.000000    0.000000   10.000000

Total number of ions in cell = 1

Fractional coordinates of atoms
     x               y               z           Element
----------------------------------------------------------------------
  0.1000000000    0.1000000000    0.1000000000       Si

BFGS: starting iteration 1

Fractional coordinates of atoms
     x               y               z           Element
----------------------------------------------------------------------
  0.1500000000    0.1500000000    0.1500000000       Si

BFGS: starting iteration 2

Fractional coordinates of atoms
     x               y               z           Element
----------------------------------------------------------------------
  0.2000000000    0.2000000000    0.2000000000       Si

Total time = 12.34 s
Calculation completed
`;

    it('should parse all frames from trajectory', () => {
      const frames = parser.parseTrajectory(TRAJECTORY_CONTENT);
      expect(frames).to.have.lengthOf(3);
    });

    it('should return last frame from parse()', () => {
      const structure = parser.parse(TRAJECTORY_CONTENT);
      expect(structure.atoms).to.have.lengthOf(1);
      const si = structure.atoms[0];
      expect(si.x).to.be.closeTo(2.0, 1e-3);
      expect(si.y).to.be.closeTo(2.0, 1e-3);
      expect(si.z).to.be.closeTo(2.0, 1e-3);
    });

    it('should have correct positions in each frame', () => {
      const frames = parser.parseTrajectory(TRAJECTORY_CONTENT);
      expect(frames[0].atoms[0].x).to.be.closeTo(1.0, 1e-3);
      expect(frames[1].atoms[0].x).to.be.closeTo(1.5, 1e-3);
      expect(frames[2].atoms[0].x).to.be.closeTo(2.0, 1e-3);
    });
  });

  describe('atom properties', () => {
    it('should assign color from BRIGHT_SCHEME', () => {
      const structure = parser.parse(CASTEP_CONTENT);
      const o = structure.atoms.find((a) => a.element === 'O')!;
      expect(o.color).to.match(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should assign radius from element data', () => {
      const structure = parser.parse(CASTEP_CONTENT);
      const o = structure.atoms.find((a) => a.element === 'O')!;
      expect(o.radius).to.be.greaterThan(0);
    });
  });
});
