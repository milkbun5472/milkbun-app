import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const root=new URL('../apps/fairy-garden/',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
const bytes=read('outfits/cardigan.glb'),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size)),bin=bytes.subarray(28+size);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/cardigan-armholes.json',import.meta.url)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const view=i=>{const v=doc.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)};
const node=doc.nodes.find(n=>n.name==='outfit_cardigan'),prim=doc.meshes[node.mesh].primitives[0];
function attribute(id){
 const a=doc.accessors[id];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');const out=new Float64Array(a.count*3);
 if(a.bufferView!==undefined){const b=view(a.bufferView),offset=a.byteOffset||0;for(let i=0;i<out.length;i++)out[i]=b.readFloatLE(offset+i*4);}
 if(a.sparse){const s=a.sparse,indices=view(s.indices.bufferView),values=view(s.values.bufferView);assert.equal(s.indices.componentType,5123);for(let j=0;j<s.count;j++){const i=indices.readUInt16LE(j*2);for(let k=0;k<3;k++)out[i*3+k]=values.readFloatLE((j*3+k)*4);}}
 return out;
}
const P=attribute(prim.attributes.POSITION),N=attribute(prim.attributes.NORMAL),M=prim.targets.map(t=>attribute(t.POSITION));
const changed=new Set(fixture.modifiedVertices);
const factory=createRequire(import.meta.url)('../apps/fairy-garden/vendor/draco/draco_wasm_wrapper.js');
const draco=await factory({wasmBinary:read('vendor/draco/draco_decoder.wasm')});
const decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),mesh=new draco.Mesh(),packed=view(prim.extensions.KHR_draco_mesh_compression.bufferView);
buffer.Init(new Int8Array(packed),packed.length);const status=decoder.DecodeBufferToMesh(buffer,mesh);assert.ok(status.ok());assert.equal(mesh.num_points()*3,P.length);
const faces=[],face=new draco.DracoInt32Array();for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);faces.push([face.GetValue(0),face.GetValue(1),face.GetValue(2)]);}
for(const item of [face,mesh,buffer,status,decoder])draco.destroy(item);
function normal(p,f){const [a,b,c]=f.map(i=>i*3),ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

test('cardigan repair preserves original UV/skin/index payloads, textures and fixed geometry',()=>{
 assert.equal(node.extras.armholeSurfaceVersion,2);
 for(const [i,m] of doc.meshes.entries()){const d=m.primitives[0].extensions?.KHR_draco_mesh_compression;if(d)assert.equal(hash(view(d.bufferView)),fixture.dracoSHA256[i]);}
 doc.images.forEach((im,i)=>assert.equal(hash(view(im.bufferView)),fixture.textureSHA256[i]));
 const digest=createHash('sha256'),value=Buffer.alloc(8);for(const a of [P,N,...M])for(let i=0;i<P.length/3;i++)if(!changed.has(i))for(let k=0;k<3;k++){value.writeDoubleLE(a[i*3+k]||0);digest.update(value);}
 assert.equal(digest.digest('hex'),fixture.fixedAttributesSHA256,'Collar, hem, artwork and accessory anchors stay fixed');
});

test('cardigan model and motion use the same repaired surface at their reference dimensions',()=>{
 const binding=decodeMotion(gunzipSync(read('avatar-motion/data/cardigan.bin.gz'))).binding;
 assert.equal(binding.name,'outfit_cardigan');assert.equal(binding.rest.length,P.length);
 let error=0;for(let i=0;i<P.length;i++)error=Math.max(error,Math.abs(P[i]+M.reduce((s,m,k)=>s+m[i]*binding.referenceMorphWeights[k],0)-binding.rest[i]));
 assert.ok(error<1e-6,'Animation must not restore the former cut surface');
});

test('repaired cloth has no collapsed faces or reversed morph faces across 64 slider endpoints',()=>{
 const region=faces.map((f,i)=>({f,i})).filter(({f})=>f.some(i=>changed.has(i)));
 const base=region.map(({f})=>normal(P,f));assert.ok(base.every(n=>Math.hypot(...n)>1e-10));
 const catalog=JSON.parse(read('doll.json')),names=doc.meshes[node.mesh].extras.targetNames,ranges=names.map(k=>{const d=catalog.dims.find(d=>d.key===k);return [d.min-1,d.max-1]});
 let minRatio=Infinity;for(let combination=0;combination<64;combination++){const posed=Float64Array.from(P,(p,i)=>p+M.reduce((s,m,k)=>s+m[i]*ranges[k][combination>>k&1],0));for(let i=0;i<region.length;i++){const n=normal(posed,region[i].f);assert.ok(dot(n,base[i])>0,'Repaired cloth must not turn inside out');minRatio=Math.min(minRatio,Math.hypot(...n)/Math.hypot(...base[i]));}}
 assert.ok(minRatio>.05);
});

test('side seam creases are rounded instead of retaining the cut sleeve slab',()=>{
 const groups=new Map(),weld=[];for(let i=0;i<P.length/3;i++){const key=Array.from(P.subarray(i*3,i*3+3),x=>Math.round(x/2e-5)).join(',');if(!groups.has(key))groups.set(key,groups.size);weld.push(groups.get(key));}
 const edges=new Map();faces.forEach((f,i)=>{for(let k=0;k<3;k++){const a=weld[f[k]],b=weld[f[(k+1)%3]],key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,[]);edges.get(key).push(i);}});
 const normals=faces.map(f=>normal(P,f)),angles=[];for(const ids of edges.values())if(ids.length===2&&ids.some(i=>faces[i].some(j=>changed.has(j)))){const [a,b]=ids.map(i=>normals[i]);angles.push(Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI);}
 angles.sort((a,b)=>a-b);assert.ok(angles.length>3000);assert.ok(angles[Math.floor(angles.length*.95)]<80,'Old cut surface measured over 130 degrees at p95');
});
