import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,moveIn,moveOut,moveInError,neighborOf,restoreNeighbors,
 walkSpeedFor,MAPS} from './world.mjs';
// 她 2026-09-17：「如果我让 a 做邻居然后邀请 a 同行的话就会变成有两个」

test('一个人不能同时是邻居又是同行者',()=>{
 let s=moveIn(freshState(),{charId:'a',name:'阿棠'});
 assert.ok(neighborOf(s,'a'));
 // 世界这边知道同行者是谁，闸才关得上
 s={...s,partnerId:'a'};
 assert.match(moveInError(s,'a'),/已经和你住在一起/);
 // 他跟你一起住了，那间屋就该空出来
 s=moveOut(s,'a');
 assert.equal(neighborOf(s,'a'),null);
 assert.equal(restoreNeighbors(s.neighbors).length,0);
});

// ⚠️这个 id 以前【从来没人写过】，于是那道闸一次都没响过
test('同行者是谁要跟着存档走',()=>{
 assert.equal(freshState().partnerId,'');
 const s=restoreState({version:9,partnerId:'c7'});
 assert.equal(s.partnerId,'c7');
 assert.equal(restoreState({version:9,partnerId:{}}).partnerId,'','不是字符串就当没有');
 assert.equal(restoreState({version:9,partnerId:'x'.repeat(200)}).partnerId.length,64);
});

// 她 2026-09-17：「地图太大走路太慢了，从一头到另一头要大半天」
test('走多大的地方就走多快',()=>{
 const village=walkSpeedFor('garden'),room=walkSpeedFor('home');
 assert.ok(village>room*1.6,'村子比屋里快得出来：'+village+' vs '+room);
 assert.ok(village<=3.2&&room>=1.45,'屋里不许快到像在滑');
 // 村子横跨一趟从一分多钟压到半分钟上下
 const across=MAPS.garden.radius*2;
 assert.ok(across/village<45,'走完整个村子还要 '+(across/village).toFixed(0)+' 秒');
 assert.ok(across/1.45>70,'原来那一档确实要一分多钟');
 // 没有这张图的时候也得给个能走的数
 assert.equal(walkSpeedFor('nowhere'),1.45);
});
