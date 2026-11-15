import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hairId} from './wardrobe.mjs';
for(const [id,triangles] of [['wolfcut',50054],['sweptback',49992]]){
const bytes=readFileSync(new URL('./hair/'+id+'.glb',import.meta.url));
const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
test('supplied '+id+' keeps its source detail in one lazy, dyeable hair asset',()=>{
 const meshes=g.nodes.filter(n=>n.mesh!=null);assert.equal(meshes.length,1);
 assert.equal(meshes[0].extras.hair,id);assert.equal(meshes[0].name,'hair_'+id);
 assert.equal(meshes[0].skin,undefined);
 const parent=g.nodes.find(n=>n.children?.includes(g.nodes.indexOf(meshes[0])));assert.equal(parent.name,'HeadAnchor');
 assert.equal(g.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+g.accessors[p.indices].count/3,0),triangles);
 assert.ok(bytes.length<400000,'one on-demand style stays below 400 KB');
 assert.equal(g.images.length,1,'only the shared dye base map is downloaded');
 for(const m of g.materials){assert.equal(m.pbrMetallicRoughness.metallicFactor,0);assert.ok(m.pbrMetallicRoughness.roughnessFactor>.8);assert.equal(m.normalTexture,undefined);}
});
}
test('new wolfcut has its own id without reinterpreting old wolf saves',()=>{
 assert.equal(hairId('wolfcut'),'wolfcut');assert.equal(hairId('wolf'),'korean');
 const catalog=JSON.parse(readFileSync(new URL('./doll.json',import.meta.url)));assert.equal(catalog.hair.wolfcut,'轻狼尾');assert.equal(catalog.hair.sweptback,'后梳短发');assert.equal(hairId('sweptback'),'sweptback');
});
