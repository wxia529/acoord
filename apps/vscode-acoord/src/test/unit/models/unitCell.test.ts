import { expect } from 'chai';
import { UnitCell } from '../../models/unitCell';

describe('UnitCell', () => {
  describe('Basic Unit Cell Creation', () => {
    it('should create default cubic unit cell', () => {
      const cell = new UnitCell();
      expect(cell.a).to.equal(1);
      expect(cell.b).to.equal(1);
      expect(cell.c).to.equal(1);
      expect(cell.alpha).to.equal(90);
      expect(cell.beta).to.equal(90);
      expect(cell.gamma).to.equal(90);
    });

    it('should create custom unit cell', () => {
      const cell = new UnitCell(5, 6, 7, 80, 90, 100);
      expect(cell.a).to.equal(5);
      expect(cell.b).to.equal(6);
      expect(cell.c).to.equal(7);
      expect(cell.alpha).to.equal(80);
      expect(cell.beta).to.equal(90);
      expect(cell.gamma).to.equal(100);
    });
  });

  describe('getLatticeVectors', () => {
    it('should calculate lattice vectors for cubic cell', () => {
      const cell = new UnitCell(2, 2, 2, 90, 90, 90);
      const vectors = cell.getLatticeVectors();

      expect(vectors).to.have.lengthOf(3);

      const [a, b, c] = vectors;

      expect(a[0]).to.be.closeTo(2, 0.01);
      expect(a[1]).to.be.closeTo(0, 0.01);
      expect(a[2]).to.be.closeTo(0, 0.01);

      expect(b[0]).to.be.closeTo(0, 0.01);
      expect(b[1]).to.be.closeTo(2, 0.01);
      expect(b[2]).to.be.closeTo(0, 0.01);

      expect(c[0]).to.be.closeTo(0, 0.01);
      expect(c[1]).to.be.closeTo(0, 0.01);
      expect(c[2]).to.be.closeTo(2, 0.01);
    });

    it('should calculate lattice vectors for hexagonal cell', () => {
      const cell = new UnitCell(2, 2, 4, 90, 90, 120);
      const vectors = cell.getLatticeVectors();

      const [a, b, c] = vectors;

      expect(a[0]).to.be.closeTo(2, 0.01);
      expect(b[0]).to.be.closeTo(-1, 0.01);
      expect(b[1]).to.be.closeTo(Math.sqrt(3), 0.01);
      expect(c[2]).to.be.closeTo(4, 0.01);
    });

    it('should calculate lattice vectors for triclinic cell', () => {
      const cell = new UnitCell(5, 6, 7, 80, 90, 100);
      const vectors = cell.getLatticeVectors();

      expect(vectors).to.have.lengthOf(3);

      const [a, b, c] = vectors;
      expect(a[0]).to.be.closeTo(5, 0.01);

      const bLength = Math.sqrt(b[0]**2 + b[1]**2 + b[2]**2);
      const cLength = Math.sqrt(c[0]**2 + c[1]**2 + c[2]**2);
      expect(bLength).to.be.closeTo(6, 0.01);
      expect(cLength).to.be.closeTo(7, 0.01);
    });

    it('should throw error for degenerate angles (0 degrees)', () => {
      const cell = new UnitCell(1, 1, 1, 0, 90, 90);

      expect(() => {
        cell.getLatticeVectors();
      }).to.throw(/Invalid unit cell parameters/);
    });

    it('should throw error for degenerate angles (180 degrees)', () => {
      const cell = new UnitCell(1, 1, 1, 180, 90, 90);

      expect(() => {
        cell.getLatticeVectors();
      }).to.throw(/Invalid unit cell parameters/);
    });

    it('should throw error for impossible geometry', () => {
      const cell = new UnitCell(1, 1, 1, 179, 179, 179);

      expect(() => {
        cell.getLatticeVectors();
      }).to.throw(/Invalid unit cell parameters/);
    });
  });

  describe('fromVectors', () => {
    it('should create unit cell from lattice vectors', () => {
      const vectors = [
        [2, 0, 0],
        [0, 2, 0],
        [0, 0, 2]
      ];

      const cell = UnitCell.fromVectors(vectors);

      expect(cell.a).to.be.closeTo(2, 0.01);
      expect(cell.b).to.be.closeTo(2, 0.01);
      expect(cell.c).to.be.closeTo(2, 0.01);
      expect(cell.alpha).to.be.closeTo(90, 0.01);
      expect(cell.beta).to.be.closeTo(90, 0.01);
      expect(cell.gamma).to.be.closeTo(90, 0.01);
    });

    it('should handle non-orthogonal vectors', () => {
      const vectors = [
        [2, 0, 0],
        [-1, Math.sqrt(3), 0],
        [0, 0, 4]
      ];

      const cell = UnitCell.fromVectors(vectors);

      expect(cell.a).to.be.closeTo(2, 0.01);
      expect(cell.b).to.be.closeTo(2, 0.01);
      expect(cell.c).to.be.closeTo(4, 0.01);
      expect(cell.alpha).to.be.closeTo(90, 0.01);
      expect(cell.beta).to.be.closeTo(90, 0.01);
      expect(cell.gamma).to.be.closeTo(120, 0.01);
    });
  });

  describe('getVolume', () => {
    it('should calculate volume of cubic cell', () => {
      const cell = new UnitCell(3, 3, 3, 90, 90, 90);
      expect(cell.getVolume()).to.be.closeTo(27, 0.01);
    });

    it('should calculate volume of hexagonal cell', () => {
      const cell = new UnitCell(2, 2, 5, 90, 90, 120);
      const expectedVolume = 2 * 2 * 5 * Math.sin(120 * Math.PI / 180);
      expect(cell.getVolume()).to.be.closeTo(expectedVolume, 0.01);
    });

    it('should calculate volume of triclinic cell', () => {
      const cell = new UnitCell(5, 6, 7, 80, 85, 95);
      const volume = cell.getVolume();
      expect(volume).to.be.greaterThan(0);
    });
  });

  describe('cartesianToFractional', () => {
    it('should convert Cartesian to fractional coordinates', () => {
      const cell = new UnitCell(2, 2, 2, 90, 90, 90);

      const frac = cell.cartesianToFractional(1, 1, 1);

      expect(frac[0]).to.be.closeTo(0.5, 0.01);
      expect(frac[1]).to.be.closeTo(0.5, 0.01);
      expect(frac[2]).to.be.closeTo(0.5, 0.01);
    });
  });

  describe('fractionalToCartesian', () => {
    it('should convert fractional to Cartesian coordinates', () => {
      const cell = new UnitCell(2, 2, 2, 90, 90, 90);

      const cart = cell.fractionalToCartesian(0.5, 0.5, 0.5);

      expect(cart[0]).to.be.closeTo(1, 0.01);
      expect(cart[1]).to.be.closeTo(1, 0.01);
      expect(cart[2]).to.be.closeTo(1, 0.01);
    });
  });

  describe('getParameters', () => {
    it('should return all lattice parameters', () => {
      const cell = new UnitCell(5, 6, 7, 80, 90, 100);
      const params = cell.getParameters();

      expect(params).to.have.lengthOf(6);
      expect(params[0]).to.equal(5);
      expect(params[1]).to.equal(6);
      expect(params[2]).to.equal(7);
      expect(params[3]).to.equal(80);
      expect(params[4]).to.equal(90);
      expect(params[5]).to.equal(100);
    });
  });

  describe('clone', () => {
    it('should create independent copy', () => {
      const cell = new UnitCell(5, 6, 7, 80, 90, 100);
      const cloned = cell.clone();

      expect(cloned.a).to.equal(cell.a);
      expect(cloned.b).to.equal(cell.b);
      expect(cloned.c).to.equal(cell.c);
      expect(cloned.alpha).to.equal(cell.alpha);
      expect(cloned.beta).to.equal(cell.beta);
      expect(cloned.gamma).to.equal(cell.gamma);

      expect(cloned).to.not.equal(cell);

      cloned.a = 10;
      expect(cell.a).to.equal(5);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const cell = new UnitCell(5, 6, 7, 80, 90, 100);
      const json = cell.toJSON();

      expect(json.a).to.equal(5);
      expect(json.b).to.equal(6);
      expect(json.c).to.equal(7);
      expect(json.alpha).to.equal(80);
      expect(json.beta).to.equal(90);
      expect(json.gamma).to.equal(100);
    });
  });
});