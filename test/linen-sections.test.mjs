import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/linen-sections.json',import.meta.url)));
const path=id=>new URL('../apps/fairy-garden/avatar-motion/data/'+id+'.bin.gz',import.meta.url);
const asset=readFileSync(path('linen')),raw=gunzipSync(asset),start=8+raw.readUInt32LE(4),meta=JSON.parse(raw.subarray(8,start));

test('linen guide upgrade preserves every existing binding field and payload byte',()=>{
 const original=structuredClone(meta);delete original.binding.sleeveSectionGuides;
 assert.equal(hash(JSON.stringify(original)),fixture.metadataSHA);
 assert.equal(hash(raw.subarray(start,start+fixture.payloadBytes)),fixture.payloadSHA);
 assert.ok(asset.length-fixture.sourceBytes<10000,'guide metadata must not bloat the compressed asset');
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
