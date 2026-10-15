import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,MAPS,moveIn,noteMeet,meetKey,meetSlot,MEET_SLOTS,MEET_CAP,
 metCount,closeness,MEET_TIERS,whereLabel,restoreMeets,recentHappenings,questBoard,
 questFrom,HAPPEN_KINDS} from './world.mjs';
// 她 2026-09-17：「继续做玩法吧宝宝」
// ⚠️碰见【只记世界看见的事】：谁和谁在哪儿照过面是真的，替谁编一句台词就是无中生有。

test('照过面就记进村里的账，她自己那几次才算交情',()=>{
 let s=freshState();
 s=noteMeet(s,{a:'me',b:'c1',nameB:'阿棠',place:'灯串集市'});
 assert.equal(metCount(s,'c1'),1);
 assert.match(recentHappenings(s,1)[0].text,/^你在灯串集市碰见了阿棠$/);
 assert.equal(recentHappenings(s,1)[0].kind,'met');
 // 邻居之间碰得再多也不是她的交情
 let t=s;
 for(let i=0;i<20;i++)t=noteMeet({...t,minute:(i%MEET_SLOTS)*240,day:1+Math.floor(i/MEET_SLOTS)},
  {a:'c1',b:'c2',nameA:'阿棠',nameB:'小满',place:'溪上小桥'});
 assert.equal(metCount(t,'c1'),1,'她自己那一次，一次都没多');
 assert.match(recentHappenings(t,1)[0].text,/^阿棠和小满在溪上小桥碰上了$/);
});

test('同一段时间里同一对人只记一次',()=>{
 let s=freshState();
 const one=s=>noteMeet(s,{a:'me',b:'c1',nameB:'阿棠',place:'林间月湖'});
 s=one(s);const after=one(one(one(s)));
 assert.equal(metCount(after,'c1'),1);
 // 换一段时间就能再记一次
 const later=one({...after,minute:after.minute+1440/MEET_SLOTS});
 assert.equal(metCount(later,'c1'),2);
 // 一天切成六段，这个数只在这一处算
 assert.equal(meetSlot({minute:0}),0);
 assert.equal(meetSlot({minute:1439}),MEET_SLOTS-1);
});

test('两个人的顺序不影响这是同一对',()=>{
 assert.equal(meetKey('me','c1'),meetKey('c1','me'));
 let s=noteMeet(freshState(),{a:'c1',b:'me',nameA:'阿棠',place:'公共厅前广场'});
 assert.equal(metCount(s,'c1'),1,'谁写在前面都算她碰见的');
 assert.match(recentHappenings(s,1)[0].text,/^你在公共厅前广场碰见了阿棠$/);
});

test('自己碰见自己不算，账上也不许留',()=>{
 const s=freshState();
 assert.equal(noteMeet(s,{a:'me',b:'me',nameA:'你',place:'林间月湖'}),s);
 assert.equal(noteMeet(s,{a:'c1',b:'',nameA:'阿棠',place:'林间月湖'}),s);
});

test('处到什么程度，是数出来的不是编出来的',()=>{
 let s=freshState();
 assert.equal(closeness(s,'c1'),MEET_TIERS[0][1]);
 for(let i=0;i<MEET_TIERS[1][0];i++)s=noteMeet({...s,minute:0,day:s.day+1},{a:'me',b:'c1',nameB:'阿棠',place:'村里'});
 assert.equal(closeness(s,'c1'),MEET_TIERS[1][1]);
 for(let i=0;i<MEET_TIERS[2][0]-MEET_TIERS[1][0];i++)s=noteMeet({...s,minute:0,day:s.day+1},{a:'me',b:'c1',nameB:'阿棠',place:'村里'});
 assert.equal(closeness(s,'c1'),MEET_TIERS[2][1]);
});

test('这个点该叫什么地方，只有一处答案',()=>{
 // ⚠️名字一律问 MAPS 要：村子是 codex 在扩的，写死「月潭栈桥」这种字面量，
 //   他改一次名字这条测试就红，而红的其实是测试自己。
 for(const key of ['pond','market','bridge']){
  const site=MAPS.garden.sites[key];
  assert.equal(whereLabel('garden',site.target),site.label);
 }
 assert.equal(whereLabel('garden',{x:0,z:-300}),MAPS.garden.name,'离得远就只说是哪张图');
 assert.equal(whereLabel('nowhere',{x:0,z:0}),'村里');
});

test('碰见跟着存档走，存不下的那些挤掉最久的那一对',()=>{
 let s=freshState();
 for(let i=0;i<MEET_CAP+6;i++)s=noteMeet({...s,minute:0,day:i+1},{a:'me',b:'c'+i,nameB:'某'+i,place:'村里'});
 assert.equal(restoreMeets(s.meets).length,MEET_CAP);
 assert.equal(metCount(s,'c'+(MEET_CAP+5)),1,'最近那一对还在');
 // ⚠️桩照【写存档的那一段】写：meets 的字段名就是 noteMeet 存下去的那几个
 const back=restoreState(JSON.parse(JSON.stringify(s)));
 assert.equal(metCount(back,'c'+(MEET_CAP+5)),1);
 assert.deepEqual(Object.keys(restoreMeets(back.meets)[0]).sort(),['day','key','n','slot']);
});

test('屋里住了人，公告栏就落真名',()=>{
 let s=freshState();
 const seeds=[0,1,2].map(i=>String(s.epoch)+':quest:0:'+i);
 // 三间屋空着的时候说的是「主人」
 assert.ok(seeds.some(seed=>/主人|告示|字条/.test(questFrom(s,seed))));
 s=moveIn(s,{charId:'c1',name:'阿棠'});
 s=moveIn(s,{charId:'c2',name:'小满'});
 s=moveIn(s,{charId:'c3',name:'砚'});
 for(const seed of seeds){const from=questFrom(s,seed);
  assert.doesNotMatch(from,/邻居屋的主人|那间的主人/,'住了人就不该再说「主人」');}
 // ⚠️谁住进来【不改抽中哪一间】：搬一次家整块板子重抽的话，她接了一半的委托会当场换人
 const before=questBoard(freshState()).map(q=>q.kind+':'+q.id);
 const after=questBoard(s).map(q=>q.kind+':'+q.id);
 assert.deepEqual(after,before);
});

test('碰见这一条一枪都不打',()=>{
 assert.ok(Object.hasOwn(HAPPEN_KINDS,'met'));
});
