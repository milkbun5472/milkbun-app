import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {MAPS,segmentClear}=await import('../world.mjs'),{buildSpace}=await import('./spaces.mjs'),{furnitureSeat,furniturePoint}=await import('./home-catalog.mjs'),{togetherPlans}=await import('./together.mjs'),{REST_PAIRS}=await import('./rest-pair.mjs'),{createAutoInteraction,automaticPairChoices}=await import('./social-flow.mjs');
const origin={a:{x:0,z:3.3},b:{x:0,z:4.8}};
test('七种坐躺互动都找真实家具，四朝向的路线与坐垫或床垫一同旋转',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const stored=Object.fromEntries(buildSpace('dayHome').furniture.filter(p=>!['sofa','double-bed'].includes(p.id)).map(p=>[p.id,{stored:true}]));MAPS.dayHome=buildSpace('dayHome',{...stored,sofa:{x:2,z:2,heading},'double-bed':{x:-3,z:-2,heading}});
  for(const kind of Object.keys(REST_PAIRS)){
   const p=togetherPlans(MAPS.dayHome,kind,origin)[0];assert.ok(p,kind+' '+heading);
   for(const who of ['a','b']){let at=origin[who];for(const to of p[who+'Route']){assert.ok(segmentClear(at,to,'dayHome'));at=to;}}
   if(REST_PAIRS[kind].posture==='lie'){assert.equal(p.beds.a.heading,heading);assert.equal(p.beds.a.piece,'double-bed');assert.equal(p.beds.b.piece,'double-bed');assert.equal(p.beds.a.y,p.beds.b.y);}
   else assert.equal(p.seats.a.piece,p.seats.b.piece);
  }
 }
});
test('TA当前坐垫优先；访客已经同坐时只在同一坐垫挪近，不重新走到固定点',()=>{
 MAPS.dayHome=buildSpace('dayHome');const p=MAPS.dayHome.furniture.find(p=>p.id==='sofa'),a=furniturePoint(p,{x:p.w/2+.6,z:.25}),b=furniturePoint(p,{x:-p.w/2-.6,z:.25}),from={a:{...a,seat:furnitureSeat(p,a,{x:.6})},b:{...b,seat:furnitureSeat(p,b,{x:-.6})}};
 for(const kind of [...Object.keys(REST_PAIRS).filter(k=>REST_PAIRS[k].posture==='sit'),'hand','pat','shoulder','cuddle','closer']){
  const plan=togetherPlans(MAPS.dayHome,kind,from).find(p=>p.local);assert.ok(plan,kind);assert.deepEqual(plan.aRoute,[]);assert.deepEqual(plan.bRoute,[]);assert.deepEqual(plan.seats.a,from.a.seat);assert.equal(plan.preserveHost,true);
 }
});
test('床被收纳或两侧堵住不会在空中开始，坐躺动作没有擅造替代家具',()=>{
 const hidden={'double-bed':{stored:true},sofa:{stored:true}};MAPS.dayHome=buildSpace('dayHome',hidden);
 for(const kind of Object.keys(REST_PAIRS))assert.equal(togetherPlans(MAPS.dayHome,kind,origin).length,0,kind);
 MAPS.dayHome=buildSpace('dayHome');MAPS.dayHome.obstacles.push({x:-4,z:-1,w:6,d:6});
 for(const kind of ['lie-hand','lie-hug','lie-rest'])assert.equal(togetherPlans(MAPS.dayHome,kind,origin).length,0,kind);
});
test('每个坐躺动作都有自动发起机会；睡着只选安静床上动作，手动无条件优先',()=>{
 const actions=Object.keys(REST_PAIRS).map(kind=>({kind})),choices=automaticPairChoices(actions,{posture:'stand'});assert.deepEqual(choices.map(p=>p.kind),actions.map(p=>p.kind));assert.ok(choices.every(p=>p.weight>0));
 const sleeping=automaticPairChoices([...actions,{kind:'kiss'}],{posture:'lie',sleeping:true});assert.deepEqual(sleeping.map(p=>p.kind),['lie-hand','lie-hug','lie-rest']);
 for(let index=0;index<7;index++){
  const rolls=[0,0,(index+.5)/7],flow=createAutoInteraction({random:()=>rolls.shift()??0}),started=[],visitor={present:true,control:'auto'};
  assert.equal(flow.tick(18,{enabled:true,eligible:true,visitor,ready:true,actions,start:(kind,opts)=>{started.push({kind,opts});return {ok:true};}}),true);
  assert.equal(started[0].kind,actions[index].kind);assert.deepEqual(started[0].opts,{automatic:true,initiator:'a'});visitor.control='manual';flow.tick(10000,{enabled:true,eligible:true,visitor,ready:true,actions,start:()=>{throw Error('Manual overridden');}});
 }
 const flow=createAutoInteraction({random:()=>1});assert.equal(flow.tick(18,{enabled:true,eligible:true,visitor:{present:true,control:'auto'},ready:true,actions,start:()=>{throw Error('Chance ignored');}}),false);
});

test('已经躺着时保留原床与实际躺位，安静自动动作不把睡着的TA睁眼或移到另一张床',()=>{
 MAPS.dayHome=buildSpace('dayHome');const spot=MAPS.dayHome.spots.find(s=>s.sleep),from={a:{...spot.target,bed:{...spot.sleep}},b:{...origin.b}};
 for(const kind of ['lie-hand','lie-hug','lie-rest','hand','hug']){const p=togetherPlans(MAPS.dayHome,kind,from,{automatic:true}).find(p=>p.local);assert.ok(p,kind);assert.deepEqual(p.aRoute,[]);assert.equal(p.beds.a.x,from.a.bed.x);assert.equal(p.beds.a.z,from.a.bed.z);assert.equal(p.beds.a.awake,false);}
 assert.equal(globalThis.CharDaySocial.automaticSetting({presentation:{map:'dayHome'},slot:{type:'sleep'}},{resting:true}),true);
});
