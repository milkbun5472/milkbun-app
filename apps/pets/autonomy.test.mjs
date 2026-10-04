import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localRoute,nextRandom,restoreResident,restoreOutdoorIdle,idlePose} from './autonomy.mjs';
import {createHomeNavigation} from './home-navigation.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
import {createPetCare,restoreCare} from './care.mjs';
import {restorePetState,snapshotPetState} from './state.mjs';
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
test('local routes are varied, reachable and avoid occupied destinations at every body size',()=>{
 for(const size of [.7,1,1.3,1.4]){const nav=createHomeNavigation(size),goals=new Set();for(let seed=1;seed<=30;seed++){const r={rng:seed},from={x:0,z:.55};const next=localRoute(nav,from,()=>nextRandom(r),{clear:p=>p.x<1.4});assert.ok(next);assert.ok(Math.hypot(next.goal.x-from.x,next.goal.z-from.z)>=.7);assert.ok(next.goal.x<1.4);let last=from;for(const q of next.route){assert.ok(nav.walkable(q.x,q.z));for(let i=0;i<=30;i++){const t=i/30;assert.ok(nav.walkable(last.x+(q.x-last.x)*t,last.z+(q.z-last.z)*t));}last=q;}goals.add(JSON.stringify(next.goal));}assert.ok(goals.size>20);}
 assert.equal(localRoute({walkable:()=>false}, {x:0,z:0},()=>.5),null);
});
test('street wander follows clear segments and leaves door decisions to the player',()=>{
 for(let seed=1;seed<=30;seed++){const r={rng:seed},from=world.restore(null).position;const next=localRoute(world,from,()=>nextRandom(r),{radius:4.5,minDistance:1.5,clear:q=>world.nearest(q).distance>1.2});assert.ok(next);assert.ok(world.nearest(next.goal).distance>1.2);let last=from;for(const p of next.route){assert.ok(world.segmentClear(last,p));last=p;}}
});
test('healthy idle pets roam; real care interrupts idle acts, while sleeping pets keep their refusal',()=>{
 const c=createPetCare({satiety:80,energy:85,initiativeCooldown:120,traits:{active:0},rng:1});for(let i=0;i<6;i++)c.tick(1,{home:true});assert.equal(c.state.task.kind,'wander');const bonds=structuredClone(c.state.relationships);c.state.task.spot={x:0,z:.2};c.arrive();for(let i=0;i<7;i++)c.tick(1,{home:true});assert.equal(c.state.task,null);assert.deepEqual(c.state.relationships,bonds);
 for(const kind of ['wander','watch','play']){c.state.task={kind,source:'self',phase:'walking'};assert.equal(c.request('pet').accepted,true);assert.equal(c.state.task.kind,'pet');}
 c.state.task={kind:'sleep',source:'self',phase:'doing'};assert.equal(c.request('pet').accepted,false);assert.equal(c.state.task.kind,'sleep');
 const snapshot=c.snapshot();c.tick(1,{home:true,paused:true});assert.deepEqual(c.snapshot(),snapshot);
});
test('autonomy restores bounded independent state and never invents time or invalid reached goals',()=>{
 assert.equal(restoreResident({rng:NaN,heading:Infinity,activity:{kind:'teleport'}}).activity,null);assert.equal(restoreOutdoorIdle({wait:Infinity}).wait,6);
 const broken=restoreCare({task:{kind:'wander',phase:'doing',source:'self',spot:{x:Infinity,z:0}}});assert.equal(broken.task.phase,'walking');
 const s=restorePetState(null,world);s.resident=restoreResident({id:'ta',position:{x:0,z:1},activity:{kind:'read',phase:'doing',time:3,duration:12}});const saved=snapshotPetState(s,{position:s.position,room:null,outdoor:null,evening:false});const reloaded=restorePetState(saved,world);assert.deepEqual(reloaded.resident,s.resident);reloaded.resident.position.x=2;assert.equal(s.resident.position.x,0);assert.ok(idlePose('sniff',2).headPitch>0);
});
test('idle exploration cannot keep postponing the next real request to a person',()=>{
 const c=createPetCare({initiativeCooldown:20,satiety:80,energy:85,traits:{active:0}}),people=[{key:'you',name:'你',position:{x:0,z:1}}];
 for(let i=0;i<50;i++){c.tick(1,{home:true,people});if(c.state.task?.kind==='wander'&&c.state.task.phase==='walking'){c.state.task.spot={x:0,z:.2};c.arrive();}if(c.state.task?.kind==='invitePet')break;}
 assert.equal(c.state.task.kind,'invitePet');assert.equal(c.state.task.target,'you');assert.equal(c.state.recent.length,0);
});
