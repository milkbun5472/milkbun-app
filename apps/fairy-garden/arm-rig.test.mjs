import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const bytes=read('./doll.glb'),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
test('exported body and outfits share connected elbows, with neutral rest morphs',()=>{
 const rig=gltf.nodes.find(n=>n.extras?.elbowRig);assert.equal(rig.extras.elbowRig.version,2);
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

test('rabbit outfit owns coverage and restored source shoes without changing other outfits',()=>{
 const shirt=gltf.nodes.find(n=>n.name==='outfit_cardigan');
 assert.deepEqual(shirt.extras.skinCoverage.sleeve,[.205,.46,.705,.10]);assert.equal(shirt.extras.skinCoverage.torsoBelow,.705);
 const shoe=gltf.nodes.find(n=>n.name==='outfit_cardigan_footwear');
 assert.equal(shoe.extras.coversFeetBelow,.14);assert.equal(shoe.extras.sourceFootwearVersion,1);
 assert.equal(shoe.extras.outfit,'cardigan');assert.ok(shoe.skin!=null);
 assert.ok(gltf.nodes.filter(n=>n.extras?.outfit&&n.extras.outfit!=='cardigan').every(n=>!n.extras.skinCoverage&&!n.extras.coversFeetBelow));
});

test('rabbit garment retains a rebuilt continuous surface, lowered collar and six body morphs',()=>{
 const shirt=gltf.nodes.find(n=>n.name==='outfit_cardigan');
 assert.equal(shirt.extras.continuousSurfaceVersion,1);
 assert.equal(shirt.extras.loweredCollarVersion,1);
 const mesh=gltf.meshes[shirt.mesh];
 assert.deepEqual(mesh.extras.targetNames,['height','shoulder','waist','flare','build','head']);
 const triangles=mesh.primitives.reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
 assert.ok(triangles<=15500);
});


test('rabbit sleeves have separate volume, dye slots and shared body morphs',()=>{
 for(const side of ['left','right']){
  const sleeve=gltf.nodes.find(n=>n.name===`outfit_cardigan_${side}_sleeve`);
  assert.equal(sleeve.extras.roundSleeveVersion,1);
  assert.equal(sleeve.extras.outfit,'cardigan');
  assert.ok(sleeve.extras.slotBase.cloth);
  assert.ok(sleeve.skin!=null);
  const mesh=gltf.meshes[sleeve.mesh];
  assert.deepEqual(mesh.extras.targetNames,['height','shoulder','waist','flare','build','head']);
  assert.ok(mesh.primitives.every(p=>p.attributes.COLOR_0!=null));
 }
});
