const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('实际进屋状态只留内存，按角色隔离、离开清除，旧现场自动过期',()=>{
 let now=1;const env={Date:{now:()=>now}};vm.createContext(env);vm.runInContext(fs.readFileSync('js/char-day-link.js','utf8'),env);
 const link=env.CharDayLink;link.setPresence('a',{present:true,interaction:'hug',interactionLabel:'拥抱',interactionPhase:'walking-you'});
 assert.match(link.presenceFor('a'),/正在走到拥抱/);assert.equal(link.presenceFor('b'),'');link.setPresence('a',{present:true,interaction:'hug',interactionLabel:'拥抱',interactionPhase:'active'});assert.match(link.presenceFor('a'),/拥抱中/);
 now=16002;assert.equal(link.presenceFor('a'),'');now=20000;link.setPresence('a',{present:true,seated:true});assert.match(link.presenceFor('a'),/已坐下/);link.setPresence('a',null);assert.equal(link.presenceFor('a'),'');
});
test('共用上下文接现场状态，群中仍落在对应角色私有背景，动作不另开模型或聊天writer',()=>{
 const app=fs.readFileSync('js/app.js','utf8'),engine=fs.readFileSync('js/engine.js','utf8'),scene=fs.readFileSync('apps/fairy-garden/day/together.mjs','utf8'),page=fs.readFileSync('js/char-day.js','utf8');
 assert.match(app,/charDayPresence: window\.CharDayLink\?\.presenceFor\(char\.id\)/);assert.match(app,/charDayPresence: window\.CharDayLink\?\.presenceFor\(c\.id\)/);assert.match(app,/memberCharDayPresence: backgroundMap\("charDayPresence"\)/);assert.match(engine,/if \(ctx\.charDayPresence\) parts\.push\(ctx\.charDayPresence\)/);assert.match(engine,/ctx\.memberCharDayPresence\[c\.id\]/);
 assert.doesNotMatch(scene,/saveJSON|localStorage|callAI|runProbe|pChat/);assert.match(page,/GardenDressControls/);assert.match(page,/saveHomeChange\("me","looks"/);assert.match(page,/cdayinteraction/);assert.match(page,/cdayprofessional/);assert.match(page,/safe-area-inset-bottom\) \* 0\.4/);
});

test('小屋现场沿原房间认知闸隔离，庭院样貌按实际小人writer读取',()=>{
 const rooms=require('../js/chat-rooms.js'),ctx={charDayPresence:'拥抱中'};assert.equal(rooms.gateCtx(ctx,{cognition:{}}).charDayPresence,'');assert.equal(rooms.gateCtx(ctx,{cognition:{otherScenes:true}}).charDayPresence,'拥抱中');
 const game=fs.readFileSync('apps/fairy-garden/game.mjs','utf8'),host=fs.readFileSync('js/fairy-garden.js','utf8'),page=fs.readFileSync('js/char-day.js','utf8');assert.match(game,/else data=\{\.\.\.data,look:merge\(data\.look\)\}/);assert.match(host,/worldOf\(loadJSON\(key,null\)\|\|\{\},"garden"\)\?\.look/);assert.match(page,/!book&&!homeOptions&&!current\.preview/);assert.match(page,/visibility:mePanel\?"hidden":"visible"/);
});
