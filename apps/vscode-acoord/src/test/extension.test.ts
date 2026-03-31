import * as assert from 'assert';
import { XDATCARParser } from '../io/parsers/xdatcarParser';
import { XYZParser } from '../io/parsers/xyzParser';
import { POSCARParser } from '../io/parsers/poscarParser';
import { Structure } from '../models/structure';
import { UnitCell } from '../models/unitCell';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('XDATCAR direct configuration frames parse correctly', () => {
		const parser = new XDATCARParser();
		const content = [
			'test system',
			'1.0',
			'1 0 0',
			'0 1 0',
			'0 0 1',
			'H',
			'2',
			'Direct configuration=     1',
			'0.00000000 0.00000000 0.00000000',
			'0.50000000 0.50000000 0.50000000',
			'Direct configuration=     2',
			'0.10000000 0.00000000 0.00000000',
			'0.60000000 0.50000000 0.50000000',
		].join('\n');

		const frames = parser.parseTrajectory(content);
		assert.strictEqual(frames.length, 2);
		assert.strictEqual(frames[0].atoms.length, 2);
		assert.ok(Math.abs(frames[1].atoms[0].x - 0.1) < 1e-8);
	});

	test('XYZ parser round-trip preserves atom count and elements', () => {
		const parser = new XYZParser();
		const content = [
			'3',
			'water molecule',
			'O   0.000   0.000   0.000',
			'H   0.757   0.586   0.000',
			'H  -0.757   0.586   0.000',
		].join('\n');

		const structure = parser.parse(content);
		assert.strictEqual(structure.atoms.length, 3);
		assert.strictEqual(structure.atoms[0].element, 'O');

		const serialized = parser.serialize(structure);
		const reparsed = parser.parse(serialized);
		assert.strictEqual(reparsed.atoms.length, 3);
		assert.strictEqual(reparsed.atoms[0].element, 'O');
	});

	test('POSCAR parser reads lattice and element counts correctly', () => {
		const parser = new POSCARParser();
		const content = [
			'BCC Fe',
			'1.0',
			'2.866  0.000  0.000',
			'0.000  2.866  0.000',
			'0.000  0.000  2.866',
			'Fe',
			'2',
			'Direct',
			'0.000  0.000  0.000',
			'0.500  0.500  0.500',
		].join('\n');

		const structure = parser.parse(content);
		assert.strictEqual(structure.atoms.length, 2);
		assert.strictEqual(structure.atoms[0].element, 'Fe');
		assert.ok(structure.isCrystal);
		assert.ok(structure.unitCell instanceof UnitCell);
		if (structure.unitCell) {
			assert.ok(Math.abs(structure.unitCell.a - 2.866) < 1e-3);
		}
	});

	test('Structure clone is independent of original', () => {
		const s = new Structure('test');
		const { Atom } = require('../models/atom');
		s.addAtom(new Atom('C', 0, 0, 0));
		const cloned = s.clone();
		s.atoms[0].element = 'O';
		assert.strictEqual(cloned.atoms[0].element, 'C');
	});

	test('UnitCell fromVectors reconstructs lattice parameters', () => {
		const uc = new UnitCell(5, 5, 5, 90, 90, 90);
		const vectors = uc.getLatticeVectors();
		const fromVec = UnitCell.fromVectors(vectors);
		assert.ok(Math.abs(fromVec.a - 5) < 1e-6);
		assert.ok(Math.abs(fromVec.alpha - 90) < 1e-4);
	});
});

