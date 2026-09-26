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

test('outfits own separate sleeve coverage and rabbit source shoes',()=>{
 const shirt=gltf.nodes.find(n=>n.name==='outfit_cardigan');
 assert.deepEqual(shirt.extras.skinCoverage.sleeve,[.198,0,.76,.10]);assert.equal(shirt.extras.skinCoverage.torsoBelow,.705);
 const shoe=gltf.nodes.find(n=>n.name==='outfit_cardigan_footwear');
 assert.equal(shoe.extras.coversFeetBelow,.14);assert.equal(shoe.extras.sourceFootwearVersion,1);
 assert.equal(shoe.extras.outfit,'cardigan');assert.ok(shoe.skin!=null);
 for(const id of ['academy','garden','ranger']){
  const shirt=gltf.nodes.find(n=>n.name==='outfit_'+id);
  assert.equal(shirt.extras.skinCoverage.sleeve[0],id==='garden'?.140:.198);
  assert.equal(shirt.extras.skinCoverage.torsoAbove,id==='ranger'?.3:.4,'bare legs stay visible');
  assert.equal(shirt.extras.skinCoverage.torsoBelow,.705);
 }
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


test('all outfit sleeves have separate volume, dye slots and shared body morphs',()=>{
 for(const id of ['cardigan','academy','garden','ranger'])for(const side of ['left','right']){
  const sleeve=gltf.nodes.find(n=>n.name===`outfit_${id}_${side}_sleeve`);
  assert.equal(sleeve.extras.roundSleeveVersion,1);
  assert.equal(sleeve.extras.outfit,id);
  assert.ok(sleeve.extras.slotBase.cloth);
  assert.ok(sleeve.skin!=null);
  const mesh=gltf.meshes[sleeve.mesh];
  assert.deepEqual(mesh.extras.targetNames,['height','shoulder','waist','flare','build','head']);
  assert.ok(mesh.primitives.every(p=>p.attributes.COLOR_0!=null));
 }
});


test('garden dress uses the clean source and continuous shoe shell',()=>{
 const dress=gltf.nodes.find(n=>n.name==='outfit_garden'),shoe=gltf.nodes.find(n=>n.name==='outfit_garden_shoes');
 assert.equal(dress.extras.cleanDressVersion,1);assert.equal(shoe.extras.weldedShoeVersion,1);
 assert.equal(shoe.extras.coversFeetBelow,.14);assert.ok(shoe.skin!=null);
 assert.deepEqual(gltf.meshes[shoe.mesh].extras.targetNames,['height','shoulder','waist','flare','build','head']);
});


test('authored shoes keep per-outfit styles, dye, closed soles and body morphs',()=>{
 for(const [id,style] of [['academy','loafer'],['garden','mary-jane'],['ranger','lace-boot']]){
  const parts=gltf.nodes.filter(n=>n.extras?.outfit===id&&n.extras?.footwearVersion===1);
  assert.equal(parts.length,5);
  for(const node of parts){
   assert.equal(node.extras.footwearStyle,style);assert.ok(node.skin!=null);
   const mesh=gltf.meshes[node.mesh];
   assert.deepEqual(mesh.extras.targetNames,['height','shoulder','waist','flare','build','head']);
   assert.ok(mesh.weights.every(v=>v===0));
   if(node.name===`outfit_${id}_shoes`){assert.equal(node.extras.colorSlot,'boots');assert.equal(node.extras.coversFeetBelow,.14);}
   else assert.equal(node.extras.colorSlot,undefined);
  }
 }
});


test('hoodie bag has a torso-bound back strap with independent accent colour',()=>{
 const strap=gltf.nodes.find(n=>n.name==='outfit_ranger_back_strap');
 assert.equal(strap.extras.backStrapVersion,1);assert.equal(strap.extras.outfit,'ranger');
 assert.ok(strap.extras.slotBase.accent);assert.ok(strap.skin!=null);
 assert.deepEqual(gltf.meshes[strap.mesh].extras.targetNames,['height','shoulder','waist','flare','build','head']);
 assert.equal(gltf.nodes.find(n=>n.name==='outfit_ranger').extras.textureSlots,'ranger');
});


test('all cuffs cover the shared wrist cut and hoodie retains independent details',()=>{
 assert.equal(gltf.nodes.find(n=>n.name==='DollBody').extras.fittedWristVersion,1);
 for(const id of ['cardigan','academy','garden','ranger']){
  const shirt=gltf.nodes.find(n=>n.name==='outfit_'+id);
  assert.equal(shirt.extras.fittedCuffVersion,1);
  assert.deepEqual(shirt.extras.skinCoverage.armAxis,[.153,.655,.095,-.19]);
  for(const side of ['left','right'])assert.equal(gltf.nodes.find(n=>n.name===`outfit_${id}_${side}_sleeve`).extras.fittedCuffVersion,1);
 }
 assert.equal(gltf.nodes.find(n=>n.name==='outfit_ranger').extras.cleanHoodieVersion,1);
 for(const name of ['outfit_ranger_trousers','outfit_ranger_front_accessories']){
  const n=gltf.nodes.find(n=>n.name===name);assert.ok(n.skin!=null);assert.equal(n.extras.outfit,'ranger');
  assert.deepEqual(gltf.meshes[n.mesh].extras.targetNames,['height','shoulder','waist','flare','build','head']);
 }
});
