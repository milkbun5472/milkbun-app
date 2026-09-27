import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gltf,firstLoadBytes} from './doll-parts.test.mjs';
test('rabbit sneakers retain body morphs, leg skinning and an outfit-scoped coverage boundary',()=>{
 const shoe=gltf.nodes.find(n=>n.name==='outfit_cardigan_footwear');
 const garment=gltf.nodes.find(n=>n.name==='outfit_cardigan');
 assert.ok(shoe);assert.equal(shoe.extras.outfit,'cardigan');
 assert.equal(shoe.extras.coversFeetBelow,.14);assert.equal(shoe.extras.sourceFootwearVersion,2);
 const mesh=gltf.meshes[shoe.mesh],original=gltf.meshes[garment.mesh];
 assert.deepEqual(mesh.extras.targetNames,original.extras.targetNames);
 assert.ok(mesh.weights.every(w=>w===0));
 const joints=gltf.skins[shoe.skin].joints.map(i=>gltf.nodes[i].name);
 assert.ok(joints.includes('leftLeg')&&joints.includes('rightLeg'));
 for(const p of mesh.primitives){assert.ok('JOINTS_0' in p.attributes);assert.ok('WEIGHTS_0' in p.attributes);assert.ok('TEXCOORD_0' in p.attributes);}
 const imageFor=p=>{const m=gltf.materials[p.material],t=gltf.textures[m.pbrMetallicRoughness.baseColorTexture.index];return t.extensions?.EXT_texture_webp?.source??t.source;};
 const originalAtlas=imageFor(original.primitives[0]);
 for(const p of mesh.primitives)assert.equal(imageFor(p),originalAtlas,'sneakers reuse their garment’s source atlas');
 assert.ok(firstLoadBytes<3*1024*1024);
});
