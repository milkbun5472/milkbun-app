const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('在家默认双人，外出按地点手选；手动离开、工作与预览守住各自边界',()=>{
 const scene=read('apps/fairy-garden/day/scene.mjs'),page=read('js/char-day.js'),visit=read('apps/fairy-garden/day/visit.mjs');
 assert.match(page,/rememberHomeChoice\('away'\)/);assert.match(page,/saveHomeChange\(charId,'presence',choice\)/);
 assert.match(scene,/homePresence!=='away'/);assert.match(scene,/!homeAutoSuppressed/);assert.match(scene,/joinVisit\(\{automatic:true\}\)/);
 assert.match(scene,/!visitSetting\(\)/);assert.match(scene,/social\.setting\(data\)/);assert.match(scene,/if\(next===signature\)return/);
 assert.doesNotMatch(visit,/localStorage|saveJSON|commitJSON|callAI|runProbe|pChat|schedules/);
 for(const mechanism of ['stepRoute','segmentClear','findPath'])assert.ok(visit.includes(mechanism+'('));
});
test('现场底栏复用原尺寸和安全区，空地点击使用原手势，聊天开合保持场景',()=>{
 const page=read('js/char-day.js'),scene=read('apps/fairy-garden/day/scene.mjs');
 const a=page.indexOf('    const navButton='),b=page.indexOf('    const styleView=',a);assert.ok(a>0&&b>a);const tools=page.slice(a,b);
 assert.match(page,/minHeight: ?56/);assert.match(page,/safe-area-inset-bottom\) \* 0\.4/);assert.match(page,/data-wk": "cdaytools/);assert.match(tools,/minWidth:0/);
 assert.match(scene,/onTap:\(x,y\)=>/);assert.match(scene,/visitAction\('walk'/);assert.match(scene,/createTraveler\(travelerSource,false\)/);
 assert.match(scene,/if\(visitorAvatar\)disposeMap\(visitorAvatar\.root\)/);assert.match(page,/key: char\.id \+ ":" \+ retry/);
});
