import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,MAPS,STAR_MARKS,STAR_SPOTS,STAR_ROLES,starTarget,restoreStar,
 starError,takeStarRole,starLeave,starLive,starOther,turnStar,starGap,starReading,starAligned,
 alignStar,starDone,recentHappenings} from './world.mjs';
import {plannedActivity,companionPlan} from './companion.mjs';
// 她 2026-09-18：「做吧宝宝」——codex 提的②：两个人各做一半，合起来才成

const S=MAPS.oldTower.sites;
const tower=(role)=>{
 let s={...freshState(),map:'oldTower',position:{...S[STAR_SPOTS[role||'dial']].target},
  companion:{...freshState().companion,map:'oldTower',position:{...S[STAR_SPOTS[starOther(role||'dial')]].target}}};
 return role?takeStarRole(s,role):s;};

test('两个人都得在塔里、都得站到位置上',()=>{
 const s=tower();
 assert.match(starError({...s,map:'garden'},'dial'),/观星室/);
 assert.match(starError({...s,companion:{...s.companion,map:'garden'}},'dial'),/还没上来/);
 assert.match(starError({...s,position:{x:0,z:6}},'dial'),/先走到.*铜环星仪/);
 assert.match(starError(s,'nope'),/先挑一头/);
 assert.equal(starError(s,'dial'),'');
 const outside={...s,map:'garden'};
 assert.equal(takeStarRole(outside,'dial'),outside,'占不了就什么都不许变');
});

// ⚠️这一句就是「配合」本身
test('转的人看不见差多少，看的人转不动那个环',()=>{
 const s=tower('dial');
 // 差多少是台上那一位的眼睛：这一份只有一处算
 assert.equal(typeof starGap(s),'number');
 assert.ok(Math.abs(starGap(s))<=STAR_MARKS/2,'一圈十二格，最远差六格');
 assert.match(starReading(s),/光|往/);
 // 她占哪一头，他就去另一头
 assert.equal(starOther('dial'),'watch');
 assert.equal(starOther('watch'),'dial');
 assert.equal(starOther(''),'');
});

// ⚠️count() 把负数夹成 0：往左转不动，只能一路往右绕
test('左右都转得动，一圈绕得回来',()=>{
 let s=tower('dial');
 const a=restoreStar(s.star).angle;
 assert.equal(restoreStar(turnStar(s,1).star).angle,(a+1)%STAR_MARKS);
 assert.equal(restoreStar(turnStar(s,-1).star).angle,(a-1+STAR_MARKS)%STAR_MARKS);
 // 一格一格转，最多六步一定对得上
 let steps=0;
 while(!starAligned(s)&&steps++<STAR_MARKS)s=turnStar(s,Math.sign(starGap(s)));
 assert.ok(starAligned(s),'转不到');
 assert.ok(steps<=STAR_MARKS/2,'走了 '+steps+' 步，比半圈还远，说明转反了');
 // 没开始的时候转不动
 const idle=tower();
 assert.equal(turnStar(idle,1),idle,'没开始的时候转不动');
});

test('今晚哪一格由存档号加天数定死，同一天进来都是那一格',()=>{
 const s=tower();
 assert.equal(starTarget(s),starTarget({...s}));
 const days=new Set();for(let d=1;d<=24;d++)days.add(starTarget({...s,day:d}));
 assert.ok(days.size>=5,'天天都是同一格就没意思了，实际只有 '+days.size+' 种');
 assert.ok(starTarget(s)<STAR_MARKS&&starTarget(s)>=0);
});

// ⚠️一个人把环转对了不算数
test('两个人都在位置上才算对上，而且一晚一次',()=>{
 let s=tower('dial');
 while(!starAligned(s))s=turnStar(s,Math.sign(starGap(s)));
 // 他走开了：对上了也不结算
 const alone={...s,companion:{...s.companion,position:{x:0,z:6}}};
 assert.equal(alignStar(alone),alone,'他不在位置上就不算');
 const out=alignStar(s);
 assert.notEqual(out,s);
 assert.equal(starDone(out),true);
 assert.equal(out.stones,s.stones+1);
 assert.match(recentHappenings(out,1)[0].text,/铜环/);
 // 一晚一次
 assert.equal(alignStar(out),out);
 assert.match(starError(out,'dial'),/明晚再来/);
 // 没对上不许结算
 const off=turnStar(s,1);
 assert.equal(alignStar(off),off);
 // 存了再读回来还认得这一晚
 assert.equal(starDone(restoreState(JSON.parse(JSON.stringify(out)))),true);
});

// ⚠️tick 在 routine 模式绕开 companionPlan——这一课这一季栽过三次了
test('她占一头，他就去另一头（两个调用方给同一个答案）',()=>{
 const s=tower('dial');
 assert.equal(plannedActivity(s).label,'在台上替你看光');
 assert.deepEqual(plannedActivity(s).target,S.telescope.target);
 const w=takeStarRole({...tower(),position:{...S.telescope.target}},'watch');
 assert.equal(plannedActivity(w).label,'在楼下替你转铜环');
 assert.deepEqual(plannedActivity(w).target,S.orrery.target);
 // 站远一点问，免得撞上「到你身边陪着」那条
 const away={...s,position:{x:0,z:6}};
 assert.equal(companionPlan(away).id,plannedActivity(away).id);
 // 收了这一头，他就回自己的日子
 assert.notEqual(plannedActivity(starLeave(s)).label,'在台上替你看光');
 assert.equal(starLive(starLeave(s)),false);
});

test('这一整条一枪都不打',()=>{
 for(const k of Object.keys(STAR_ROLES)) assert.ok(MAPS.oldTower.sites[STAR_SPOTS[k]],k+' 的站位要真的存在');
});
