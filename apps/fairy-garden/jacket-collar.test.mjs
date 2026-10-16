import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raw = readFileSync(new URL('./outfits/jacket.glb', import.meta.url));
const asset = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)));
const catalog = JSON.parse(readFileSync(new URL('./doll.json', import.meta.url)));
const shader = readFileSync(new URL('./outfit-dye.mjs', import.meta.url), 'utf8');
const context = { OUTFITS: catalog.outfits };
vm.runInNewContext(shader.replace(/^import .*;$/gm, '').replace(/export /g, '') + '\nthis.classify = regionShader;', context);

test('authored collar pieces retain independent cloth and shirt dyes', () => {
 const expected = { folded_collar: 'cloth', shirt_yoke: 'trim', shirt_collar: 'trim' };
 for (const [part, slot] of Object.entries(expected)) {
  const node = asset.nodes.find(n => n.name === 'outfit_jacket_' + part);
  assert(node, part);
  assert.equal(node.extras.outfit, 'jacket');
  assert.equal(node.extras.dyeSlot, slot);
  assert.equal(context.classify({ name: node.name, userData: node.extras }), `si=${slot === 'cloth' ? 0 : 1};`);
  assert(node.skin != null, part + ' follows the existing body rig');
  const mesh = asset.meshes[node.mesh];
  assert.deepEqual(mesh.extras.targetNames, catalog.dims.map(d => d.key));
  assert(mesh.primitives.every(p => p.targets.length === 6 && p.attributes.JOINTS_0 != null && p.attributes.WEIGHTS_0 != null));
 }
 assert.equal(asset.nodes.find(n => n.name === 'outfit_jacket').extras.refinedCollarVersion, 1);
});

test('explicit fabric ownership accepts only known palette slots and preserves legacy classification', () => {
 for (const id of Object.keys(catalog.outfits)) {
  assert.equal(context.classify({ name: 'authored_panel', userData: { outfit: id, dyeSlot: 'trim' } }), 'si=1;');
  const legacy = context.classify({ name: 'outfit_' + id, userData: { outfit: id } });
  for (const dyeSlot of ['bad;si=7;', -1, 99, null]) {
   assert.equal(context.classify({ name: 'outfit_' + id, userData: { outfit: id, dyeSlot } }), legacy);
  }
 }
 assert.equal(context.classify({ name: 'panel', userData: { outfit: 'missing', dyeSlot: 'trim' } }), null);
});
