import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const root=new URL('../apps/fairy-garden/',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
const raw=read('outfits/tee.glb'),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),bin=raw.subarray(28+size),fixture=JSON.parse(fs.readFileSync(new URL('fixtures/tee-armholes.json',import.meta.url)));
const view=i=>{const v=doc.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)},hash=b=>createHash('sha256').update(b).digest('hex');
const node=doc.nodes.find(n=>n.name==='outfit_tee_cotton'),mesh=doc.meshes[node.mesh],prim=mesh.primitives[0];
function attr(i){const a=doc.accessors[i],b=view(a.bufferView),width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],step=a.componentType===5126?4:2;assert.ok([5126,5123].includes(a.componentType));return Array.from({length:a.count*width},(_,j)=>a.componentType===5126?b.readFloatLE((a.byteOffset||0)+j*step):b.readUInt16LE((a.byteOffset||0)+j*step));}
const P=attr(prim.attributes.POSITION),M=prim.targets.map(t=>attr(t.POSITION)),index=attr(prim.indices),faces=Array.from({length:index.length/3},(_,i)=>index.slice(i*3,i*3+3));
const normal=(p,[a,b,c])=>{a*=3;b*=3;c*=3;const u=[0,1,2].map(k=>p[b+k]-p[a+k]),v=[0,1,2].map(k=>p[c+k]-p[a+k]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
test('tee has one connected sewn surface with only neck, hem and two cuff openings',()=>{
 assert.equal(node.extras.sewnArmholeVersion,1);assert.equal(doc.nodes.filter(n=>n.mesh!==undefined&&n.extras?.outfit==='tee').length,3);
 const edges=new Map(),adj=new Map();for(const f of faces)for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}
 assert.ok([...edges.values()].every(n=>n===1||n===2),'non-manifold seam');
 const visit=(map,start)=>{const found=new Set(),queue=[start];while(queue.length){const i=queue.pop();if(found.has(i))continue;found.add(i);queue.push(...(map.get(i)||[]));}return found;};
 assert.equal(visit(adj,0).size,P.length/3,'all sleeves must join the torso');
 const boundary=new Map();for(const [key,count]of edges)if(count===1){const [a,b]=key.split(':').map(Number);for(const [i,j]of [[a,b],[b,a]]){if(!boundary.has(i))boundary.set(i,new Set());boundary.get(i).add(j);}}
 assert.ok([...boundary.values()].every(s=>s.size===2));let loops=0;while(boundary.size){const loop=visit(boundary,boundary.keys().next().value);for(const i of loop)boundary.delete(i);loops++;}assert.equal(loops,4);
});
test('tee preserves original denim, footwear, textures, and uses matching cloth motion positions',()=>{
 for(const [name,sha]of Object.entries(fixture.retainedDraco)){const n=doc.nodes.find(n=>n.name===name),p=doc.meshes[n.mesh].primitives[0];assert.equal(hash(view(p.extensions.KHR_draco_mesh_compression.bufferView)),sha);}
 doc.images.forEach((im,i)=>assert.equal(hash(view(im.bufferView)),fixture.textures[i]));
 const b=decodeMotion(gunzipSync(read('avatar-motion/data/tee.bin.gz'))).binding;assert.equal(b.rest.length,P.length);assert.equal(b.parts.length,1);
 for(let i=0;i<P.length;i++)assert.ok(Math.abs(P[i]+M.reduce((s,m,k)=>s+m[i]*b.referenceMorphWeights[k],0)-b.rest[i])<1e-6);
 for(let i=0;i<P.length/3;i++)if(P[i*3+1]<.45){let arm=0;for(let k=0;k<4;k++)if([1,2,4,5].includes(b.skinIndex[i*4+k]))arm+=b.skinWeight[i*4+k];assert.equal(arm,0,'Lower shirt must retain native seated drape');}
 for(const row of [b,...b.parts])for(let i=0;i<row.skinWeight.length;i+=4){assert.ok(Math.abs(row.skinWeight.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-6);assert.ok(row.skinWeight.slice(i,i+4).every(w=>w>=-1e-10));}
});
test('sewn tee retains positive face orientation and area over all 64 body slider endpoints',()=>{
 const catalog=JSON.parse(read('doll.json')),ranges=mesh.extras.targetNames.map(k=>{const d=catalog.dims.find(d=>d.key===k);return [d.min-1,d.max-1]}),base=faces.map(f=>normal(P,f));let min=Infinity;
 for(let bits=0;bits<64;bits++){const q=P.map((p,i)=>p+M.reduce((s,m,k)=>s+m[i]*ranges[k][bits>>k&1],0));faces.forEach((f,i)=>{const n=normal(q,f),a=base[i];assert.ok(n.reduce((s,v,k)=>s+v*a[k],0)>0,'inverted shape face');min=Math.min(min,Math.hypot(...n)/Math.hypot(...a));});}
 assert.ok(min>.4);
});
