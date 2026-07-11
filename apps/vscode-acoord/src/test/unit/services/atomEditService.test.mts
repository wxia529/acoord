import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UnitCell } from '../../../models/unitCell.js';
import { RenderMessageBuilder } from '../../../renderers/renderMessageBuilder.js';
import { TrajectoryManager } from '../../../providers/trajectoryManager.js';
import { UndoManager } from '../../../providers/undoManager.js';
import { AtomEditService } from '../../../services/atomEditService.js';

function makeStructure(): Structure {
  const s = new Structure('test');
  s.addAtom(new Atom('C', 0, 0, 0));
  s.addAtom(new Atom('O', 1.5, 0, 0));
  return s;
}

function makeServices(structure: Structure): {
  renderer: RenderMessageBuilder;
  tm: TrajectoryManager;
  um: UndoManager;
  svc: AtomEditService;
} {
  const renderer = new RenderMessageBuilder(structure);
  const tm = new TrajectoryManager([structure], 0);
  const um = new UndoManager();
  const svc = new AtomEditService(renderer, tm, um);
  return { renderer, tm, um, svc };
}

describe('AtomEditService', () => {
  describe('addAtom', () => {
    it('should add a valid atom and return true', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const result = svc.addAtom('N', 3, 0, 0);
      expect(result).to.be.true;
      expect(tm.activeStructure.atoms).to.have.lengthOf(3);
      expect(tm.activeStructure.atoms[2].element).to.equal('N');
    });

    it('should reject invalid element and return false', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const result = svc.addAtom('Xx', 0, 0, 0);
      expect(result).to.be.false;
      expect(tm.activeStructure.atoms).to.have.lengthOf(2);
    });

    it('should normalize element symbols (lowercase input)', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.addAtom('fe', 0, 0, 0);
      const added = tm.activeStructure.atoms[tm.activeStructure.atoms.length - 1];
      expect(added.element).to.equal('Fe');
    });

    it('should set selectiveDynamics to [T, T, T] when structure has selective dynamics', () => {
      const s = new Structure('test');
      const atomWithSD = new Atom('C', 0, 0, 0);
      atomWithSD.selectiveDynamics = [true, false, true];
      s.addAtom(atomWithSD);
      const { svc, tm } = makeServices(s);
      svc.addAtom('H', 1, 0, 0);
      const added = tm.activeStructure.atoms[tm.activeStructure.atoms.length - 1];
      expect(added.selectiveDynamics).to.deep.equal([true, true, true]);
    });

    it('should not set selectiveDynamics when structure has no selective dynamics', () => {
      const s = makeStructure(); // no atoms have selectiveDynamics
      const { svc, tm } = makeServices(s);
      svc.addAtom('H', 1, 0, 0);
      const added = tm.activeStructure.atoms[tm.activeStructure.atoms.length - 1];
      expect(added.selectiveDynamics).to.be.undefined;
    });
  });

  describe('insertDummyAtom', () => {
    it('should insert at the geometric center', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.insertDummyAtom(s.atoms.map((atom) => atom.id), 'geometry');
      const dummy = tm.activeStructure.atoms[2];
      expect(dummy.role).to.equal('dummy');
      expect(dummy.element).to.equal('X');
      expect(dummy.x).to.equal(0.75);
    });

    it('should insert at the mass-weighted center', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.insertDummyAtom(s.atoms.map((atom) => atom.id), 'mass');
      const expected = 1.5 * 15.999 / (12.011 + 15.999);
      expect(tm.activeStructure.atoms[2].x).to.be.closeTo(expected, 1e-12);
    });

    it('should ignore dummy atoms for center of mass', () => {
      const s = makeStructure();
      s.addAtom(new Atom('X', 100, 0, 0, undefined, { role: 'dummy' }));
      const { svc, tm } = makeServices(s);
      svc.insertDummyAtom(s.atoms.map((atom) => atom.id), 'mass');
      expect(tm.activeStructure.atoms[3].x).to.be.lessThan(1.5);
    });

    it('should reject an empty selection', () => {
      const { svc } = makeServices(makeStructure());
      expect(() => svc.insertDummyAtom([], 'geometry')).to.throw(/select at least one atom/);
    });
  });

  describe('insertGhostAtom', () => {
    it('should insert an H ghost atom at the selected center by default', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.insertGhostAtom(s.atoms.map((atom) => atom.id), 'geometry');
      const ghost = tm.activeStructure.atoms[2];
      expect(ghost.role).to.equal('ghost');
      expect(ghost.element).to.equal('H');
      expect(ghost.x).to.equal(0.75);
    });

    it('should apply positive and negative plane-normal offsets', () => {
      const s = new Structure('plane');
      s.addAtom(new Atom('C', 0, 0, 0));
      s.addAtom(new Atom('C', 1, 0, 0));
      s.addAtom(new Atom('C', 0, 1, 0));
      const ids = s.atoms.map((atom) => atom.id);
      const { svc, tm } = makeServices(s);
      svc.insertGhostAtom(ids, 'geometry', 'H', 1.25);
      expect(tm.activeStructure.atoms[3].z).to.be.closeTo(1.25, 1e-12);
      svc.insertGhostAtom(ids, 'geometry', 'H', -0.5);
      expect(tm.activeStructure.atoms[4].z).to.be.closeTo(-0.5, 1e-12);
    });

    it('should reject a normal offset for collinear atoms', () => {
      const s = new Structure('line');
      s.addAtom(new Atom('C', 0, 0, 0));
      s.addAtom(new Atom('C', 1, 0, 0));
      s.addAtom(new Atom('C', 2, 0, 0));
      const { svc } = makeServices(s);
      expect(() => svc.insertGhostAtom(s.atoms.map((atom) => atom.id), 'geometry', 'H', 1))
        .to.throw(/collinear/);
    });

    it('should report PCA plane RMS for four non-planar atoms', () => {
      const s = new Structure('non-planar');
      s.addAtom(new Atom('C', -1, -1, 0.2));
      s.addAtom(new Atom('C', 1, -1, -0.2));
      s.addAtom(new Atom('C', 1, 1, 0.2));
      s.addAtom(new Atom('C', -1, 1, -0.2));
      const { svc } = makeServices(s);
      const result = svc.insertGhostAtom(s.atoms.map((atom) => atom.id), 'geometry', 'H', 1);
      expect(result.planeRms).to.be.greaterThan(0.1);
    });
  });

  describe('deleteAtom', () => {
    it('should remove an atom by id', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const atomId = s.atoms[0].id;
      svc.deleteAtom(atomId);
      expect(tm.activeStructure.atoms).to.have.lengthOf(1);
      expect(tm.activeStructure.getAtom(atomId)).to.be.undefined;
    });

    it('should push undo snapshot before deletion', () => {
      const s = makeStructure();
      const { svc, um } = makeServices(s);
      expect(um.isEmpty).to.be.true;
      svc.deleteAtom(s.atoms[0].id);
      expect(um.isEmpty).to.be.false;
    });
  });

  describe('deleteAtoms', () => {
    it('should remove multiple atoms at once', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const ids = s.atoms.map((a) => a.id);
      svc.deleteAtoms(ids);
      expect(tm.activeStructure.atoms).to.have.lengthOf(0);
    });

    it('should deduplicate ids before deletion', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      svc.deleteAtoms([id, id]); // duplicated
      expect(tm.activeStructure.atoms).to.have.lengthOf(1);
    });

    it('should do nothing for empty array', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.deleteAtoms([]);
      expect(tm.activeStructure.atoms).to.have.lengthOf(2);
    });
  });

  describe('moveAtom', () => {
    it('should update atom position', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      svc.moveAtom(id, 5, 6, 7);
      const atom = tm.activeStructure.getAtom(id)!;
      expect(atom.x).to.be.closeTo(5, 1e-9);
      expect(atom.y).to.be.closeTo(6, 1e-9);
      expect(atom.z).to.be.closeTo(7, 1e-9);
    });

    it('should not commit on preview move', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      svc.moveAtom(id, 5, 6, 7, true); // preview=true
      // isEditing stays true in preview
      expect(tm.isEditing).to.be.true;
    });
  });

  describe('copyAtoms', () => {
    it('should create copies of atoms with given offset', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const ids = [s.atoms[0].id];
      const originalX = s.atoms[0].x;
      svc.copyAtoms(ids, { x: 1, y: 0, z: 0 });
      const active = tm.activeStructure;
      expect(active.atoms).to.have.lengthOf(3);
      const copy = active.atoms[2];
      expect(copy.x).to.be.closeTo(originalX + 1, 1e-9);
    });

    it('should do nothing for empty ids array', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      svc.copyAtoms([], { x: 1, y: 0, z: 0 });
      expect(tm.activeStructure.atoms).to.have.lengthOf(2);
    });
  });

  describe('changeAtoms', () => {
    it('should change element of specified atoms', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      const result = svc.changeAtoms([id], 'N');
      expect(result).to.be.true;
      expect(tm.activeStructure.getAtom(id)!.element).to.equal('N');
    });

    it('should throw for invalid element', () => {
      const s = makeStructure();
      const { svc } = makeServices(s);
      expect(() => svc.changeAtoms([s.atoms[0].id], 'Xx')).to.throw(/invalid element symbol/);
    });

    it('should return false for empty ids', () => {
      const s = makeStructure();
      const { svc } = makeServices(s);
      expect(svc.changeAtoms([], 'N')).to.be.false;
    });
  });

  describe('setAtomColor', () => {
    it('should set a valid hex color', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      const result = svc.setAtomColor([id], '#ff0000');
      expect(result).to.be.true;
      expect(tm.activeStructure.getAtom(id)!.color).to.equal('#ff0000');
    });

    it('should reject invalid color string', () => {
      const s = makeStructure();
      const { svc } = makeServices(s);
      const result = svc.setAtomColor([s.atoms[0].id], 'red');
      expect(result).to.be.false;
    });
  });

  describe('updateAtom', () => {
    it('should update element and position together', () => {
      const s = makeStructure();
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;
      const result = svc.updateAtom(id, { element: 'Fe', x: 1, y: 2, z: 3 });
      expect(result).to.be.true;
      const atom = tm.activeStructure.getAtom(id)!;
      expect(atom.element).to.equal('Fe');
      expect(atom.x).to.be.closeTo(1, 1e-9);
      expect(atom.y).to.be.closeTo(2, 1e-9);
      expect(atom.z).to.be.closeTo(3, 1e-9);
    });

    it('should return false for non-existent atom id', () => {
      const s = makeStructure();
      const { svc } = makeServices(s);
      expect(svc.updateAtom('nonexistent', { element: 'Fe' })).to.be.false;
    });

    it('should update position from fractional coordinates', () => {
      const s = makeStructure();
      s.unitCell = new UnitCell(10, 20, 30, 90, 90, 90);
      const { svc, tm } = makeServices(s);
      const id = s.atoms[0].id;

      const result = svc.updateAtom(id, { fractionalPosition: [0.25, 0.5, 0.75] });

      expect(result).to.be.true;
      const atom = tm.activeStructure.getAtom(id);
      expect(atom).to.not.be.undefined;
      expect(atom?.x).to.be.closeTo(2.5, 1e-9);
      expect(atom?.y).to.be.closeTo(10, 1e-9);
      expect(atom?.z).to.be.closeTo(22.5, 1e-9);
    });

    it('should reject fractional coordinates without a unit cell', () => {
      const s = makeStructure();
      const { svc } = makeServices(s);

      expect(() => svc.updateAtom(
        s.atoms[0].id,
        { fractionalPosition: [0.25, 0.5, 0.75] }
      )).to.throw('updateAtom: fractional coordinates require a unit cell');
    });
  });
});
