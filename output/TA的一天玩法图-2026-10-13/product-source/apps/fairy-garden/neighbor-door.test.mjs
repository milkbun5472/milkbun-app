import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshState,restoreState,moveIn,moveOut,setNeighborDoor,neighborOf,restoreDoor,
 neighborView,neighborTalkError,noteNeighborTalk,metCount,closeness,noteMeet,
 MAPS,NEIGHBOR_REACH,perform,targetFor} from './world.mjs';
// 她 2026-09-18：「邀请邻居进来是不是也能直接设置他们的房间」＋「Ab 都做吧」

const live=(door={})=>{
 let s=moveIn(freshState(),{charId:'c1',name:'阿甲',look:{},door});
 const n=neighborOf(s,'c1');
 return {...s,map:'garden',position:{...n.position}};
};

test('请 TA 搬进来那一下就能定这扇门，之后也随时能改',()=>{
 let s=live({formalMemory:true});
 assert.deepEqual(neighborOf(s,'c1').door,{formalMemory:true});
 s=setNeighborDoor(s,'c1',{formalMemory:true,schedule:true},'阿甲甲');
 assert.deepEqual(neighborOf(s,'c1').door,{formalMemory:true,schedule:true});
 assert.equal(neighborOf(s,'c1').name,'阿甲甲');
 // 重开一次还在（写的那一半和读的那一半是同一层）
 assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))).neighbors[0].door,
  {formalMemory:true,schedule:true});
});

// ⚠️默认全关：请进来的是别人的角色，什么都不带才是安全的起点
test('默认什么都不带，只认 true，不认脏东西',()=>{
 assert.deepEqual(neighborOf(live(),'c1').door,{});
 assert.deepEqual(restoreDoor({a:true,b:false,c:'yes',d:1,e:null}),{a:true});
 assert.deepEqual(restoreDoor(null),{});
 assert.deepEqual(restoreDoor('不是对象'),{});
 // ⚠️键名不在这儿写第二份：它们住在 js/chat-rooms.js 的 GROUPS.cognition 里
 const src=fs.readFileSync(new URL('./world.mjs',import.meta.url),'utf8');
 assert.ok(!src.includes('formalMemory'),'world.mjs 里又抄了一份键名');
});

// ⚠️⚠️这是两道闸：门管 TA 自己的主线记忆，这一份管【这一档里的私事】。
//   同行者那条线，门开得再大也一个字都不给。
test('发给邻居的那一份里，同行者一个字都没有',()=>{
 let s=live({formalMemory:true,innerLife:true,schedule:true,otherScenes:true});
 s={...s,partnerId:'c9',companion:{...s.companion,name:'同行者甲'},
  harvest:3,stones:2,gifts:[{day:1,name:'一束铃叶草',from:'him'}]};
 const view=neighborView(s,'c1');
 const text=JSON.stringify(view);
 for(const leak of ['同行者','c9','gifts','bond','quests','companion','partner'])
  assert.ok(!text.includes(leak),'漏了：'+leak+' → '+text);
 // 该给的给到了：TA 是谁、住哪儿、此刻的天地、你们处到哪一步
 assert.equal(view.你是,'阿甲');
 assert.match(view.今天,/第 1 天/);
 assert.equal(view.处到,'刚搬来');
 assert.equal(neighborView(s,'没这人'),null);
});

test('走近了才说得上话，而且一天一位一次',()=>{
 let s=live();
 assert.match(neighborTalkError({...s,position:{x:0,z:0}},'c1'),/走近/);
 assert.equal(neighborTalkError(s,'c1'),'');
 assert.match(neighborTalkError(s,'没这人'),/不住在村里/);
 const said=noteNeighborTalk(s,'c1','今天风真大');
 assert.match(neighborTalkError(said,'c1'),/明天再说/);
 // ⚠️重开一次还得挡住，不然刷新一下就能再打一枪
 assert.match(neighborTalkError(restoreState(JSON.parse(JSON.stringify(said))),'c1'),/明天再说/);
 // 明天就又能聊
 assert.equal(neighborTalkError({...said,day:said.day+1},'c1'),'');
 // 挡住的时候一个字都不写
 assert.equal(noteNeighborTalk(said,'c1','再来一句'),said);
});

test('聊过一次算一笔交情，村里的账上留一行',()=>{
 let s=live();
 const before=metCount(s,'c1');
 const after=noteNeighborTalk(s,'c1','天凉了');
 assert.ok(metCount(after,'c1')>before,'聊了却不算交情');
 assert.match(after.happenings[0].text,/和阿甲说了几句/);
 assert.match(after.happenings[0].text,/天凉了/);
});

// 她问的那一句：从游戏移除邻居，他们的房间会被删吗
test('请 TA 搬走只动这一档的村子，碰见的账一笔不少',()=>{
 let s=live({formalMemory:true});
 for(let d=1;d<=6;d++)s=noteMeet({...s,day:d},{a:'me',b:'c1',nameA:'你',nameB:'阿甲',place:'广场'});
 const met=metCount(s,'c1'),close=closeness(s,'c1');
 assert.equal(met,6);
 const out=moveOut(s,'c1');
 assert.equal(out.neighbors.length,0);
 assert.equal(metCount(out,'c1'),met,'搬走把碰见的账也带走了');
 assert.equal(closeness(out,'c1'),close);
 const back=moveIn(out,{charId:'c1',name:'阿甲',look:{},door:{}});
 assert.equal(metCount(back,'c1'),met,'请回来碰见的账没接上');
});
