import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {projectShop} from '../apps/post-office/state.mjs';import {createShopFlow} from '../apps/post-office/flow.mjs';
const characters=[{id:'a',name:'甲'},{id:'b',name:'乙'},{id:'c',name:'丙'},{id:'d',name:'丁'}];
async function writtenVisit(rows,{bench=true}={}){
 const g={console,structuredClone};g.window=g;for(const f of ['apps/fairy-garden/story-actions.js','js/stamp-duel.js','js/stamp-shop.js'])vm.runInNewContext(readFileSync(f,'utf8'),g);
 let saved={day:8,date:'2026-11-8',phase:'open',period:'傍晚',coins:100,earned:0,roster:{柜台:'a',分拣:'b',看店:'d'},badge:{},window:[],decor:bench?['靠窗的长凳']:[],decorLv:{},customers:[{id:'v0',visitor:true,charId:'c',fee:12}]};
 const service=g.StampShop.create({read:()=>structuredClone(saved),write:async s=>(saved=structuredClone(s),true),now:()=>new Date(2026,10,8,19)});
 await service.run('meet',{id:'v0',characters,cards:[],onChat:async()=>structuredClone(rows)});
 const projection={...projectShop(saved,{characters,cards:[],today:saved.date,period:'傍晚',shopRules:g.StampDuel}),ambient:false};return {saved,projection};
}
const tick=f=>f.step(.05),until=(f,p,limit=1800)=>{for(let i=0;i<limit&&!p();i++)tick(f);assert.ok(p(),JSON.stringify(f.snapshot()));};
const visible=u=>u.seated?(u.performanceSeat||u.seat)?{x:(u.performanceSeat||u.seat).seatX,z:(u.performanceSeat||u.seat).seatZ}:{x:u.x,z:u.z}:u.position;
function facing(a,b){const p=visible(a),q=visible(b),angle=Math.atan2(q.x-p.x,q.z-p.z);assert.ok(Math.abs(Math.atan2(Math.sin(a.heading-angle),Math.cos(a.heading-angle)))<.025,JSON.stringify({actor:a.key,heading:a.heading,wanted:angle,position:p,other:q}));}
const pair=f=>[f.units.get(f.meeting.staff),f.units.get(f.meeting.visitor)];
test('actual writer visits without target IDs face both ways through long speech, speaker changes and repeated syncs',async()=>{
 const rows=[{speakerId:'c',text:'今天天气很好，街角的小店也开门了。我顺路过来看看，这里很暖和。'.repeat(3)},{speakerId:'a',text:'慢慢讲，我听着。'},{speakerId:'c',text:'等会儿再走。'}],{saved,projection}=await writtenVisit(rows),before=structuredClone(saved);assert.ok(saved.customers[0].meetTurns.every(t=>!t.targetId));
 const f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');let checked=0;
 for(let i=0;i<900&&f.meeting;i++){
  if(i%12===0)f.reconcile(projection);tick(f);if(!f.meeting)break;const[a,b]=pair(f);if(a.arrived&&b.arrived){facing(a,b);facing(b,a);assert.ok(b.seated,'plain dialogue keeps the visitor on the bench');checked++;}
 }
 assert.ok(checked>30);assert.deepEqual(saved,before);
});
test('explicit ordinary dialogue rotates in place and preserves a seated listener and speaker',async()=>{
 const rows=[{speakerId:'a',actorId:'a',targetId:'c',action:'talk',text:'坐在这里慢慢说。'},{speakerId:'c',actorId:'c',targetId:'a',action:'talk',text:'那我就在这里歇会儿。'}],{projection}=await writtenVisit(rows),f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');
 const[a,b]=pair(f),positions=[{...a.position},{...b.position}];for(let i=0;i<20;i++)tick(f);facing(a,b);facing(b,a);assert.ok(b.seated);assert.equal(a.path.length,0);assert.deepEqual([a.position,b.position],positions);
 f.nextBeat();for(let i=0;i<20;i++)tick(f);facing(a,b);facing(b,a);assert.ok(b.seated);assert.equal(b.path.length,0);assert.deepEqual([a.position,b.position],positions);
});
test('a visit without a bench meets at the visitor instead of talking across the counter',async()=>{
 const {projection}=await writtenVisit([{speakerId:'c',text:'这封信交给你了。'},{speakerId:'a',text:'好，已经收到了。'}],{bench:false}),f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');const[a,b]=pair(f),p=visible(a),q=visible(b);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<1.2);tick(f);facing(a,b);facing(b,a);
});
test('a seated visit can laugh and exchange the same letter, then finish and return to the original places',async()=>{
 const rows=[{speakerId:'c',text:'丙笑了起来，接着把话说完。'},{speakerId:'a',text:'甲把信递给丙。'},{speakerId:'c',text:'谢谢，下一次再来。'}],{projection}=await writtenVisit(rows),f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');const[a,b]=pair(f);assert.equal(f.performance.action,'laugh');for(let i=0;i<18;i++)tick(f);assert.ok(b.seated);facing(a,b);facing(b,a);
 f.nextBeat();until(f,()=>f.performance?.action==='hand'&&f.performance.progress>=.58);assert.ok(b.seated);assert.ok(b.letter);assert.ok(!a.letter);facing(a,b);facing(b,a);
 f.nextBeat();until(f,()=>!f.meeting);until(f,()=>a.arrived&&b.arrived);assert.equal(a.phase,'working');assert.deepEqual(a.position,a.home);assert.equal(a.heading,a.yaw);assert.ok(b.seated);
});
test('closing dialogue also faces its saved target without moving the speaker to another post',async()=>{
 const {projection}=await writtenVisit([{speakerId:'c',text:'来看看。'}]),f=createShopFlow();f.reconcile({...projection,customers:[]});f.startClosing({turns:[{speakerId:'a',actorId:'a',targetId:'b',action:'talk',text:'这边也已经收好了。'}]});const a=f.units.get('staff:a'),b=f.units.get('staff:b'),old={...a.position};for(let i=0;i<12;i++)tick(f);facing(a,b);facing(b,a);assert.deepEqual(a.position,old);assert.equal(a.path.length,0);
});
test('a missing named action target falls back to the actual visit conversation, and departure clears its poses',async()=>{
 const {projection}=await writtenVisit([{speakerId:'a',actorId:'a',targetId:'absent',action:'pat',text:'先把话说完。'},{speakerId:'c',text:'好，我听着。'}]),f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');tick(f);const[a,b]=pair(f);assert.equal(f.performance.action,'talk');facing(a,b);facing(b,a);assert.equal(b.partnerMotion,undefined);
 f.reconcile({...projection,customers:[]});tick(f);assert.equal(f.meeting,null);assert.equal(f.performance,null);assert.ok(!a.storyMotion&&!a.partnerMotion&&!a.bubble);assert.deepEqual(b.goal,{x:3.32,z:4.7});until(f,()=>a.arrived&&!f.units.has(b.key));assert.deepEqual(a.position,a.home);
});
test('a visitor can stand for a physical action without overlapping the clerk at the bench exit',async()=>{
 const {projection}=await writtenVisit([{speakerId:'c',text:'丙拿起信封，看了看上面的字。'},{speakerId:'a',text:'等你准备好了再说。'}]),f=createShopFlow();f.reconcile(projection);until(f,()=>f.meeting?.phase==='talk');tick(f);const[a,b]=pair(f);assert.equal(f.performance.action,'letter');assert.ok(!b.seated);assert.ok(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)>.55);facing(a,b);facing(b,a);
});
