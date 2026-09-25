const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {freshState}=await import('./apps/fairy-garden/world.mjs');const {startTrip}=await import('./apps/train/travel.mjs');const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');x.fillStyle='#7a9';x.fillRect(0,0,300,200);const src=c.toDataURL('image/jpeg',.8);
 const g=freshState(),train=startTrip({day:3,minute:600,epoch:'t'},()=>0,null);train.photos=[{id:'photo-a',at:Date.UTC(2026,8,25,4),day:3,src,label:'山谷窗景',photographer:{role:'you'}}];train.artworks=[{id:'art-a',at:Date.UTC(2026,8,25,5),puzzleKey:'photo-a:1',photoId:'photo-a',src,label:'12片拼图 · 山谷窗景',count:12,day:3,kind:'puzzle',memory:{version:1,count:12,you:7,companion:5,companionName:'同行测试',photographer:'你',lastBy:'you',day:3}}];
 saveJSON('x_fairyGarden:back-test',{version:1,id:'back-save',partnerId:'p1',activeWorld:'train',world:g,worlds:{garden:g,train},journey:{},dialogs:{}});
 window.calls=[];callAI=async(active,sys)=>{calls.push(sys);return '{"line":"窗外那片山谷，我记得是你先拼出来的。"}';};
 const el=document.createElement('div');el.id='back-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:back-test',entryWorld:'train',characters:[{id:'p1',name:'同行测试'}],active:{test:true},profile:{name:'测试'},toast:()=>{},onBack:()=>{}}));});
const root=p.locator('#back-root');await p.waitForFunction(()=>document.querySelector('#back-root iframe')?.contentWindow.TrainGame?.ready,null,{timeout:120000});
const f=p.frames().find(f=>f.url().includes('/apps/train/'));await f.locator('#open-album').click();
await root.getByText('12片拼图 · 山谷窗景').first().click();
const notes=root.locator('[data-back-notes]');await notes.waitFor();
await notes.locator('textarea').fill('第一次一起拼完');await notes.getByRole('button',{name:'写上'}).click();await root.getByText('写在背面了。').waitFor();
await notes.getByRole('button',{name:'请 TA 也写一句'}).click();await root.getByText('TA 在背面写了一句。').waitFor();
let d=await p.evaluate(()=>loadJSON('x_fairyGarden:back-test'));const art=d.worlds.train.artworks[0];assert.equal(art.back.you,'第一次一起拼完');assert.equal(art.back.companion,'窗外那片山谷，我记得是你先拼出来的。');
assert.ok((await p.evaluate(()=>calls[0])).includes('第一次一起拼完'),'TA sees her line');
// 背面：日期、纪念、两句
await root.getByRole('button',{name:'翻看背面'}).click();const back=root.locator('[data-frame-back]');assert.ok((await back.innerText()).includes('2026 年 9 月 25 日'));assert.ok((await back.innerText()).includes('旅途第 3 天'));assert.ok((await back.innerText()).includes('第一次一起拼完'));assert.ok((await back.innerText()).includes('同行测试 写'));
await root.getByRole('button',{name:'看看正面'}).click();
// 大图
await root.getByRole('button',{name:'看大图'}).click();await p.locator('[data-frame-big]').waitFor();await p.getByRole('button',{name:'关闭大图'}).click();assert.equal(await p.locator('[data-frame-big]').count(),0);
// 带回庭院后，背面一起带过去；之后再改也跟着改
await root.getByRole('button',{name:'带回庭院'}).click();await root.getByText(/已带回庭院/).first().waitFor();
await notes.locator('textarea').fill('改一下');await notes.getByRole('button',{name:'改成这句'}).click();await root.getByText('写在背面了。').waitFor();
d=await p.evaluate(()=>loadJSON('x_fairyGarden:back-test'));const frame=d.worlds.garden.things.find(t=>t.sourceId==='art-a');assert.equal(frame.back.you,'改一下');assert.equal(frame.back.companion,'窗外那片山谷，我记得是你先拼出来的。');assert.ok(frame.back.at);
const kept=await p.evaluate(async()=>{const m=await import('./apps/fairy-garden/world.mjs');return m.restoreState(loadJSON('x_fairyGarden:back-test').worlds.garden).things.find(t=>t.sourceId==='art-a').back;});assert.equal(kept.you,'改一下');
assert.deepEqual(errors,[]);console.log('PASS frame back: her line + TA line saved, back shows date/day/memory/notes, big view opens/closes, carried frame keeps and follows edits, survives restore');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
