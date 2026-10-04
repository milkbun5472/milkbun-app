import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PET_ACTIONS,samplePetAction,postureFrame} from './pet-action.mjs';
import {restingTailWeights,dogTailWeights,kittenBackWeights,softCrotchWeights} from './pet-skin.mjs';
import {solveLimb} from './cat-motion.mjs';
const size=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('both real rigs can reach the folded sleeping and seated paw targets',()=>{
 for(const species of ['cat','dog']){const rig=JSON.parse(readFileSync(new URL(species+'-rig.json',import.meta.url)));
  for(const kind of ['sleep','sit','sniff','play']){
   const a={lie:0,sit:0,crouch:0,chestPitch:0,...samplePetAction(kind,2,{species})},p=postureFrame(rig,a,2);
   for(const[name,l]of Object.entries(rig.legs)){
    const front=name.startsWith('front'),pivot=rig.bones[front?'chest':'pelvis'].head,theta=front?p.chestPitch:p.pelvisPitch;
    const dy=l.root[1]-pivot[1],dz=l.root[2]-pivot[2],hip=[l.root[0],pivot[1]+dy*Math.cos(theta)-dz*Math.sin(theta)+(front?p.chestY:p.pelvisY),pivot[2]+dy*Math.sin(theta)+dz*Math.cos(theta)];
    const folded=p.paw({name}),ankle=l.ankle.map((v,i)=>v+(i===0?folded.x:i===2?folded.z:0));
    const solved=solveLimb(hip,ankle,[hip[0],hip[1]+1,hip[2]],size(l.root,l.knee),size(l.knee,l.ankle));assert.equal(solved.clamped,false,species+' '+kind+' '+name);
   }
  }
 }
});
test('each existing action has a finite shared pose and sleep uses the articulated posture',()=>{
 for(const species of ['cat','dog'])for(const{id}of PET_ACTIONS)for(const t of [0,.3,2,10])assert.ok(Object.values(samplePetAction(id,t,{species})).every(Number.isFinite));
 assert.equal(samplePetAction('sleep').lie,1);assert.equal(samplePetAction('sit').sit,1);assert.ok(samplePetAction('pickup').crouch>.5);assert.ok(samplePetAction('eat').headPitch>samplePetAction('look').headPitch);
});
test('tail tip repair removes its residual torso pull without affecting the skull, paws or root',()=>{
 const fixed=restingTailWeights(['tail2','pelvis','tail1','head'],[.87,.11,.02,0],.835);assert.equal(fixed[1],0);assert.ok(Math.abs(fixed.reduce((n,w)=>n+w,0)-1)<1e-12);assert.ok(fixed[0]> .97);
 for(const row of [ [['head','earL','chest','pelvis'],[1,0,0,0],.6], [['frontLPaw','chest','pelvis','head'],[1,0,0,0],.07], [['tail0','pelvis','tail1','head'],[.5,.5,0,0],.405]])assert.deepEqual(restingTailWeights(...row),row[1]);
 const mixed=restingTailWeights(['tail1','pelvis','head','earL'],[.3,.4,.2,.1],.7);assert.equal(mixed[2],.2);assert.equal(mixed[3],.1);assert.equal(mixed[1],0);
});
test('forward-curled dog tip follows the tail even when the export assigned it entirely to the pelvis',()=>{
 const names=['pelvis','chest','backLLower','head'],weights=[1,0,0,0];
 for(const p of [[.003,.711,-.306],[.024,.694,-.278],[.09,.60,-.248]]){
  const row=dogTailWeights(p,names,weights);assert.ok(row.every(([name,w])=>w===0||name.startsWith('tail')));assert.ok(Math.abs(row.reduce((n,[,w])=>n+w,0)-1)<1e-12);
 }
 for(const p of [[0,.405,-.35],[0,.52,-.28],[0,.60,.06],[-.1,.04,.25]])assert.deepEqual(dogTailWeights(p,names,weights),names.map((n,i)=>[n,weights[i]]));
 const a=new Map(dogTailWeights([0,.53-1e-6,-.3],names,weights)),b=new Map(dogTailWeights([0,.53+1e-6,-.3],names,weights));
 assert.ok(Math.abs(a.get('pelvis')-b.get('pelvis'))<1e-6);
});

test('cat back fur no longer follows the face, while the actual rear skull stays rigid',()=>{
 const row=kittenBackWeights([0,.46,-.15],['head','chest','pelvis','earL'],[.8,.1,.1,0]);assert.equal(new Map(row).get('head')||0,0);assert.ok(new Map(row).get('pelvis')>.4);
 for(const point of [[0,.60,.064],[-.14,.71,.198],[0,.43,.437]])assert.deepEqual(kittenBackWeights(point,['head','chest','pelvis','earL'],[1,0,0,0]),[['head',1],['chest',0],['pelvis',0],['earL',0]]);
});

test('leg-root influence crosses the old hard crotch boundary continuously and keeps paw soles rigid',()=>{
 const names=['chest','frontLLower','frontLPaw','pelvis'],weights=[1,0,0,0];
 const a=new Map(softCrotchWeights([-.068,.115-1e-6,.23],names,weights)),b=new Map(softCrotchWeights([-.068,.115+1e-6,.23],names,weights));
 for(const key of new Set([...a.keys(),...b.keys()]))assert.ok(Math.abs((a.get(key)||0)-(b.get(key)||0))<.0001);
 assert.equal(new Map(softCrotchWeights([-.11,.02,.27],names,weights)).get('frontLPaw'),1);
});
