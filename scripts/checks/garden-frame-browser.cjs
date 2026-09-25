const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const w=await import('./apps/fairy-garden/world.mjs');const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');x.fillStyle='#a87';x.fillRect(0,0,300,200);const src=c.toDataURL('image/jpeg',.8);
 let g=w.freshState();g=w.receiveTravelArt(g,{id:'art-g',src,at:Date.UTC(2026,8,25,5),day:4,kind:'puzzle',label:'12片拼图 · 海边',memory:{version:1,count:12,you:6,companion:6,companionName:'同行测试',photographer:'你',lastBy:'companion',day:4}});
 const train={version:1,map:'carriage',day:4,startDay:4,minute:600,epoch:'t',distance:0,routeStart:0,photos:[],artworks:[{id:'art-g',at:Date.UTC(2026,8,25,5),puzzleKey:'k',src,label:'12片拼图 · 海边',day:4,kind:'puzzle'}]};
 saveJSON('x_fairyGarden:frame-test',{version:1,id:'frame-save',partnerId:'p1',activeWorld:'garden',world:g,worlds:{garden:g,train},journey:{},dialogs:{}});
 window.calls=[];callAI=async(a,sys)=>{calls.push(sys);return '{"line":"海风那天你笑得很大声。"}';};
 const el=document.createElement('div');el.id='frame-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:frame-test',entryWorld:'garden',characters:[{id:'p1',name:'同行测试'}],active:{test:true},profile:{name:'测试'},toast:m=>console.log('TOAST',m),onBack:()=>{}}));});
const root=p.locator('#frame-root');await p.waitForFunction(()=>document.querySelector('#frame-root iframe')?.contentWindow.FairyGardenGame?.getTravelFrame,null,{timeout:120000});await root.getByRole('button',{name:'花册'}).waitFor();await p.waitForFunction(()=>!document.querySelector('#frame-root button[disabled]')||true);
// 场景里点到相框＝宿主 openFrame
await p.evaluate(()=>{const w=document.querySelector('#frame-root iframe').contentWindow;window.FairyGardenHostFor(w).openFrame('tf_artg');});
const sheet=root.locator('[data-frame-sheet]');await sheet.waitFor();
await sheet.locator('textarea').fill('海边那一次');await sheet.getByRole('button',{name:'写上'}).click();await p.waitForFunction(()=>document.querySelector('#frame-root iframe').contentWindow.FairyGardenGame.getTravelFrame('art-g')?.back?.you==='海边那一次');
await sheet.getByRole('button',{name:'请 TA 也写一句'}).click();await p.waitForFunction(()=>document.querySelector('#frame-root iframe').contentWindow.FairyGardenGame.getTravelFrame('art-g')?.back?.companion);
assert.ok((await p.evaluate(()=>calls[0])).includes('海边那一次'));
await sheet.getByRole('button',{name:'翻看背面'}).click();const back=await sheet.locator('[data-frame-back]').innerText();assert.ok(back.includes('2026 年 9 月 25 日')&&back.includes('旅途第 4 天')&&back.includes('海边那一次')&&back.includes('海风那天'),back);
await sheet.getByRole('button',{name:'看看正面'}).click();await sheet.getByRole('button',{name:'看大图'}).click();await p.locator('[data-frame-big]').waitFor();await p.getByRole('button',{name:'关闭大图'}).click();
// 列车相册那边也跟着改
const tr=await p.evaluate(()=>loadJSON('x_fairyGarden:frame-test').worlds.train.artworks[0].back);assert.equal(tr.you,'海边那一次');assert.equal(tr.companion,'海风那天你笑得很大声。');
assert.deepEqual(errors,[]);console.log('PASS garden frame sheet: open from scene hook, her line + TA line, back shows date/day/notes, big view, train album synced');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
