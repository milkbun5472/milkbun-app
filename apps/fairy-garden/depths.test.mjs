import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,NODES,freshState,perform,targetFor,actionError,deepestAllowed,restoreState,walkable} from './world.mjs';
const at=(s,k,id)=>({...s,position:targetFor(s,k,id)});
const act=(s,k,id)=>perform(at(s,k,id),k,id);
// 星井（她 2026-09-16 点名的「井底下潜」）。这一份钉的是【下去-刨-再往下-上来】这个圈。
test('下去、刨一处、再往下、爬上来：一圈走得通，时间跟着走',()=>{
 let s=freshState();
 assert.equal(s.depth,0);
 s=act(s,'dive');
 assert.equal(s.map,'depths');assert.equal(s.depth,1);
 assert.equal(s.minute,480+45,'下去要花 45 分钟');
 const vein=NODES.find(n=>n.map==='depths'&&n.depth===1);
 s=act(s,'gather',vein.id);
 assert.ok(s.sand>0,'第一层刨出来的应该是星砂');
 assert.equal(act(s,'gather',vein.id).sand,s.sand,'同一处不许刨两次');
 s=act(s,'deeper');assert.equal(s.depth,2);assert.equal(s.minute,480+45+35);
 s=act(s,'ladder');
 assert.equal(s.map,'garden');assert.equal(s.depth,0,'上来了就不该还记着层数');
 assert.deepEqual(s.position,MAPS.depths.exits.ladder.at,'爬上来该站在井口，不是村口');
});

test('往下的路由月石打通，不是想下多深就多深',()=>{
 const s={...freshState(),map:'depths',depth:3};
 assert.equal(deepestAllowed(s),3);
 assert.match(actionError(s,'deeper'),/月石/,'挡住的时候要说清楚怎么才能再往下');
 assert.equal(act(s,'deeper').depth,3,'挡住了就真的不许下去');
 const rich={...s,stones:2};
 assert.equal(deepestAllowed(rich),7);
 assert.equal(act(rich,'deeper').depth,4);
});

test('深处才有月石，而且它同时是钥匙和收获',()=>{
 const deep=NODES.filter(n=>n.map==='depths'&&n.depth>=5);
 assert.ok(deep.some(n=>n.kind==='stone'),'深层一颗月石都不出，下潜就没有进度');
 const shallow=NODES.filter(n=>n.map==='depths'&&n.depth<3);
 assert.ok(shallow.every(n=>n.kind==='sand'),'前两层不该直接给月石');
 const stone=deep.find(n=>n.kind==='stone');
 const s=act({...freshState(),map:'depths',depth:stone.depth,stones:9},'gather',stone.id);
 assert.equal(s.stones,10);
});

test('星砂能换月露——下井得有个即时回报',()=>{
 const s={...freshState(),sand:3};
 assert.equal(actionError(s,'brew'),'','有星砂就该能炼');
 const out=act(s,'brew');
 assert.deepEqual([out.sand,out.potions,out.herbs],[0,1,0]);
 // 没星砂时照旧走老配方，别把原来那条路顶掉
 const old={...freshState(),herbs:2,mushrooms:1,water:1};
 assert.deepEqual([act(old,'brew').potions,act(old,'brew').herbs],[1,0]);
 assert.match(actionError(freshState(),'brew'),/星砂/,'提示里要写出新的那条路');
});

test('井底不是庭院：睡觉、逛村子、炼药都不在这儿',()=>{
 const s={...freshState(),map:'depths',depth:1};
 assert.equal(perform(s,'rest'),s,'井底不许睡到明天');
 assert.ok(actionError(s,'brew'),'炼药锅在地面上');
 assert.ok(actionError(s,'garden'),'花圃在地面上');
 assert.equal(actionError(s,'ladder'),'','梯子随时能上');
});

test('每一层各刨各的，层数存得住',()=>{
 const a=NODES.filter(n=>n.map==='depths'&&n.depth===2).map(n=>n.id);
 const b=NODES.filter(n=>n.map==='depths'&&n.depth===3).map(n=>n.id);
 assert.equal(new Set([...a,...b]).size,a.length+b.length,'两层的矿脉不能是同一批 id');
 for(const n of NODES.filter(n=>n.map==='depths'))assert.ok(walkable(n.x,n.z,'depths'),'矿脉长在石壁里了：'+n.id);
 assert.equal(restoreState({version:6,map:'depths',depth:4}).depth,4);
 assert.equal(restoreState({version:6,map:'garden',depth:4}).depth,0,'人在地面上就不该还记着层数');
});
