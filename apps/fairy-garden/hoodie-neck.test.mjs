import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gltf } from './doll-parts.test.mjs';

test('hoodie owns a lower neck mask and a skinned continuous fabric lining', () => {
 const garment = gltf.nodes.find(n => n.name === 'outfit_ranger');
 const lining = gltf.nodes.find(n => n.name === 'outfit_ranger_neck_lining');
 assert.equal(garment.extras.skinCoverage.torsoBelow, .675);
 assert.equal(garment.extras.skinCoverage.torsoAbove, .3);
 assert.equal(garment.extras.neckLiningVersion, 1);
 assert(lining && lining.skin != null);
 assert.equal(lining.extras.outfit, 'ranger');
 assert.equal(lining.extras.dyeSlot, 'cloth');
 assert.deepEqual(gltf.meshes[lining.mesh].extras.targetNames, ['height', 'shoulder', 'waist', 'flare', 'build', 'head']);
 for (const id of ['academy', 'garden', 'cardigan', 'jacket', 'suit', 'tee']) {
  assert.equal(gltf.nodes.find(n => n.name === 'outfit_' + id).extras.skinCoverage.torsoBelow, id === 'tee' ? .708 : .705, id);
 }
});

test('hoodie rebuilding and finished-asset migration use the same neck repair and sewn fabric', () => {
 const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
 const hoodie = read('../../art/fairy-garden/doll/clean_hoodie.py');
 const migration = read('../../art/fairy-garden/doll/repair_hoodie_neck.py');
 const jacket = read('../../art/fairy-garden/doll/refine_jacket_collar.py');
 assert.equal((hoodie.match(/\['repair_hoodie_neck'\]\(\)/g) || []).length, 2, 'existing and newly rebuilt hoodies receive the repair');
 assert.match(migration, /TORSO_BELOW = \.675/);
 assert.match(migration, /garment\['skinCoverage'\]\['torsoBelow'\] = TORSO_BELOW/);
 for (const source of [migration, jacket]) assert.match(source, /sewn_fabric\.py/);
});
