import {Matrix4,Vector3,Quaternion} from './vendor/three.core.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {MAPS,freshState,findPath,walkable,targetFor,perform,restoreState} from './world.mjs';
test('empty flowerbeds have ground geometry matching the original two collision footprints',()=>{
 const b=readFileSync(new URL('./village-ground.glb',import.meta.url)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const plots=MAPS.garden.flowerbeds;assert.equal(plots.length,2);assert.deepEqual(plots.map(p=>[p.x,p.z,p.w,p.d]),[[-15.6,5.8,1.85,1],[-15.6,4.6,1.85,1]]);
 const points=[],binStart=28+b.readUInt32LE(12);
 const visit=(id,parent)=>{const n=j.nodes[id],matrix=new Matrix4();if(n.matrix)matrix.fromArray(n.matrix);else matrix.compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));matrix.premultiply(parent);
  for(const p of j.meshes[n.mesh]?.primitives||[])if(j.materials[p.material]?.name.startsWith('Flowerbed aged oak')){const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],offset=binStart+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;assert.equal(a.componentType,5126);for(let i=0;i<a.count;i++)points.push(new Vector3(...[0,4,8].map(k=>b.readFloatLE(offset+i*stride+k))).applyMatrix4(matrix).toArray());}
  for(const child of n.children||[])visit(child,matrix);
 };for(const id of j.scenes[j.scene||0].nodes)visit(id,new Matrix4());
 assert.ok(points.length,'empty beds must be embedded in always-loaded ground, not bloom state');
 const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
 for(const [i,lo,hi] of [[0,Math.min(...plots.map(p=>p.x-p.w/2)),Math.max(...plots.map(p=>p.x+p.w/2))],[2,Math.min(...plots.map(p=>p.z-p.d/2)),Math.max(...plots.map(p=>p.z+p.d/2))]]){assert.ok(Math.abs(min[i]-lo)<.015);assert.ok(Math.abs(max[i]-hi)<.015);}
 assert.ok(max[1]>.30&&max[1]<.36);
 for(const p of plots){assert.ok(MAPS.garden.obstacles.includes(p));assert.equal(walkable(p.x,p.z,'garden'),false);}
 assert.equal(freshState().blooms,0);
});
test('flowerbed stations remain reachable and watering/harvesting use the existing state writer',()=>{
 const original=freshState();for(const action of ['garden','note','sow'])assert.ok(findPath(original.position,MAPS.garden.stations[action],'garden')?.length);
 let s={...original,position:targetFor(original,'garden'),water:3};s=perform(s,'garden');assert.equal(s.blooms,1);s=perform(s,'garden');s=perform(s,'garden');assert.equal(s.blooms,3);s=perform(s,'garden');assert.equal(s.blooms,0);assert.equal(s.harvest,3);assert.deepEqual(restoreState(s),s);
 const b=MAPS.garden.decor.blooms;assert.ok(MAPS.garden.flowerbeds.some(p=>[0,1,2].every(i=>Math.abs(b.x+i*.5-p.x)<p.w/2&&Math.abs(b.z-p.z)<p.d/2)));
});
import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from './vendor/three.core.js';
import {makeFlowerbedVisibility} from './flowerbed-visibility.mjs';
test('nearby beds reveal through the streamed cottage and restore original materials away from them',()=>{
 const view=makeFlowerbedVisibility(),root=new Group(),other=new Group(),mat=new MeshStandardMaterial(),mesh=new Mesh(new BoxGeometry(),mat);mesh.castShadow=true;root.userData.districtId='home';root.add(mesh);other.userData.districtId='hall';const s={...freshState(),position:{...MAPS.garden.stations.garden}};
 view.update(s,[],s.position);view.update(s,[root,other],s.position);assert.equal(mat.opacity,.12);assert.equal(mat.depthWrite,false);assert.equal(mesh.castShadow,false);
 view.update({...s,position:{x:0,z:0}},[root],{x:0,z:0});assert.equal(mat.opacity,1);assert.equal(mat.transparent,false);assert.equal(mat.depthWrite,true);assert.equal(mesh.castShadow,true);mesh.geometry.dispose();mat.dispose();
});
