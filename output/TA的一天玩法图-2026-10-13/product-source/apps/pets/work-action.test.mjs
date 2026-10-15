import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {samplePetWork} from './work-action.mjs';
import {PET_WORKPLACES} from './workplaces.mjs';
import {postureFrame} from '../../art/pet-house/pet-action.mjs';
import {solveLimb} from '../../art/pet-house/cat-motion.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('all seven careers have physical actions in every stage, using the actual work clock',()=>{
 for(const {id}of PET_WORKPLACES)for(const species of ['cat','dog'])for(let index=0;index<3;index++){
  const job={profession:id,index,phase:'working',time:0},before=structuredClone(job);
  const a=samplePetWork(job,{atDestination:true,species}),b=samplePetWork({...job,time:1.3},{atDestination:true,species});
  assert.ok(a,id+' '+index);assert.notDeepEqual(a.pose,b.pose);assert.ok(Object.values(b.pose).every(Number.isFinite));assert.deepEqual(job,before);
  for(const phase of ['choice','ready','tired'])assert.equal(samplePetWork({...job,phase},{atDestination:true,species}),null);
  assert.equal(samplePetWork(job,{atDestination:false,species}),null);
 }
});
test('work paw gestures remain reachable for both real rigs, with the other three paws supported',()=>{
 for(const species of ['cat','dog']){
  const rig=JSON.parse(readFileSync(new URL('../../art/pet-house/'+species+'-rig.json',import.meta.url)));
  for(const profession of PET_WORKPLACES.map(p=>p.id))for(let index=0;index<3;index++)for(let time=0;time<12;time+=.15){
   const {pose}=samplePetWork({profession,index,time,phase:'working'},{atDestination:true,species});
   const action={lie:0,sit:0,crouch:0,chestPitch:0,...pose},p=postureFrame(rig,action,time);
   for(const [name,l]of Object.entries(rig.legs)){
    const front=name.startsWith('front'),pivot=rig.bones[front?'chest':'pelvis'].head,theta=front?p.chestPitch:p.pelvisPitch,dy=l.root[1]-pivot[1],dz=l.root[2]-pivot[2];
    const hip=[l.root[0],pivot[1]+dy*Math.cos(theta)-dz*Math.sin(theta)+(front?p.chestY:p.pelvisY),pivot[2]+dy*Math.sin(theta)+dz*Math.cos(theta)],fold=p.paw({name});
    const ankle=[l.ankle[0]+fold.x,l.ankle[1]+(pose[name+'Lift']||0),l.ankle[2]+fold.z+(pose[name+'Reach']||0)];
    assert.equal(solveLimb(hip,ankle,l.knee,distance(l.root,l.knee),distance(l.knee,l.ankle)).clamped,false,species+' '+profession+' '+index+' '+name+' '+time);
    if(name!=='frontL')assert.equal(ankle[1],l.ankle[1]);
   }
  }
 }
});
