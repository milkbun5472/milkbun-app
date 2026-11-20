import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/linen-sections.json',import.meta.url)));
const path=id=>new URL('../apps/fairy-garden/avatar-motion/data/'+id+'.bin.gz',import.meta.url);
const asset=readFileSync(path('linen')),raw=gunzipSync(asset),start=8+raw.readUInt32LE(4),meta=JSON.parse(raw.subarray(8,start));

test('linen guide upgrade preserves every existing binding field and payload byte',()=>{
 const beforeEnvelope=structuredClone(meta);
 // Face ownership moves cuff inserts from the belt to cloth. Numeric bindings
 // and their existing packed payload must still match the preserved release.
 for(const key of ['meshEdits','sleeveEnvelope','envelopePayloadOffset'])delete beforeEnvelope[key];
 const cuff=beforeEnvelope.binding.parts.find(r=>r.name==='outfit_linen_cuff_patch');
 assert.equal(cuff.meshId,6);assert.equal(cuff.followArms,true);
 Object.assign(cuff,{name:'outfit_linen_trim',meshId:5,followArms:false});
 const original=structuredClone(beforeEnvelope);delete original.binding.sleeveSectionGuides;
 assert.equal(hash(JSON.stringify(original)),fixture.metadataSHA);
 assert.equal(hash(raw.subarray(start,start+fixture.payloadBytes)),fixture.payloadSHA);
 const header=Buffer.from(JSON.stringify(beforeEnvelope)),prefix=Buffer.alloc(8);prefix.write('LMOT');prefix.writeUInt32LE(header.length,4);
 const guideOnly=gzipSync(Buffer.concat([prefix,header,raw.subarray(start,start+meta.envelopePayloadOffset)]),{level:9});
 assert.ok(guideOnly.length-fixture.sourceBytes<10000,'preserved guide metadata stays within its budget');
 assert.ok(asset.length-guideOnly.length<768*1024,'envelope metadata stays below its reviewed size budget');
 const manifest=JSON.parse(readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/manifest.json',import.meta.url)));
 assert.equal(manifest.linen.sha256,hash(asset));assert.equal(manifest.linen.bytes,asset.length);
});

test('linen follows the same complete body sections as the existing guided sleeves',()=>{
 const data=decodeMotion(raw).binding,reference=decodeMotion(gunzipSync(readFileSync(path('bamboo')))).binding;
 assert.deepEqual(data.sleeveSectionGuides,reference.sleeveSectionGuides);
 assert.deepEqual(data.dims,reference.dims);
 const body=gunzipSync(readFileSync(path('body'))),bodyMeta=JSON.parse(body.subarray(8,8+body.readUInt32LE(4))),count=bodyMeta.mesh.position.$array[2]/3;
 for(const [side,guide]of data.sleeveSectionGuides.entries()){
  assert.equal(guide.side,side);assert.ok(guide.sections.length>=10);
  for(const [i,section]of guide.sections.entries()){
   assert.ok(section.ids.length>100);assert.ok(section.ids.every(id=>Number.isInteger(id)&&id>=0&&id<count));
   assert.ok(section.center.every(Number.isFinite));
   if(i)assert.ok(section.at>guide.sections[i-1].at);
  }
 }
});
