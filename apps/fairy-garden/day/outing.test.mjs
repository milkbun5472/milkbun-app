import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,segmentClear} from '../world.mjs';
import {registerCoreSpaces,CORE_SPACES} from './spaces.mjs';
import {DAY_PLACES} from './places/maps.mjs';
import {createSceneVisit,visitNear} from './visit.mjs';
registerCoreSpaces(MAPS);Object.assign(MAPS,DAY_PLACES);
test('独自出门没有隐形TA，24处沿实际可走路线坐下和起身，快照保持手选',()=>{
 for(const id of [...Object.keys(CORE_SPACES),...Object.keys(DAY_PLACES)]){
  const map=MAPS[id],avatar={root:{visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;},toArray(){return [this.x,this.y,this.z];}},rotation:{},userData:{}},animate(){}},v=createSceneVisit({avatar,ta:()=>null,choice:'manual',map:()=>map});
  assert.equal(visitNear(map.spawn,null,map),null);assert.equal(v.join({restore:{control:'manual',manualAction:'manual'}}),true);assert.equal(v.inspect().route.length,0);assert.equal(v.inspect().following,false);assert.equal(v.act('rest'),true,id+'存在可走到的座位');
  for(let i=0;i<1600&&v.inspect().busy;i++){const before=v.inspect().position;v.tick(.05,i*.05);assert.ok(segmentClear(before,v.inspect().position,id),id+'不切穿家具');}v.tick(.05,100);assert.equal(v.inspect().busy,false,id);assert.equal(v.inspect().seated,true,id);assert.equal(v.inspect().activity,'rest');
  const pause=v.pauseState();v.close();assert.equal(v.restore(pause),true);assert.deepEqual(v.inspect().position,pause.position);assert.equal(v.inspect().manualAction,'rest');assert.equal(v.act('near'),false);assert.equal(v.inspect().route.length,0);assert.equal(v.act('stand'),true);assert.equal(v.inspect().seated,false);v.close();
 }
});

test('主动邀请的通用互动在24处都能找到真实双人位置，路线避开家具和对方',async()=>{
 const {registerHooks}=await import('node:module');registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
 const {togetherPlans}=await import('./together.mjs'),{pairSpacing}=await import('./pair-pose.mjs'),T=await import('three');
 const actors=[{root:new T.Group()},{root:new T.Group()}];
 for(const id of [...Object.keys(CORE_SPACES),...Object.keys(DAY_PLACES)]){
  const map=MAPS[id],rest=map.spots.find(p=>p.action==='rest'&&p.seat)||map.spots.find(p=>p.action==='rest'),a=rest?.target||map.spawn,b=visitNear(map.spawn,a,map)?.to;assert.ok(b,id+'有两人可用位置');
  for(const kind of ['look','hand','hug']){
   const plan=togetherPlans(map,kind,{a,b},{distance:pairSpacing(kind,...actors)})[0];assert.ok(plan,id+' '+kind);let from=a;
   for(const to of plan.aRoute){assert.ok(segmentClear(from,to,id),id+' TA路线避家具');from=to;}
   from=b;for(const to of plan.bRoute){assert.ok(segmentClear(from,to,id),id+' 我的路线避家具');from=to;}
  }
 }
});
