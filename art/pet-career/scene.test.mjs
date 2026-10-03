import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url));
for(const id of ['bakery','florist','alley'])test(id+' exported scene retains interactive zones and stays in preview budget',()=>{
 const bytes=read(id+'.glb');assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());const layout=JSON.parse(read(id+'.json'));
 const nodes=doc.nodes.filter(n=>n.extras?.zone);for(const key of Object.keys(layout.zones))assert.ok(nodes.some(n=>n.extras.zone===key),key+' must survive export');
 const triangles=doc.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0);
 assert.ok(triangles<180000,'Scene triangle count must remain below 180k');assert.ok(bytes.length<900000,'Scene GLB must remain below 900k');assert.ok(doc.meshes.length<100);
 assert.ok(layout.camera.position.every(Number.isFinite));assert.ok(layout.cat.position.every(Number.isFinite));assert.equal(layout.cat.height,.88);
});
test('scene preview loads only named scenes and uses shared cat',()=>{
 const code=read('preview.mjs').toString(),html=read('preview.html').toString(),css=read('preview.css').toString();
 assert.match(code,/\['bakery','florist','alley'\]\.includes\(requested\)/);assert.match(code,/\.\.\/pet-house\/cat.glb/);
 for(const id of ['bakery','florist','alley'])assert.ok(html.includes('data-scene="'+id+'"'));
 assert.match(css,/env\(safe-area-inset-bottom\)\*\.4/);assert.match(code,/createPetCamera\(/);assert.match(code,/cameraControls\.clearGesture\(/);
 const camera=readFileSync(new URL('../pet-house/pet-camera.mjs',import.meta.url),'utf8');
 assert.match(camera,/onpointercancel=clearGesture/);
});
