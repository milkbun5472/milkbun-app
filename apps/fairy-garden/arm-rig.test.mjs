import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const bytes=read('./doll.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
test('exported body and outfits share connected elbows, with neutral rest morphs',()=>{
 const rig=gltf.nodes.find(n=>n.extras?.elbowRig);assert.equal(rig.extras.elbowRig.version,1);
 for(const side of ['left','right']){
  const upper=gltf.nodes.find(n=>n.name===side+'Arm'),lower=gltf.nodes.findIndex(n=>n.name===side+'Forearm');
  assert.ok(lower>=0);assert.ok(upper.children.includes(lower));
  for(const skin of gltf.skins)assert.ok(skin.joints.includes(lower),'all garment skins carry the elbow');
 }
 for(const m of gltf.meshes)assert.ok((m.weights||[]).every(w=>w===0),'no baked action');
 assert.ok(bytes.length<5*1024*1024,'retain mobile model budget');
});
test('both entry points use the same versioned rig and model graph',()=>{
 const build=JSON.parse(read('./build.json')).build,pet=read('../companion/pet.mjs').toString(),host=read('../../js/companion.js').toString();
 assert.ok(pet.includes('traveler.mjs?v='+build));assert.ok(pet.includes('doll.glb?v='+build));
 assert.ok(host.includes('BUILD = "'+build+'"'));
 assert.ok(read('../companion/index.html').toString().includes('pet.mjs?v='+build));
});
