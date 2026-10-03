import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url));
const places=JSON.parse(read('scenes.json'));
for(const {id} of places)test(id+' exported scene retains interactive zones and stays in preview budget',()=>{
 const bytes=read(id+'.glb');assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const layout=JSON.parse(read(id+'.json'));
 const nodes=doc.nodes.filter(n=>n.extras?.zone);for(const key of Object.keys(layout.zones))assert.ok(nodes.some(n=>n.extras.zone===key),key+' must survive export');
 const triangles=doc.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0);
 assert.ok(triangles<180000,'Scene triangle count must remain below 180k');assert.ok(bytes.length<900000,'Scene GLB must remain below 900k');assert.ok(doc.meshes.length<100);
 assert.ok(layout.camera.position.every(Number.isFinite));assert.ok(layout.cat.position.every(Number.isFinite));assert.equal(layout.cat.height,.88);
});
test('outdoor export preserves all house entrances and stays within the mobile budget',()=>{
 const b=read('outside.glb'),d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),layout=JSON.parse(read('outside.json'));assert.equal(b.readUInt32LE(8),b.length);
 for(const house of layout.buildings)assert.ok(d.nodes.some(n=>n.extras?.zone==='building_'+house.id));
 assert.ok(b.length<1100000);assert.ok(d.meshes.length<110);const tri=d.meshes.reduce((n,m)=>n+m.primitives.reduce((k,p)=>k+d.accessors[p.indices].count/3,0),0);assert.ok(tri<220000);
});
test('preview routes through physical doors and shares garden gestures and cat movement',()=>{
 const code=read('preview.mjs').toString(),html=read('preview.html').toString(),css=read('preview.css').toString();
 assert.match(code,/world\.canEnter\(position,id\)/);assert.match(code,/createMapGesture/);assert.match(code,/createCatMotion/);assert.match(code,/position=\{\.\.\.outdoor\.position\}/);assert.match(html,/id="door-labels"/);assert.doesNotMatch(html,/class="places"/);assert.match(css,/env\(safe-area-inset-bottom\)\*\.4/);
});

test('entered rooms retain the shared close-view camera',()=>{const code=read('preview.mjs').toString();assert.match(code,/createPetCamera\(/);assert.match(code,/cameraControls\?\.clearGesture\(/);assert.match(code,/cameraControls\?\.dispose\(/);assert.match(read('preview.html').toString(),/pet-camera.css/);});
