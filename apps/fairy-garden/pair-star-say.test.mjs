import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,moveIn,neighborOf,noteMeet,
 PAIR_WATCH,PAIR_TALK_MIN,pairKey,pairMet,pairTalkError,pairView,notePairTalk,
 MAPS,STAR_SPOTS,starOther,takeStarRole,starBand,starReading,starGap,turnStar,
 recentHappenings} from './world.mjs';
// 她 2026-09-18：「123 都做吧宝宝」——②邻居之间说话、①转星仪用他自己的腔调

// ── ② 两位邻居站住说两句 ────────────────────────────────────────────
const two=(n=PAIR_TALK_MIN)=>{
 let s=moveIn(freshState(),{charId:'c1',name:'阿甲',look:{},door:{}});
 s=moveIn(s,{charId:'c2',name:'阿乙',look:{},door:{}});
 // ⚠️桩照【写这条记录的那一段】：noteMeet 同一天同一段里只记一次，所以要跨天
 for(let i=0;i<n;i++)s=noteMeet({...s,day:s.day+i},{a:'c1',b:'c2',nameA:'阿甲',nameB:'阿乙',place:'村口'});
 return {...s,map:'garden',position:{...neighborOf(s,'c1').position}};
};

test('处过几次才说得上话，刚搬来的两位在路上不会攀谈',()=>{
 const s=two(PAIR_TALK_MIN-1);
 assert.match(pairTalkError(s,'c1','c2',true),/还没熟/);
 assert.equal(pairTalkError(two(),'c1','c2',true),'');
});

// ⚠️她看不见的时候不许打这一枪：钱花了、体验一点没有
test('她不在跟前就不说',()=>{
 const s=two();
 assert.match(pairTalkError(s,'c1','c2',false),/不在跟前/);
 assert.match(pairTalkError(s,'me','c1',true),/只管别人之间/);
 assert.match(pairTalkError(s,'c1','c1',true),/不是两个人/);
});

test('一对一天只说一次，第二天才又能碰上',()=>{
 let s=two();
 s=notePairTalk(s,'c1','c2','今年的雨来得早。');
 assert.match(pairTalkError(s,'c1','c2',true),/今天.*已经聊过/);
 assert.equal(pairTalkError({...s,day:s.day+1},'c1','c2',true),'');
 assert.equal(pairKey('c1','c2'),pairKey('c2','c1'),'两头是同一对');
 // 重开一次这条记录还在
 assert.equal(restoreState(JSON.parse(JSON.stringify(s))).pairTalks[pairKey('c1','c2')],s.day);
});

test('她撞见的这一幕会进近来的小事',()=>{
 const s=notePairTalk(two(),'c1','c2','今年的雨来得早。');
 const lines=recentHappenings(s).map(x=>x.text).join('\n');
 assert.match(lines,/阿甲和阿乙/);
 assert.match(lines,/今年的雨来得早/);
});

// ⚠️一枪里坐着两个人：谁的主线记忆都不给，只给人设和眼前这个村子
test('发给这两位的那一份里没有她和同行者之间的事',()=>{
 const s=notePairTalk(two(),'c1','c2','说了两句');
 const view=pairView(s,'c1','c2');
 const text=JSON.stringify(view);
 assert.deepEqual(view.这两位,['阿甲','阿乙']);
 assert.match(view.他们照过面,/次/);
 for(const k of ['同行者','亲密','相处','委托','礼物'])
  assert.doesNotMatch(text,new RegExp(k),'漏了「'+k+'」这一层');
 assert.ok(!('近来' in view)&&!('村里最近' in view),'happenings 一条都不许给');
});

test('她能看见的那个范围是一处写死的数',()=>{
 assert.equal(typeof PAIR_WATCH,'number');
 assert.ok(PAIR_WATCH>0&&PAIR_WATCH<=12);
});

// ── ① 他报方向那一句：差多少由代码判，怎么说才是他的 ───────────────
const S=MAPS.oldTower.sites;
const tower=role=>takeStarRole({...freshState(),map:'oldTower',
 position:{...S[STAR_SPOTS[role]].target},
 companion:{...freshState().companion,map:'oldTower',
  position:{...S[STAR_SPOTS[starOther(role)]].target}}},role);

test('差哪一档是个数，四档各有各的白话',()=>{
 let s=tower('dial');
 const bands=new Set();
 for(let i=0;i<12;i++){bands.add(starBand(s));s=turnStar(s,1);}
 assert.ok(bands.has('done')&&bands.has('far')&&bands.has('close'),'四档要都够得着');
});

test('他没腔调也说得出话，方向那半句永远是代码接的',()=>{
 let s=tower('dial');
 while(starBand(s)==='done')s=turnStar(s,1);
 const plain=starReading(s,null);
 assert.ok(plain.length,'没那一枪也得说得出来');
 assert.match(plain,starGap(s)>0?/往右边。$/:/往左边。$/);
 const mine=starReading(s,{[starBand(s)]:'还差着好些呢'});
 assert.ok(mine.startsWith('还差着好些呢'),'前半句换成他的说法');
 assert.match(mine,/往[左右]边。$/,'方向不许模型编');
});

test('对上了就不报方向了',()=>{
 let s=tower('dial');
 while(starBand(s)!=='done')s=turnStar(s,1);
 assert.doesNotMatch(starReading(s,{done:'对上了'}),/往[左右]/);
});

test('腔调残缺就退回白话，不许拼出半句',()=>{
 let s=tower('dial');
 while(starBand(s)==='done')s=turnStar(s,1);
 for(const bad of [{},{[starBand(s)]:'  '},{[starBand(s)]:42}])
  assert.equal(starReading(s,bad),starReading(s,null));
});
