import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { UndoManager } from '../../../providers/undoManager.js';

function makeStructure(atomCount: number = 1): Structure {
  const s = new Structure('test');
  for (let i = 0; i < atomCount; i++) {
    s.addAtom(new Atom('C', i, 0, 0));
  }
  return s;
}

describe('UndoManager', () => {
  describe('push and pop', () => {
    it('should start empty', () => {
      const um = new UndoManager();
      expect(um.isEmpty).to.be.true;
      expect(um.depth).to.equal(0);
    });

    it('should push a structure and increment depth', () => {
      const um = new UndoManager();
      um.push(makeStructure(1));
      expect(um.isEmpty).to.be.false;
      expect(um.depth).to.equal(1);
    });

    it('should pop the pushed structure', () => {
      const um = new UndoManager();
      const s = makeStructure(2);
      um.push(s);
      const popped = um.pop();
      expect(popped).to.not.be.null;
      expect(popped!.atoms).to.have.lengthOf(2);
      expect(um.isEmpty).to.be.true;
    });

    it('should return null when popping empty stack', () => {
      const um = new UndoManager();
      expect(um.pop()).to.be.null;
    });

    it('should clone on push (snapshot is independent)', () => {
      const um = new UndoManager();
      const s = makeStructure(1);
      um.push(s);
      // Mutate original after push
      s.addAtom(new Atom('O', 10, 0, 0));
      const popped = um.pop();
      // Snapshot should still have 1 atom, not 2
      expect(popped!.atoms).to.have.lengthOf(1);
    });

    it('should clear redo stack on push', () => {
      const um = new UndoManager();
      um.push(makeStructure(1));
      um.pushToRedo(makeStructure(1));
      expect(um.canRedo).to.be.true;
      um.push(makeStructure(1));
      expect(um.canRedo).to.be.false;
    });
  });

  describe('redo', () => {
    it('should return null when redo stack is empty', () => {
      const um = new UndoManager();
      expect(um.redo()).to.be.null;
    });

    it('should push to redo and retrieve', () => {
      const um = new UndoManager();
      const s = makeStructure(3);
      um.pushToRedo(s);
      expect(um.canRedo).to.be.true;
      expect(um.redoDepth).to.equal(1);
      const redone = um.redo();
      expect(redone).to.not.be.null;
      expect(redone!.atoms).to.have.lengthOf(3);
      expect(um.canRedo).to.be.false;
    });
  });

  describe('maxDepth', () => {
    it('should cap the undo stack at maxDepth', () => {
      const um = new UndoManager(3);
      um.push(makeStructure(1));
      um.push(makeStructure(2));
      um.push(makeStructure(3));
      um.push(makeStructure(4)); // exceeds maxDepth=3, oldest is dropped
      expect(um.depth).to.equal(3);
      // Popping 3 times should work, 4th should return null
      um.pop();
      um.pop();
      um.pop();
      expect(um.pop()).to.be.null;
    });
  });

  describe('clear', () => {
    it('should clear both undo and redo stacks', () => {
      const um = new UndoManager();
      um.push(makeStructure(1));
      um.pushToRedo(makeStructure(1));
      um.clear();
      expect(um.isEmpty).to.be.true;
      expect(um.canRedo).to.be.false;
    });
  });

  describe('estimatedMemoryMB', () => {
    it('should return non-negative memory estimate', () => {
      const um = new UndoManager();
      um.push(makeStructure(10));
      expect(um.estimatedMemoryMB).to.be.greaterThanOrEqual(0);
    });
  });
});
