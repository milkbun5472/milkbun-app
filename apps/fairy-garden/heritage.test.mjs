import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OUTFITS,mergeLook,outfitColors} from './wardrobe.mjs';
import {freshState,restoreState,moveIn} from './world.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url));
const approved={heritage:{revision:'shoulder-v6',sha:'69456edb2c35ccb7a6d89baa8050d4349702fa0c60046ca785127f352d0f9ac2'},linen:{revision:'sleeve-v4',sha:'97cb5bc02b43b5697499e27c31eb0f84ea76f130394f179889c742bea3f67dde'}};
for(const [id,{revision,sha}] of Object.entries(approved)){
test(`${id} keeps the approved ${revision} geometry, six textured regions and body morphs`,()=>{
 const b=read('./outfits/'+id+'.glb');
 assert.equal(createHash('sha256').update(b).digest('hex'),sha);
 const g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),nodes=g.nodes.filter(n=>n.mesh!=null);
 const prepared=JSON.parse(read('../../art/fairy-garden/doll/prepared_outfits.json'));
 assert.deepEqual(OUTFITS[id],prepared[id]);
 assert.deepEqual(JSON.parse(read('./doll.json')).outfits[id],prepared[id]);
 assert.deepEqual(nodes.map(n=>n.extras.colorSlot).sort(),Object.keys(OUTFITS[id].colors).sort());
 for(const n of nodes){assert.equal(n.extras.outfit,id);assert.equal(n.extras.dyeTexture,true);assert.ok(n.skin!=null);const m=g.meshes[n.mesh];
  assert.deepEqual([...m.extras.targetNames].sort(),['height','shoulder','waist','flare','build','head'].sort());
  for(const p of m.primitives)assert.ok(g.materials[p.material].pbrMetallicRoughness.baseColorTexture);
 }
});
test(`${id} saves all six custom colors independently through outfit switches and world restore`,()=>{
 const custom={cloth:'#112233',trim:'#223344',bottom:'#334455',accent:'#445566',boots:'#556677',detail:'#667788'};
 const original={outfit:'academy',wardrobe:{academy:{cloth:'#abcdef'}}};
 let look=mergeLook(original,{outfit:id,outfitColors:custom});
 look=mergeLook(mergeLook(look,{outfit:'suit'}),{outfit:id});
 let s=freshState();s.look=look;s.companion.look=original;s=moveIn(s,{charId:id+'-fixture',name:'试衣邻居',look});
 s=restoreState(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(outfitColors(s.look),custom);assert.deepEqual(outfitColors(s.neighbors[0].look),custom);
 assert.deepEqual(s.companion.look,original);assert.equal(s.look.wardrobe.academy.cloth,'#abcdef');
 assert.deepEqual(outfitColors(mergeLook(s.look,{outfitColors:OUTFITS[id].colors})),OUTFITS[id].colors);
});
}
