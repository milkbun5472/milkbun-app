import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const asset=readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/body.bin.gz',import.meta.url));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/motion-compression.json',import.meta.url)));
const bytes=gunzipSync(asset),start=8+bytes.readUInt32LE(4),meta=JSON.parse(bytes.subarray(8,start));
const widths={B:1,H:2,h:2,I:4,i:4,f:4,d:8};
function protectedTree(value,path=[]){
 if(Array.isArray(value))return value.map((v,i)=>protectedTree(v,[...path,i]));
 if(!value||typeof value!=='object')return value;
 if(value.$array){
  if(path.length===4&&path[0]==='poseCurveData'&&path[1]==='rows'&&['positionDelta','normalDelta'].includes(path[3]))return 'pose-channel';
  const [code,offset,count]=value.$array;
  return {$array:[code,count,hash(bytes.subarray(start+offset,start+offset+count*widths[code]))]};
 }
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,protectedTree(v,[...path,k])]));
}
test('pose compression preserves all solver factors and all non-pose data byte for byte',()=>{
 assert.equal(hash(JSON.stringify(protectedTree(meta))),fixture.protectedSHA256);
 assert.ok(asset.length<18_000_000);
 assert.equal(hash(asset),fixture.sha256);
 const data=decodeMotion(bytes);
 for(const [i,row]of data.poseCurveData.rows.entries())for(const key of ['positionDelta','normalDelta']){
  assert.ok(row[key] instanceof Float32Array||row[key] instanceof Uint8Array);
  assert.ok(row[key].every(Number.isFinite));
  if(row.sourcePose==='neutral')assert.ok(row[key].every(v=>v===0));
  else {const encoded=meta.poseCurveData.rows[i][key];assert.equal(encoded.$array[0],'h');assert.ok(encoded.$scale>0);}
 }
});
function encoded(values,scale,key='positionDelta',code='h'){
 const array=Int16Array.from(values),raw=Buffer.from(array.buffer),shuffled=Buffer.concat([Buffer.from(values.map((_,i)=>raw[i*2])),Buffer.from(values.map((_,i)=>raw[i*2+1]))]);
 const metadata=Buffer.from(JSON.stringify({[key]:{$array:[code,0,values.length],$scale:scale}})),header=Buffer.alloc(8);header.write('LMOT');header.writeUInt32LE(metadata.length,4);return Buffer.concat([header,metadata,shuffled]);
}
test('signed quantized channels restore Float32 values including zero and both extrema',()=>{
 const values=[-32767,-123,-1,0,1,123,32767],scale=.08/32767;
 assert.deepEqual(decodeMotion(encoded(values,scale)).positionDelta,Float32Array.from(values,v=>v*scale));
 for(const scale of [0,-1,null,1e308])assert.throws(()=>decodeMotion(encoded(values,scale)));
 assert.throws(()=>decodeMotion(encoded(values,1,'value')),'solve factors cannot be quantized');
 assert.throws(()=>decodeMotion(encoded(values,1).subarray(0,-1)));
});
