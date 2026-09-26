const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {freshState}=await import('./apps/fairy-garden/world.mjs');const g=freshState();g.position={x:0,z:38};saveJSON('x_fairyGarden:board',{version:1,id:'board',partnerId:'p1',activeWorld:'garden',world:g,worlds:{garden:g},journey:{},dialogs:{}});const el=document.createElement('div');el.id='r';el.style.cssText='position:fixed;inset:0;z-index:999990';document.body.append(el);ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:board',entryWorld:'garden',characters:[{id:'p1',name:'甲'}],active:{test:true},toast:()=>{},onBack:()=>{}}));});
await p.waitForFunction(()=>document.querySelector('#r iframe')?.contentWindow.gardenDebug?.getReady?.(),null,{timeout:120000});const f=p.frames().find(f=>f.url().includes('fairy-garden/index'));
// 站台上（哪怕还在第一天的引导里）就有「登上列车」
await f.locator('#board-train').waitFor({state:'visible'});await f.locator('#board-train').click();
await f.waitForFunction(()=>gardenDebug.getArrival().playing,null,{timeout:20000});const a0=await f.evaluate(()=>gardenDebug.getArrival());
await f.waitForFunction(x=>gardenDebug.getArrival().x>x+10,a0.x,{timeout:60000});
await p.waitForFunction(()=>(document.querySelector('#r iframe')?.src||'').includes('/apps/train/'),null,{timeout:60000});
assert.deepEqual(errors,[]);console.log('PASS board button on platform (also first day), train pulls in along the track, then boards');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
