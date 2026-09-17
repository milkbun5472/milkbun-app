import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,nextDay,noteHappening,recentHappenings,HAPPEN_CAP,dailyNote,
 craftThing,donate,takeShard,fillVein,keepNotes,sowSeed,turnIn,takeQuest,questBoard,
 missMaterial,weather,diveWeight,diveWet,mapFoggy,perform,MAPS,advanceTime} from './world.mjs';
import {rainyEpoch} from '../../test/_fairy-weather.mjs';
// 她 2026-09-17：「我觉得现在还是有点玩法单调」
// 诊断：病根不是事情少，是【做了没有回响】——她做十件事，他一件都不知道。
// 这一版 A：把真发生过的事记成一本村里的账，那是几条链子和他之间唯一的接口。

const withShard = (kind='echo') => fillVein(freshState(),[{kind,text:'一段回声。',whole:false}]);

test('她做的每一件事都在账上留一行',()=>{
 let s=takeShard(withShard(),2);
 assert.match(recentHappenings(s)[0].text,/从井里第 2 层带回回声石/);
 s=craftThing(s,s.shards[0].id,'set');
 assert.match(recentHappenings(s)[0].text,/在锅里凝结出一样/);
 const t=s.things[0];
 s=donate({...s,map:'museum'},t.id);
 assert.match(recentHappenings(s)[0].text,/留在了馆里/);
 assert.equal(recentHappenings(s,9).length,3,'三件事三行，不多不少');
});

test('同一天同一件不记两遍，账本也有上限',()=>{
 let s=noteHappening(freshState(),'world','一样的一句');
 s=noteHappening(s,'world','一样的一句');
 assert.equal(recentHappenings(s,9).length,1);
 for(let i=0;i<HAPPEN_CAP+8;i++)s=noteHappening(s,'world','第'+i+'句');
 assert.equal(restoreState(s).happenings.length,HAPPEN_CAP);
});

// ⚠️这本账是他开口时手上的料：最近发生的排在最前面，他说的是这两天的事，不是翻旧账
test('他开口时手上先有村里最近发生的事',()=>{
 let s={...freshState(),day:9,notes:[{id:'n1',kind:'today',ask:'',reply:'旧的一句。',day:2,pinned:false}]};
 s=noteHappening(s,'kept','把「回声灯」留在了馆里');
 const rows=missMaterial(s).rows;
 assert.equal(rows[0].text,'把「回声灯」留在了馆里','最近发生的没排在最前面');
 assert.ok(rows.some(r=>r.text==='旧的一句。'),'旧的那些也还在');
});

// ⚠️他去馆里看她留下的东西，得留下痕迹：不然他去了等于没去
test('他去馆里看过，账上要有那一行',async()=>{
 const {makeCompanionController}=await import('./companion.mjs');
 const plan={season:0,title:'',days:[{day:3,note:'',activities:[{id:'museum',note:''},{id:'home',note:''},{id:'home',note:''}]}]};
 let s={...freshState(),day:3,minute:600,seasonPlan:plan,
  collection:[{id:'c1',name:'回声灯',note:'x',kind:'echo',way:'set',recipe:'echo:set',from:'',day:1,gaveDay:2}]};
 const c=makeCompanionController();let ev=null;
 for(let i=0;i<6000&&!ev;i++){const r=c.tick(s,.1);s=r.state;if(r.event)ev=r.event;}
 assert.match(ev,/去馆里看了看你留下的东西/);
 assert.match(recentHappenings(s)[0].text,/在馆里站了一会儿，看的是「回声灯」/);
});

// B：世界自己长的那一件
test('每天自己长一件，同一天进来几次都是同一件',()=>{
 const s={...freshState(),epoch:'save-a',day:5};
 assert.equal(dailyNote(s),dailyNote(s),'同一天两样＝摇奖机');
 assert.notEqual(dailyNote(s),dailyNote({...s,day:6}),'换一天还是同一句，那世界就是死的');
});

test('连着几天不许是同一句，而且只从她自己的存档里长',()=>{
 let s={...freshState(),epoch:'save-a'};
 for(let i=0;i<6;i++)s=nextDay(s);
 const rows=recentHappenings(s,6).map(x=>x.text);
 assert.equal(new Set(rows).size,rows.length,'连着几天同一句，「世界在动」立刻就假了');
 // 她还没留过东西进馆，就不许说馆里那件
 assert.ok(!rows.some(x=>/馆里那件/.test(x)),'说了一件她根本没有的东西');
});

// C：天气真的改变今天能做什么
test('雨雪天下井更慢，但绝不拿「今天不行」堵她的路',()=>{
 const dry={...freshState(),epoch:rainyEpoch,day:1};
 const wet={...freshState(),epoch:rainyEpoch,day:2};
 assert.equal(diveWeight(dry),1);
 assert.ok(diveWeight(wet)>1,'天气只改滤镜不改玩法');
 assert.equal(diveWet(wet),true);
 // 慢是真的慢：同一趟花的时间不一样
 const at=s=>perform({...s,position:{...MAPS.garden.stations.dive},map:'garden'},'dive');
 const a=at(dry),b=at(wet);
 assert.ok(b.minute>a.minute,'下去花的时间一样，那这条就是假的');
 assert.equal(b.map,'depths','雨天不让下＝拿天气堵她的路');
});

// 这条的真身在游戏那头画图那一段；世界这边只负责诚实回答「今天有没有雾」
test('今天有没有雾，由天气说了算',()=>{
 const foggy=Array.from({length:400},(_,i)=>'fog-'+i).find(e=>weather(1,e)==='薄雾');
 assert.ok(foggy,'找不到起雾的存档号，这条就白测了');
 assert.equal(mapFoggy({...freshState(),epoch:foggy,day:1}),true);
 const clear=Array.from({length:400},(_,i)=>'fog-'+i).find(e=>weather(1,e)==='晴日');
 assert.equal(mapFoggy({...freshState(),epoch:clear,day:1}),false);
});
