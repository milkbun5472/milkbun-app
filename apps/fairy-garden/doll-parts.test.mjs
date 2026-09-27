// 衣服按需加载之后，娃娃是 doll.glb（身体、骨架、头发）＋ outfits/<id>.glb（每套一件）。
// 这里把它们拼回一份「整包」的 glTF JSON（节点、网格、蒙皮的下标照拼接顺序顺延），
// 别的测试照旧按名字找 outfit_* 节点、按 skin 找骨头，不用各自懂拆包。
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
const here=p=>new URL(p,import.meta.url);
const parse=bytes=>JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
export const baseBytes=readFileSync(here('./doll.glb'));
export const outfitFiles=Object.fromEntries(readdirSync(here('./outfits/')).filter(f=>f.endsWith('.glb')).map(f=>[f.slice(0,-4),readFileSync(here('./outfits/'+f))]));
function merge(parts){
 const out={nodes:[],meshes:[],skins:[],accessors:[],materials:[],textures:[],images:[]};
 const tex=t=>t&&{...t,index:t.index+out._t0};
 for(const g of parts){const n0=out.nodes.length,m0=out.meshes.length,s0=out.skins.length,a0=out.accessors.length,mat0=out.materials.length,i0=out.images.length;out._t0=out.textures.length;
  const acc=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v+a0]));
  for(const n of g.nodes){const c={...n};if(c.children)c.children=c.children.map(i=>i+n0);if(c.mesh!=null)c.mesh+=m0;if(c.skin!=null)c.skin+=s0;out.nodes.push(c);}
  for(const m of g.meshes||[])out.meshes.push({...m,primitives:m.primitives.map(p=>({...p,attributes:acc(p.attributes),indices:p.indices==null?undefined:p.indices+a0,material:p.material==null?undefined:p.material+mat0,targets:p.targets?.map(acc)}))});
  for(const s of g.skins||[])out.skins.push({...s,joints:s.joints.map(i=>i+n0),skeleton:s.skeleton==null?undefined:s.skeleton+n0});
  out.accessors.push(...(g.accessors||[]));
  for(const m of g.materials||[]){const pbr=m.pbrMetallicRoughness||{};out.materials.push({...m,pbrMetallicRoughness:{...pbr,baseColorTexture:tex(pbr.baseColorTexture),metallicRoughnessTexture:tex(pbr.metallicRoughnessTexture)},normalTexture:tex(m.normalTexture)});}
  for(const t of g.textures||[]){const w=t.extensions?.EXT_texture_webp;out.textures.push({...t,source:t.source==null?undefined:t.source+i0,extensions:w?{...t.extensions,EXT_texture_webp:{...w,source:w.source+i0}}:t.extensions});}
  out.images.push(...(g.images||[]));
 }
 delete out._t0;return out;
}
export const base=parse(baseBytes);
export const gltf=merge([base,...Object.values(outfitFiles).map(parse)]);
// 一个人第一次进场要下的：底模＋最大的那一套
export const firstLoadBytes=baseBytes.length+Math.max(...Object.values(outfitFiles).map(b=>b.length));

test('doll.glb carries no clothes; every catalogued outfit has its own file and nothing else',()=>{
 const catalog=JSON.parse(readFileSync(here('./doll.json'),'utf8')).outfits;
 assert.ok(!base.nodes.some(n=>n.extras?.outfit),'base doll has no outfit meshes');
 assert.ok(base.nodes.some(n=>n.name==='DollBody'));
 assert.deepEqual(Object.keys(outfitFiles).sort(),Object.keys(catalog).sort());
 for(const [id,bytes] of Object.entries(outfitFiles)){const g=parse(bytes);
  const worn=g.nodes.filter(n=>n.mesh!=null);assert.ok(worn.length);
  for(const n of worn){assert.equal(n.extras?.outfit,id);assert.ok(n.skin!=null,'skinned to the shared rig');}
  // 骨头名字对得上底模：运行时按名字接到每个人自己的骨架上
  for(const s of g.skins)for(const j of s.joints)assert.ok(base.nodes.some(n=>n.name===g.nodes[j].name),g.nodes[j].name);
 }
});
test('the runtime fetches outfits by id beside traveler.mjs, with its own build fingerprint',()=>{
 const src=readFileSync(here('./traveler.mjs'),'utf8');
 assert.match(src,/new URL\('\.\/outfits\/'\+id\+'\.glb'\+new URL\(import\.meta\.url\)\.search,import\.meta\.url\)/);
 assert.match(src,/export const preloadOutfits=/);
});
