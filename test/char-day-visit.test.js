const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('进屋仅来自明确点击，真实在家且到位才可加入，预览和日程切换结束现场会话',()=>{
 const scene=read('apps/fairy-garden/day/scene.mjs'),page=read('js/char-day.js'),visit=read('apps/fairy-garden/day/visit.mjs');
 assert.match(page,/onClick:\(\)=>iframe\.current\?\.contentWindow\?\.CharDayScene\?\.joinVisit\?\.\(\)/);
 const start=scene.indexOf('async function joinVisit(){'),end=scene.indexOf('\nlet avatar=',start);assert.ok(start>0&&end>start);const join=scene.slice(start,end);
 assert.match(join,/route\.length\|\|map!=='dayHome'/);assert.match(join,/snapshot\.editing\|\|snapshot\.showcase\|\|snapshot\.preview/);
 assert.match(scene,/closeVisit\('TA的安排或小家布置变了/);assert.match(scene,/if\(next===signature\)return/);
 assert.doesNotMatch(visit,/localStorage|saveJSON|commitJSON|callAI|runProbe|pChat|schedules/);
 assert.match(visit,/stepRoute\(/);assert.match(visit,/segmentClear\(/);assert.match(visit,/findPath\(/);
});
test('现场底栏复用原尺寸和安全区，空地点击使用原手势，聊天开合保持场景',()=>{
 const page=read('js/char-day.js'),scene=read('apps/fairy-garden/day/scene.mjs');
 const a=page.indexOf('      visiting ? h('),b=page.indexOf('      editor ? h(',a);assert.ok(a>0&&b>a);const tools=page.slice(a,b);
 assert.match(tools,/minHeight:56/);assert.match(tools,/safe-area-inset-bottom\) \* 0\.4/);assert.match(tools,/data-wk":"cdaytools/);
 assert.match(scene,/onTap:\(x,y\)=>/);assert.match(scene,/visitAction\('walk'/);assert.match(scene,/createTraveler\(travelerSource,false\)/);
 assert.match(scene,/if\(visitorAvatar\)disposeMap\(visitorAvatar\.root\)/);assert.match(page,/key: char\.id \+ ":" \+ retry/);
});
