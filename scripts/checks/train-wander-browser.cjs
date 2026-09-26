const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {freshState}=await import('./apps/fairy-garden/world.mjs');const g=freshState();const train={version:1,map:'carriage',day:4,startDay:4,minute:600,epoch:'t',distance:0,routeStart:0,photos:[],artworks:[]};
 saveJSON('x_fairyGarden:wander-test',{version:1,id:'wander-save',partnerId:'p1',activeWorld:'train',world:g,worlds:{garden:g,train},journey:{},dialogs:{}});
 window.calls=[];callAI=async(a,sys)=>{calls.push(sys);return '{"reply":["我去把箱子理一理。"],"action":{"kind":"move","target":"rack"}}';};
 const el=document.createElement('div');el.id='w-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:wander-test',entryWorld:'train',characters:[{id:'p1',name:'同行测试'}],active:{test:true},profile:{name:'测试'},toast:()=>{},onBack:()=>{}}));});
await p.waitForFunction(()=>document.querySelector('#w-root iframe')?.contentWindow.TrainGame?.ready,null,{timeout:120000});const f=p.frames().find(f=>f.url().includes('/apps/train/'));
const ta=()=>f.evaluate(()=>{const c=TrainGame.passengers.people.find(x=>x.who==='companion');return {spot:c.spot,walking:c.path.length>0};});
await f.evaluate(()=>{Math.random=()=>.9;});/* 列车一天 4 分钟，跑慢了会到夜里：固定随机数，免得这一步抽到去卧铺 */
// 自己起身
await f.evaluate(()=>TrainGame.wanderNow());let t=await ta();assert.notEqual(t.spot,'seat');assert.ok(t.walking);
await f.evaluate(()=>{for(let i=0;i<120;i++)TrainGame.passengers.tick(performance.now()+i*100,.1,true);});
await f.evaluate(()=>TrainGame.wanderNow());t=await ta();assert.ok(t.walking,'walks back');await f.evaluate(()=>{for(let i=0;i<120;i++)TrainGame.passengers.tick(performance.now()+i*100,.1,true);});assert.equal((await ta()).spot,'seat');
// 拼图开着时不动
await f.locator('#open-puzzle').click();await f.evaluate(()=>TrainGame.wanderNow());assert.equal((await ta()).spot,'seat');await p.locator('[data-train-toolbar] [data-watch=back]').click();
// 聊天里说要去整理行李，就真去
await f.locator('#open-chat').click();const dock=f.locator('#desk-dock');if(await f.locator('#desk-message').isHidden()){await f.locator('.desk-peer,#desk-peer').first().click().catch(()=>{});}
await f.locator('#desk-message').fill('要不要活动一下');await f.locator('#desk-send').click();await f.waitForFunction(()=>!document.querySelector('#desk-send').disabled);
assert.ok((await p.evaluate(()=>calls.at(-1))).includes('rack'));
await p.locator('[data-train-toolbar] [data-watch=back]').click();
assert.equal((await ta()).spot,'rack','chat move honored');
assert.deepEqual(errors,[]);console.log('PASS TA wanders up and back on its own, stays put during puzzle, chat move action walks TA to the rack');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
