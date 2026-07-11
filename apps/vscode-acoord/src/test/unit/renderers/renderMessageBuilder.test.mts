import { expect } from 'chai';
import { Atom } from '../../../models/atom.js';
import { Structure } from '../../../models/structure.js';
import { UnitCell } from '../../../models/unitCell.js';
import { RenderMessageBuilder } from '../../../renderers/renderMessageBuilder.js';

describe('RenderMessageBuilder', () => {
  describe('atom coordinate payload', () => {
    it('should include fractional coordinates for crystal structures', () => {
      const structure = new Structure('crystal', true);
      structure.unitCell = new UnitCell(10, 20, 30, 90, 90, 90);
      structure.addAtom(new Atom('S', 2.5, 10, 22.5));

      const message = new RenderMessageBuilder(structure).getRenderMessage();
      const atom = message.data.atoms[0];

      expect(atom.fractionalPosition).to.not.be.undefined;
      const fractionalPosition = atom.fractionalPosition;
      if (!fractionalPosition) {
        throw new Error('Expected fractionalPosition to be present.');
      }
      expect(fractionalPosition[0]).to.be.closeTo(0.25, 1e-12);
      expect(fractionalPosition[1]).to.be.closeTo(0.5, 1e-12);
      expect(fractionalPosition[2]).to.be.closeTo(0.75, 1e-12);
    });

    it('should omit fractional coordinates when no unit cell is present', () => {
      const structure = new Structure('molecule');
      structure.addAtom(new Atom('S', 2.5, 10, 22.5));

      const message = new RenderMessageBuilder(structure).getRenderMessage();
      const atom = message.data.atoms[0];

      expect(atom.fractionalPosition).to.be.undefined;
    });
  });
});

describe('RenderMessageBuilder ghost atoms', () => {
  it('should expose Bq as the display label while preserving the basis element', () => {
    const structure = new Structure('ghost');
    structure.addAtom(new Atom('H', 0, 0, 0, undefined, { role: 'ghost' }));
    const builder = new RenderMessageBuilder(structure);
    const message = builder.getRenderMessage();
    expect(message.data.atoms[0].element).to.equal('H');
    expect(message.data.atoms[0].displayLabel).to.equal('Bq');
  });

  it('should expose the basis element for non-H ghosts', () => {
    const structure = new Structure('ghost');
    structure.addAtom(new Atom('C', 0, 0, 0, undefined, { role: 'ghost' }));
    const message = new RenderMessageBuilder(structure).getRenderMessage();
    expect(message.data.atoms[0].displayLabel).to.equal('C-Bq');
  });
});
