import { expect } from 'chai';
import { ACoordParser } from '../../../io/parsers/acoordParser.js';
import { DEFAULT_BOND_RADIUS } from '../../../config/defaults.js';
import { Atom } from '../../../models/atom.js';
import { Structure } from '../../../models/structure.js';

describe('ACoord Parser', () => {
  const parser = new ACoordParser();

  const atoms = [
    { id: 'atom_a', element: 'C', x: 0, y: 0, z: 0, color: '#FF0000', radius: 0.7 },
    { id: 'atom_b', element: 'O', x: 1.2, y: 0, z: 0, color: '#00FF00', radius: 0.66 },
  ];

  it('parses v1.0 bonds and applies default bond radius', () => {
    const content = JSON.stringify({
      version: '1.0',
      atoms,
      bonds: [{ atomId1: 'atom_a', atomId2: 'atom_b' }],
    });

    const structure = parser.parse(content);
    expect(structure.bonds).to.have.lengthOf(1);
    expect(structure.bonds[0].radius).to.equal(DEFAULT_BOND_RADIUS);
    expect(structure.bonds[0].color).to.be.undefined;
  });

  it('parses v1.1 bonds with radius and color', () => {
    const content = JSON.stringify({
      version: '1.1',
      atoms,
      bonds: [{ atomId1: 'atom_a', atomId2: 'atom_b', radius: 0.2, color: '#112233' }],
    });

    const structure = parser.parse(content);
    expect(structure.bonds).to.have.lengthOf(1);
    expect(structure.bonds[0].radius).to.equal(0.2);
    expect(structure.bonds[0].color).to.equal('#112233');
  });

  it('serializes to v1.1 and includes bond radius', () => {
    const structure = new Structure('serialize-test');
    for (const atom of atoms) {
      structure.addAtom(new Atom(atom.element, atom.x, atom.y, atom.z, atom.id, {
        color: atom.color,
        radius: atom.radius,
      }));
    }
    structure.addBond('atom_a', 'atom_b', { radius: 0.24 });

    const serialized = parser.serialize(structure);
    const parsed = JSON.parse(serialized) as {
      version: string;
      bonds: Array<{ atomId1: string; atomId2: string; radius?: number; color?: string }>;
    };

    expect(parsed.version).to.equal('1.1');
    expect(parsed.bonds).to.have.lengthOf(1);
    expect(parsed.bonds[0].atomId1).to.equal('atom_a');
    expect(parsed.bonds[0].atomId2).to.equal('atom_b');
    expect(parsed.bonds[0].radius).to.equal(0.24);
    expect(parsed.bonds[0].color).to.be.undefined;
  });

  it('round-trips v1.1 bond radius and color', () => {
    const original = JSON.stringify({
      version: '1.1',
      atoms,
      bonds: [{ atomId1: 'atom_a', atomId2: 'atom_b', radius: 0.18, color: '#AABBCC' }],
    });

    const parsed = parser.parse(original);
    const serialized = parser.serialize(parsed);
    const reparsed = parser.parse(serialized);

    expect(reparsed.bonds).to.have.lengthOf(1);
    expect(reparsed.bonds[0].radius).to.equal(0.18);
    expect(reparsed.bonds[0].color).to.equal('#AABBCC');
  });
});
