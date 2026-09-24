import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const bytes=read('./doll.glb'),glb=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const catalog=JSON.parse(read('./doll.json'));const nodes=glb.nodes.filter(n=>n.mesh!=null);
test('new clay asset has twelve selectable hairstyles and six complete costumes',()=>{
 assert.equal(catalog.style,'clay-2026-09');assert.equal(Object.keys(catalog.hair).length,12);
 for(const id of Object.keys(catalog.hair))assert.equal(nodes.filter(n=>n.name==='hair_'+id).length,1,id);
 for(const id of Object.keys(catalog.outfits)){
  const parts=nodes.filter(n=>n.extras?.outfit===id);assert.ok(parts.length>=5,id);
  for(const arm of ['leftArm','rightArm'])assert.ok(parts.some(n=>n.extras.rigPart===arm),id+' '+arm);
 }
 assert.ok(bytes.length<10*1024*1024,'mobile asset budget');
});
test('neutral reference starts with zero morph weights; each slider has actual geometry targets',()=>{
 for(const m of glb.meshes)assert.ok((m.weights||[]).every(v=>v===0),m.name+' must not spawn deformed');
 for(const {key,min,max,low,high}of catalog.dims){assert.ok(min<1&&max>1&&low&&high);assert.ok(glb.meshes.some(m=>m.extras?.targetNames?.includes(key)),key);}
 const rig=glb.nodes.find(n=>n.extras?.dollRig)?.extras;assert.ok(rig);
 for(const label of ['leftArm','rightArm','leftLeg','rightLeg']){assert.equal(rig.dollRig[label].length,3);assert.ok(rig.rigMorphs[label].height[1]>0);}
});
test('skin, eyes and shared dyes remain independently addressable',()=>{
 for(const name of ['Face','Neck','Left hand','Right hand'])assert.ok(nodes.find(n=>n.name===name.replaceAll(' ','_')||n.name===name)?.extras?.skin,name);
 for(const slot of ['cloth','trim','bottom','boots'])assert.ok(nodes.some(n=>n.extras?.colorSlot===slot),slot);
 for(const m of glb.materials)assert.equal(m.pbrMetallicRoughness.metallicFactor,0,m.name+' is clay, not metallic');
});
test('shape controls expose names, live values and reset without altering page layout',()=>{
 const host=read('../../js/fairy-garden.js').toString();assert.match(host,/"aria-label": d.label/);assert.match(host,/Math.round\(value \* 100\)/);assert.match(host,/d.low \|\|/);assert.match(host,/pushLook\(\{ dims: \{ \[d.key\]: 1 \} \}\)/);
});
test('replacement is authored from scratch and never imports the rejected mesh',()=>{
 const source=read('../../art/fairy-garden/clay_doll.py').toString()+read('../../art/fairy-garden/fresh_doll.py').toString()+read('../../art/fairy-garden/sculpt_clothes.py').toString();
 assert.doesNotMatch(source,/import_scene|clay-reference\.glb|base_traveler\.glb|import doll_hair/);
 for(const n of nodes)assert.equal(n.extras?.geometryOrigin,'blender-from-scratch',n.name);
 for(const side of [-1,1])assert.ok(nodes.some(n=>n.name===`Eye ${side}`||n.name===`Eye_${side}`));
});
