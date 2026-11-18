import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const root=new URL('../apps/fairy-garden/',import.meta.url);
function glb(name){const bytes=fs.readFileSync(new URL('outfits/'+name+'.glb',root)),size=bytes.readUInt32LE(12);return {doc:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(28+size)};}
function attribute({doc,binary},id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4}[a.type],size={5123:2,5126:4}[a.componentType];assert.ok(size);assert.ok(!a.sparse);const at=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count*width},(_,i)=>a.componentType===5126?binary.readFloatLE(at+i*size):binary.readUInt16LE(at+i*size));}
test('ranger strap vertices and six morphs agree with the motion binding',()=>{
 const data=glb('ranger'),node=data.doc.nodes.find(n=>n.name==='outfit_ranger_back_strap'),mesh=data.doc.meshes[node.mesh],p=mesh.primitives[0],position=attribute(data,p.attributes.POSITION),morphs=p.targets.map(t=>attribute(data,t.POSITION));
 const motion=decodeMotion(zlib.gunzipSync(fs.readFileSync(new URL('avatar-motion/data/ranger.bin.gz',root)))).binding,row=[motion,...motion.parts].find(r=>r.name===node.name);
 assert.equal(position.length,row.rest.length);assert.equal(morphs.length,6);
 let error=0;for(let i=0;i<position.length;i++){const actual=position[i]+morphs.reduce((sum,m,j)=>sum+m[i]*row.referenceMorphWeights[j],0);error=Math.max(error,Math.abs(actual-row.rest[i]));}
 assert.ok(error<1e-6,'Asset and animation must use the same fitted strap');
 const indices=attribute(data,p.indices),edges=new Map();for(let j=0;j<indices.length;j+=3)for(let k=0;k<3;k++){const a=indices[j+k],b=indices[j+(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}assert.ok([...edges.values()].every(count=>count===2),'Band must stay closed');
});
test('garden coverage includes the measured shoulder leak while retaining the open neckline',()=>{
 const {doc}=glb('garden'),coverage=doc.nodes.find(n=>n.name==='outfit_garden').extras.skinCoverage;
 // Independent canonical ray samples from the reported side view.
 for(const y of [.7073056515,.7083021679])assert.ok(y<coverage.torsoBelow&&y>coverage.torsoAbove);
 assert.ok(.720>coverage.torsoBelow,'Visible neck remains above the mask');
});
