import { expect } from 'chai';
import { Structure } from '../../../models/structure.js';
import { Atom } from '../../../models/atom.js';
import { RenderMessageBuilder } from '../../../renderers/renderMessageBuilder.js';
import { SelectionService } from '../../../services/selectionService.js';

function makeStructureWithAtoms(): { structure: Structure; atomIds: string[] } {
  const structure = new Structure('test');
  structure.addAtom(new Atom('C', 0, 0, 0));
  structure.addAtom(new Atom('O', 1.5, 0, 0));
  structure.addAtom(new Atom('H', 3, 0, 0));
  const atomIds = structure.atoms.map((a) => a.id);
  return { structure, atomIds };
}

describe('SelectionService', () => {
  let structure: Structure;
  let atomIds: string[];
  let renderer: RenderMessageBuilder;
  let service: SelectionService;

  beforeEach(() => {
    ({ structure, atomIds } = makeStructureWithAtoms());
    renderer = new RenderMessageBuilder(structure);
    service = new SelectionService(renderer);
  });

  describe('getState', () => {
    it('should start with empty selection', () => {
      const state = service.getState();
      expect(state.selectedAtomIds).to.deep.equal([]);
      expect(state.selectedBondKeys).to.deep.equal([]);
    });
  });

  describe('selectAtom / deselectAtom', () => {
    it('should select a single atom', () => {
      service.selectAtom(atomIds[0]);
      expect(service.getState().selectedAtomIds).to.include(atomIds[0]);
    });

    it('should deselect atom', () => {
      service.selectAtom(atomIds[0]);
      service.deselectAtom();
      expect(service.getState().selectedAtomIds).to.deep.equal([]);
    });
  });

  describe('setSelection', () => {
    it('should set multiple atom selections', () => {
      service.setSelection([atomIds[0], atomIds[1]]);
      const ids = service.getState().selectedAtomIds;
      expect(ids).to.include(atomIds[0]);
      expect(ids).to.include(atomIds[1]);
    });

    it('should replace previous selection', () => {
      service.setSelection([atomIds[0]]);
      service.setSelection([atomIds[1]]);
      expect(service.getState().selectedAtomIds).to.deep.equal([atomIds[1]]);
    });
  });

  describe('toggleAtomSelection', () => {
    it('should add unselected atom to selection', () => {
      service.toggleAtomSelection(atomIds[0]);
      expect(service.getState().selectedAtomIds).to.include(atomIds[0]);
    });

    it('should remove selected atom from selection', () => {
      service.setSelection([atomIds[0]]);
      service.toggleAtomSelection(atomIds[0]);
      expect(service.getState().selectedAtomIds).to.not.include(atomIds[0]);
    });

    it('should leave other selections intact when toggling one atom', () => {
      service.setSelection([atomIds[0], atomIds[1]]);
      service.toggleAtomSelection(atomIds[0]);
      expect(service.getState().selectedAtomIds).to.deep.equal([atomIds[1]]);
    });
  });

  describe('selectBond / deselectBond', () => {
    it('should select a bond by key', () => {
      const bondKey = Structure.bondKey(atomIds[0], atomIds[1]);
      service.selectBond(bondKey);
      expect(service.getState().selectedBondKeys).to.include(bondKey);
    });

    it('should deselect bond', () => {
      const bondKey = Structure.bondKey(atomIds[0], atomIds[1]);
      service.selectBond(bondKey);
      service.deselectBond();
      expect(service.getState().selectedBondKeys).to.deep.equal([]);
    });
  });

  describe('toggleBondSelection', () => {
    it('should add bond if not selected', () => {
      const bondKey = Structure.bondKey(atomIds[0], atomIds[1]);
      service.toggleBondSelection(bondKey);
      expect(service.getState().selectedBondKeys).to.include(bondKey);
    });

    it('should remove bond if already selected', () => {
      const bondKey = Structure.bondKey(atomIds[0], atomIds[1]);
      service.selectBond(bondKey);
      service.toggleBondSelection(bondKey);
      expect(service.getState().selectedBondKeys).to.not.include(bondKey);
    });
  });

  describe('clearSelection', () => {
    it('should clear both atom and bond selections', () => {
      service.setSelection([atomIds[0]]);
      service.selectBond(Structure.bondKey(atomIds[0], atomIds[1]));
      service.clearSelection();
      expect(service.getState().selectedAtomIds).to.deep.equal([]);
      expect(service.getState().selectedBondKeys).to.deep.equal([]);
    });
  });
});
