import test from 'node:test';
import assert from 'node:assert/strict';
import {storyBeats,splitStoryText} from '../apps/post-office/playback.mjs';
import {createShopFlow,shopNavigation} from '../apps/post-office/flow.mjs';
const staff=[{kind:'staff',id:'a',name:'甲',post:'柜台',x:-1.45,z:.1,yaw:0,look:{}},{kind:'staff',id:'b',name:'乙',post:'分拣',x:-2.25,z:-1.65,yaw:Math.PI,look:{}},{kind:'staff',id:'c',name:'丙',post:'送信',x:3.25,z:3.55,yaw:0,look:{}},{kind:'staff',id:'d',name:'丁',post:'看店',x:3,z:-.6,yaw:0,seatHeight:.53,look:{}}];
const state=(ambient=false)=>({staff,customers:[],decor:[{builder:'bench'}],closed:false,phase:'open',ambient});
const step=(flow,n=200)=>{for(let i=0;i<n;i++)flow.step(.05);};
test('scene subtitles page through every original character without shortening the saved prose or inventing a speaker',()=>{
 const text='一段很长的原文，含有停顿。'.repeat(25)+'\n最后还留着一枚💌。';const chunks=splitStoryText(text);assert.equal(chunks.join(''),text);assert.ok(chunks.every(s=>Array.from(s).length<=52));
 const beats=storyBeats([{speakerId:'b',actorId:'b',action:'letter',text}]);assert.equal(beats.map(b=>b.text).join(''),text);assert.equal(beats[0].action,'letter');assert.ok(beats.slice(1).every(b=>b.action==='talk'));assert.ok(storyBeats([],['旧故事原文。']).every(b=>b.speakerId==null));
});
test('closing performs saved speakers and actions in the room before tidying and walking out',()=>{
 const flow=createShopFlow();flow.reconcile(state());flow.startClosing({turns:[{speakerId:'b',actorId:'b',action:'letter',text:'先把信收好。'},{speakerId:'a',actorId:'a',targetId:'b',action:'help',text:'我来帮你。'},{speakerId:null,text:'店里安静下来。'}]});
 flow.step(.05);assert.equal(flow.units.get('staff:b').bubble,'先把信收好。');assert.equal(flow.units.get('staff:b').letter,true);assert.equal(flow.lampProgress,0);assert.ok(!flow.closingDone);
 flow.nextBeat();flow.step(.05);assert.equal(flow.performance.speakerId,'a');assert.equal(flow.units.get('staff:a').taskAction,'help');assert.ok(flow.units.get('staff:a').path.length);flow.nextBeat();flow.step(.05);assert.equal(flow.narration,'店里安静下来。');flow.skipStory();step(flow,1800);assert.ok(flow.closingDone,JSON.stringify(flow.snapshot()));assert.equal(flow.snapshot().units.filter(u=>u.key.startsWith('staff:')).length,0);
});
test('idle staff walk obstacle-safe routes, exchange the same letter, then return without invented conversation',()=>{
 const events=[],flow=createShopFlow({onEvent:e=>events.push(e)}),nav=shopNavigation();flow.reconcile(state(true));let walking=false,pair=false,handover=false;
 for(let i=0;i<3600;i++){flow.step(.05);const snap=flow.snapshot();walking ||=snap.units.some(u=>u.phase==='idle-walk'&&u.walking);pair ||=!!snap.idlePair;handover ||=snap.units.some(u=>u.action==='handover'&&u.letter);for(const u of snap.units){assert.ok(nav.walkable(u.position.x,u.position.z),u.key+' entered furniture');assert.equal(u.bubble,'');}}
 assert.ok(walking&&pair&&handover,JSON.stringify({walking,pair,handover,flow:flow.snapshot()}));assert.ok(events.some(e=>e.kind==='paper'));
});
test('a waiting customer keeps the counter staffed and door/stamp sounds follow only actual transitions',()=>{
 const events=[],flow=createShopFlow({onEvent:e=>events.push(e)}),guest={kind:'guest',id:'c0',key:'2026-11-8|上午|c0',name:'路人',look:{},got:0};flow.reconcile({...state(true),customers:[guest]});step(flow,1000);const clerk=flow.units.get('staff:a');assert.equal(clerk.phase,'working');assert.deepEqual(clerk.position,clerk.home);assert.equal(events.filter(e=>e.kind==='door').length,1);
 const served={...guest,done:true,got:10};flow.reconcile({...state(true),customers:[served]});flow.reconcile({...state(true),customers:[served]});assert.equal(events.filter(e=>e.kind==='stamp').length,1);step(flow,1400);assert.equal(events.filter(e=>e.kind==='door').length,2);
});

test('a shop returning to planning cancels idle meetings and sends every clerk back to the assigned station',()=>{
 const flow=createShopFlow();flow.reconcile(state(true));for(let i=0;i<2000&&!flow.snapshot().idlePair;i++)flow.step(.05);assert.ok(flow.snapshot().idlePair);flow.reconcile({...state(true),phase:'plan'});step(flow,1200);assert.equal(flow.snapshot().idlePair,null);assert.ok([...flow.units.values()].every(u=>u.phase==='working'&&u.arrived&&Math.hypot(u.position.x-u.home.x,u.position.z-u.home.z)<.12));
});

test('returning from a text page during a performance cannot leave a live clerk stuck in a presentation-only phase',()=>{
 const flow=createShopFlow();flow.reconcile(state());const saved=flow.snapshot();saved.units.forEach(u=>{u.phase='performing';u.position={x:.7,z:-.3};});flow.resume(saved);assert.ok([...flow.units.values()].every(u=>u.phase==='working'));step(flow,1500);assert.ok([...flow.units.values()].every(u=>u.arrived));
});
