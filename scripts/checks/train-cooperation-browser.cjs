const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
// v74.042：拼图的照片／片数／玩法收进了顶上那条「12 片 · 自己拼 / 改」，点之前先展开
const openSetup=async f=>{await f.evaluate(()=>{const d=document.querySelector('#desk-setup');if(d)d.open=true;});return f;};
// v74.042：拼图时聊天收在右上角头像里，打字前先点开（旅途聊天默认就是开的，点不点都一样）
const openDock=async f=>{await f.evaluate(()=>{const p=document.querySelector('#puzzle-desk'),b=document.querySelector('#desk-peer');if(p&&p.dataset.dock!=='open'&&b&&!b.hidden)b.click();});return f;};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {startTrip}=await import('./apps/train/travel.mjs');const train=startTrip({day:20,minute:700,epoch:'test'},()=>.1);saveJSON('x_fairyGarden:puzzle-test',{version:1,id:'puzzle-test',partnerId:'puzzle-person',activeWorld:'train',worlds:{train},world:null,journey:{},dialogs:{}});window.puzzleCalls=[];window.callAI=async(active,sys,msg,opts)=>{puzzleCalls.push({sys,msg,opts});await new Promise(r=>setTimeout(r,600));return JSON.stringify({reply:['这块我来试试。'],action:{kind:'none'}});};const el=document.createElement('div');el.id='puzzle-test-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);window.puzzleRoot=ReactDOM.createRoot(el);window.renderPuzzleTest=()=>puzzleRoot.render(React.createElement(FairyGardenApp,{key:Date.now(),storeKey:'x_fairyGarden:puzzle-test',characters:[{id:'puzzle-person',name:'同行测试',persona:'仔细、沉稳'}],active:{test:true},profile:{name:'测试'},mainline:'ROOM_CONTEXT_SENTINEL',toast:()=>{},onBack:()=>{}}));renderPuzzleTest();});
await p.waitForFunction(()=>document.querySelector('#puzzle-test-root iframe')?.contentWindow.TrainGame?.ready);let f=p.frames().find(f=>f.url().includes('/apps/train/index.html'));
await f.evaluate(()=>{const original=TrainGame.chatContext;parent.sentTrainEnvironments=[];TrainGame.chatContext=()=>{const result=original();parent.sentTrainEnvironments.push(result.environment);return result;};});
await f.locator('#take-photo').click();await p.locator('#camera-shoot').click();await p.locator('[data-train-toolbar] [data-watch=back]').click();await f.locator('#open-puzzle').click();await (await openSetup(f)).locator('#desk-new').click();await f.waitForFunction(()=>TrainGame.desk.debug().puzzle?.count===12);await f.locator('#puzzle-reference').evaluate(el=>el.decode());

