const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp&&window.RoomWorldBanner);
 await p.evaluate(async()=>{const {freshState,setGuide}=await import('./apps/fairy-garden/world.mjs');const s=setGuide(freshState(),false);s.herbs=29;
 saveJSON('x_fairyGarden::banner::room::same',{version:1,id:'banner-same',partnerId:'banner',world:s,worlds:{garden:s},dialogs:{banner:[{role:'user',content:'原记录'}]},journey:{}});
 const el=document.createElement('div');el.id='banner-test-root';el.style.cssText='position:fixed;inset:0;z-index:999999;background:#eee;height:100dvh';document.body.append(el);
 function Harness(){const [world,setWorld]=React.useState(null);return world?React.createElement(FairyGardenApp,{key:world,storeKey:'x_fairyGarden::banner::room::same',lockPartnerId:'banner',entryWorld:world,characters:[{id:'banner',name:'原同行者'}],toast:()=>{},onBack:()=>setWorld(null)}):React.createElement(RoomWorldBanner,{onEnter:setWorld});}
 ReactDOM.createRoot(el).render(React.createElement(Harness));});
 const root=p.locator('#banner-test-root');
 for(const width of [320,390]){await p.setViewportSize({width,height:844});for(const name of ['进入庭院','进入列车']){const box=await root.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box.width>0&&box.height>=44&&box.x>=0&&box.x+box.width<=width);}assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.screenshot({path:'/tmp/room-world-banner.png'});
 for(const world of ['train','garden','train']){
 await root.getByRole('button',{name:world==='train'?'进入列车':'进入庭院',exact:true}).click();
 await p.waitForFunction(world=>{const w=document.querySelector('#banner-test-root iframe')?.contentWindow;return world==='train'?w?.TrainGame?.ready:w?.gardenDebug?.getReady();},world);
 const frame=p.frames().find(f=>f.url().includes('/apps/'+(world==='train'?'train':'fairy-garden')+'/index.html'));assert.ok(frame);
 if(world==='garden')assert.equal(await frame.evaluate(()=>gardenDebug.getState().herbs),29);
 const back=root.locator('[data-watch=back]');await back.first().click();await root.getByRole('button',{name:'进入列车',exact:true}).waitFor();
 }
 const d=await p.evaluate(()=>loadJSON('x_fairyGarden::banner::room::same',null));assert.equal(d.id,'banner-same');assert.equal(d.partnerId,'banner');assert.equal(d.worlds.garden.herbs,29);assert.ok(d.worlds.train);assert.equal(d.dialogs.banner[0].content,'原记录');assert.deepEqual(errors,[]);
 console.log('PASS 320/390px banner, train→chat→garden→chat→train, same save/companion/materials/dialogs, zero errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
