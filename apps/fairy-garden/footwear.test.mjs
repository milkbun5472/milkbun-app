import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bytes=readFileSync(new URL('./doll.glb',import.meta.url));
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
test('rabbit sneakers retain body morphs, leg skinning and an outfit-scoped coverage boundary',()=>{
 const shoe=gltf.nodes.find(n=>n.name==='outfit_cardigan_footwear');
 const garment=gltf.nodes.find(n=>n.name==='outfit_cardigan');
 assert.ok(shoe);assert.equal(shoe.extras.outfit,'cardigan');
 assert.equal(shoe.extras.coversFeetBelow,.14);assert.equal(shoe.extras.sourceFootwearVersion,1);
 const mesh=gltf.meshes[shoe.mesh],original=gltf.meshes[garment.mesh];
 assert.deepEqual(mesh.extras.targetNames,original.extras.targetNames);
 assert.ok(mesh.weights.every(w=>w===0));
 const joints=gltf.skins[shoe.skin].joints.map(i=>gltf.nodes[i].name);
 assert.ok(joints.includes('leftLeg')&&joints.includes('rightLeg'));
 for(const p of mesh.primitives){assert.ok('JOINTS_0' in p.attributes);assert.ok('WEIGHTS_0' in p.attributes);assert.ok('TEXCOORD_0' in p.attributes);}
 assert.equal(gltf.images.length,12,'reuse the original texture set');
 assert.ok(bytes.length<5*1024*1024);
});