async function movePiece(id,destination){
 await f.locator('#puzzle-canvas').scrollIntoViewIfNeeded();
 const box=await f.locator('#puzzle-canvas').boundingBox(),d=await f.evaluate(async id=>{const {target}=await import('./puzzle.mjs');const d=TrainGame.desk.debug();return{q:d.puzzle.pieces[id],t:target(d.puzzle,id),c:d.camera};},id);
 const at=(x,y)=>({x:box.x+d.c.x+x*d.c.s,y:box.y+d.c.y+y*d.c.s});
 const a=at(d.q.x+d.t.w/2,d.q.y+d.t.h/2),z=destination==='handoff'?at(500,1270):at(d.t.x+d.t.w/2,d.t.y+d.t.h/2);
 await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y,{steps:16});await p.mouse.up();
}
await (await openSetup(f)).locator('[data-mode=together]').click();
await f.locator('#desk-fetch').click();
await f.waitForFunction(()=>TrainGame.desk.debug().puzzle.cooperation?.pending?.kind==='ready');
const delivered=await f.evaluate(()=>TrainGame.desk.debug().puzzle.cooperation.pending.id);
assert.equal(await f.evaluate(()=>TrainGame.desk.debug().puzzle.pieces.filter(q=>q.locked).length),0);
await p.screenshot({path:'/tmp/train-cooperation-delivery.png'});
await (await openDock(f)).locator('#desk-message').fill('你刚才递给我的是哪片？');await f.locator('#desk-send').click();await f.waitForFunction(()=>document.querySelector('#desk-chat').textContent.includes('你刚才递给我的是哪片'));
const call=await p.evaluate(()=>puzzleCalls.at(-1));const world=JSON.parse(call.sys.split('【当前世界的事实】\n')[1].split('\n\n')[0]);assert.equal(world.puzzle.cooperation.pending.piece,delivered+1);assert.match(world.puzzle.cooperation.pending.action,/等你接过/);
// Reopen the real archive, keeping a delivered piece and its exact position.
await f.evaluate(()=>TrainGame.flush());const detached=p.waitForEvent('framedetached',x=>x===f);await p.evaluate(()=>renderPuzzleTest());await detached;await p.waitForFunction(()=>document.querySelector('#puzzle-test-root iframe')?.contentWindow.TrainGame?.ready);f=p.frames().find(x=>x.url().includes('/apps/train/index.html'));await f.locator('#open-puzzle').click();await f.waitForFunction(()=>TrainGame.desk.debug().puzzle?.cooperation?.pending?.kind==='ready');
await movePiece(delivered,'target');assert.equal(await f.evaluate(id=>TrainGame.desk.debug().puzzle.pieces[id].by,delivered),'you');
// A real handoff, animated attempt, and contribution only if it actually fits.
const free=await f.evaluate(()=>TrainGame.desk.debug().puzzle.pieces.find(q=>!q.locked).id);await movePiece(free,'handoff');await f.waitForFunction(id=>TrainGame.desk.debug().puzzle.cooperation?.last?.piece===id+1&&TrainGame.desk.debug().puzzle.cooperation?.last?.kind==='同行者尝试你递来的碎片',free);
const attempted=await f.evaluate(()=>TrainGame.desk.debug().puzzle.cooperation.last);assert.equal(typeof attempted.matched,'boolean');
// Freeze autonomous moves with a delivered piece, then check failed persistence leaves that request untouched.
await f.locator('#desk-fetch').click();await f.waitForFunction(()=>TrainGame.desk.debug().puzzle.cooperation?.pending?.kind==='ready');const saved=await f.evaluate(()=>structuredClone(TrainGame.desk.debug().puzzle));
await p.evaluate(()=>{window.originalPuzzleSave=saveJSON;window.saveJSON=(k,v)=>k==='x_fairyGarden:puzzle-test'?false:originalPuzzleSave(k,v);});await (await openSetup(f)).locator('[data-mode=self]').click();assert.deepEqual(await f.evaluate(()=>TrainGame.desk.debug().puzzle),saved);await p.evaluate(()=>{window.saveJSON=originalPuzzleSave;});
await (await openSetup(f)).locator('[data-mode=self]').click();assert.equal(await f.evaluate(()=>TrainGame.desk.debug().puzzle.cooperation.pending),null);
// Finish eleven real placements; together mode must leave the last piece untouched.
const finalPiece=await f.evaluate(()=>TrainGame.desk.debug().puzzle.pieces.filter(q=>!q.locked).at(-1).id);
for(let id=0;id<12;id++)if(id!==finalPiece&&!await f.evaluate(id=>TrainGame.desk.debug().puzzle.pieces[id].locked,id))await movePiece(id,'target');

await (await openSetup(f)).locator('[data-mode=together]').click();await p.waitForTimeout(6500);assert.equal(await f.evaluate(id=>TrainGame.desk.debug().puzzle.pieces[id].locked,finalPiece),false);assert.match(await f.locator('#desk-cooperation-status').innerText(),/最后一片/);
for(const size of [{width:320,height:568},{width:667,height:375}]){await p.setViewportSize(size);await f.waitForFunction(w=>innerWidth===w,size.width);await f.locator('#desk-fetch').scrollIntoViewIfNeeded();assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'/tmp/train-cooperation-'+size.width+'.png'});}
await p.setViewportSize({width:390,height:844});await f.waitForFunction(()=>innerWidth===390);await movePiece(finalPiece,'target');assert.equal(await f.evaluate(()=>TrainGame.desk.debug().puzzle.completed),true);assert.match(await f.locator('#desk-progress').innerText(),/你 \d+ · TA \d+/);// The human finishes the penultimate piece while the companion is already carrying the other.
await (await openSetup(f)).locator('#desk-new').click();await f.waitForFunction(()=>TrainGame.desk.debug().puzzle?.moves===0);await f.evaluate(async()=>{const {drop,target}=await import('./puzzle.mjs');const d=TrainGame.desk.debug().puzzle;for(let id=0;id<10;id++){const t=target(d,id);drop(d,id,t.x,t.y);}TrainGame.flush();});await (await openSetup(f)).locator('[data-mode=together]').click();await f.waitForFunction(()=>TrainGame.desk.debug().companionMove);const moving=await f.evaluate(async()=>{const {drop,target}=await import('./puzzle.mjs');const d=TrainGame.desk.debug(),other=d.puzzle.pieces.find(q=>!q.locked&&q.id!==d.companionMove.id),t=target(d.puzzle,other.id);drop(d.puzzle,other.id,t.x,t.y);TrainGame.flush();return d.companionMove.id;});await p.waitForTimeout(5000);assert.equal(await f.evaluate(id=>TrainGame.desk.debug().puzzle.pieces[id].locked,moving),false);assert.equal(await f.evaluate(()=>TrainGame.desk.debug().companionMove),null);
assert.deepEqual(errors,[]);console.log('PASS actual two-way handoffs, animated delivery/attempt, contextual chat, archive reload, save rollback, last piece reserved, real final drop, 320/390/landscape');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
