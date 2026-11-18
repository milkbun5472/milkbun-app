import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as T from '../apps/fairy-garden/vendor/three.module.js';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
import {createRolledSleeve} from '../apps/fairy-garden/avatar-motion/rolled-sleeve.mjs';

const load=id=>decodeMotion(gunzipSync(readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/'+id+'.bin.gz',import.meta.url))));
const data=load('linen').binding,rest=load('body').mesh.position;
const rig=[-1,1].map(sign=>({shoulder:[sign*.11,.65,-.011],wrist:[sign*.26924,.4,0]}));
const entries=[data,...data.parts].map(row=>({row,ids:row.ids||Array.from({length:row.rest.length/3},(_,i)=>i)}));
function posed(matrix){const out=new Float64Array(rest.length),p=new T.Vector3();for(let i=0;i<rest.length;i+=3)p.fromArray(rest,i).applyMatrix4(matrix).toArray(out,i);return out}
function transforms(){return Array.from({length:7},()=>new T.Matrix4())}

test('rolled cuffs follow their actual body material instead of a distal wrist rotation',()=>{
 const guide=createRolledSleeve(T,data,rig,rest,entries),target=new T.Matrix4().compose(new T.Vector3(.03,.02,-.04),new T.Quaternion().setFromEuler(new T.Euler(.6,-.2,.3)),new T.Vector3(1,1,1)),virtual=transforms();
 virtual[2].makeRotationX(1.5);virtual[5].makeRotationY(-1.2);
 guide.update(posed(target),virtual,[1,1],0);
 for(const b of [2,5])for(let k=0;k<16;k++)assert.ok(Math.abs(virtual[b].elements[k]-target.elements[k])<1e-9);
});

test('straight arms and established phone sleeves are exact no-ops',()=>{
 for(const [bend,phone] of [[[0,0],0],[[1,1],1]]){
  const guide=createRolledSleeve(T,data,rig,rest,entries),virtual=transforms(),before=virtual.map(m=>m.elements.slice());
  guide.update(posed(new T.Matrix4().makeRotationZ(.7)),virtual,bend,phone);
  assert.deepEqual(virtual.map(m=>m.elements),before);
  for(const entry of entries)for(const i of entry.ids){const p=new T.Vector3(.7,.2,-.4),saved=p.clone();guide.limit(entry,i,p);assert.ok(p.equals(saved))}
 }
});

test('the entire authored roll retains its shape, including vertices behind the opening plane',()=>{
 const guide=createRolledSleeve(T,data,rig,rest,entries);guide.update(rest,transforms(),[1,1],0);let checked=0;
 for(const entry of entries)if(entry.row.followArms)for(const i of entry.ids){
  const row=entry.row,fore=row.rest[i*3]<0?2:5;let weight=0;for(let k=0;k<4;k++)if(row.skinIndex[i*4+k]===fore)weight+=row.skinWeight[i*4+k];
  if(weight<1-1e-10)continue;
  const p=new T.Vector3(.9,.8,.7),saved=p.clone();guide.limit(entry,i,p);assert.ok(p.equals(saved));checked++;
 }
 assert.ok(checked>1000,'use the actual rolled-cuff binding, not a synthetic rim');
});
