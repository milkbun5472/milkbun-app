import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hairId} from './wardrobe.mjs';
const bytes=readFileSync(new URL('./hair/wolfcut.glb',import.meta.url));
const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
test('supplied wolfcut keeps its source detail in one lazy, dyeable hair asset',()=>{
 const meshes=g.nodes.filter(n=>n.mesh!=null);assert.equal(meshes.length,1);
 assert.equal(meshes[0].extras.hair,'wolfcut');assert.equal(meshes[0].name,'hair_wolfcut');
 assert.equal(meshes[0].skin,undefined);
 const parent=g.nodes.find(n=>n.children?.includes(g.nodes.indexOf(meshes[0])));assert.equal(parent.name,'HeadAnchor');
 assert.equal(g.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+g.accessors[p.indices].count/3,0),50054);
 assert.ok(bytes.length<400000,'one on-demand style stays below 400 KB');
 assert.equal(g.images.length,1,'only the shared dye base map is downloaded');
 for(const m of g.materials){assert.equal(m.pbrMetallicRoughness.metallicFactor,0);assert.ok(m.pbrMetallicRoughness.roughnessFactor>.8);assert.equal(m.normalTexture,undefined);}
});
test('new wolfcut has its own id without reinterpreting old wolf saves',()=>{
 assert.equal(hairId('wolfcut'),'wolfcut');assert.equal(hairId('wolf'),'korean');
 const catalog=JSON.parse(readFileSync(new URL('./doll.json',import.meta.url)));assert.equal(catalog.hair.wolfcut,'轻狼尾');
});
