const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRAIN_BASE||'http://127.0.0.1:18924';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp&&window.ReactDOM);
 await p.evaluate(async()=>{const w=await import('./apps/fairy-garden/world.mjs');const s=w.setGuide({...w.freshState(),day:43,minute:1110,herbs:17,position:{...w.MAPS.garden.station.target}},false);s.companion.mode='wait';window.trainFixture=s;
 saveJSON('x_fairyGarden:train-test',{version:1,id:'train-test',partnerId:'test',world:s,worlds:{garden:s},journey:{look:{hair:'bun'}},dialogs:{test:[{role:'user',content:'保留的测试记录',status:'done'}]}});
 saveJSON('x_fairyGardenSaves',[{id:'train-test',world:'garden',name:'共用测试档',ts:1}]);
 const el=document.createElement('div');el.id='train-test-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.trainTestRoot=ReactDOM.createRoot(el);trainTestRoot.render(React.createElement(FairyGardenApp,{characters:[{id:'test',name:'同行测试'}],toast:()=>{},onBack:()=>{},onNewGardenRoom:()=>{}}));});
 const root=p.locator('#train-test-root');await root.getByRole('button',{name:/远行列车/}).click();await root.getByRole('button',{name:/共用测试档/}).click();await root.getByRole('button',{name:'下车',exact:true}).waitFor();await p.waitForFunction(()=>document.querySelector('#train-test-root iframe')?.contentWindow.TrainGame?.ready);
 let f=p.frames().find(f=>f.url().includes('/apps/train/'));assert.equal(await f.locator('select:visible,input:visible').count(),0);assert.equal(await f.locator('nav [data-view]').count(),3);assert.equal(await f.locator('nav button').count(),5);
 const first=await f.evaluate(()=>TrainGame.snapshot());await p.waitForTimeout(300);assert.ok((await f.evaluate(()=>TrainGame.snapshot())).minute>first.minute);
 await p.screenshot({path:'/tmp/train-world-mobile.png'});
 // Failed writes block leaving; retry uses the same record.
 await p.evaluate(()=>{window.trainRealSave=saveJSON;window.saveJSON=(k,v)=>k==='x_fairyGarden:train-test'?false:trainRealSave(k,v);});
 await root.getByRole('button',{name:'下车',exact:true}).click();await root.getByRole('button',{name:'进入微光庭院',exact:true}).click();assert.ok(p.frames().some(f=>f.url().includes('/apps/train/')));
 await p.evaluate(()=>{window.saveJSON=trainRealSave;});await root.getByRole('button',{name:'进入微光庭院',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#train-test-root iframe')?.contentWindow.gardenDebug?.getReady());
 f=p.frames().find(f=>f.url().includes('/apps/fairy-garden/index.html'));await f.locator('#loading').waitFor({state:'detached'});
 const garden=await f.evaluate(()=>gardenDebug.getState());assert.equal(garden.herbs,17);assert.equal(garden.day,43);assert.deepEqual(garden.position,await f.evaluate(()=>FairyGardenRules.MAPS.garden.station.target));
 // Click the real station in the rendered scene, then use its real action.
 await f.locator('#panel-toggle').evaluate(el=>{if(!document.querySelector('#panel-content').hidden)el.click();});
 const at=await f.evaluate(()=>{const at=FairyGardenRules.MAPS.garden.station.target;return gardenDebug.project(at.x,at.z);});const box=await root.locator('iframe').boundingBox();await p.mouse.click(box.x+at.x,box.y+at.y);await f.getByRole('button',{name:'登上列车',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#train-test-root iframe')?.contentWindow.TrainGame?.ready);
 f=p.frames().find(f=>f.url().includes('/apps/train/'));const boarded=await f.evaluate(()=>TrainGame.snapshot());const saved=await p.evaluate(()=>loadJSON('x_fairyGarden:train-test',null));
 assert.equal(boarded.day,saved.world.day);assert.equal(boarded.epoch,saved.world.epoch);assert.ok(Math.abs(boarded.minute-saved.world.minute)<1);assert.equal(saved.id,'train-test');assert.equal(saved.partnerId,'test');assert.equal(saved.world.herbs,17);assert.equal(saved.dialogs.test[0].content,'保留的测试记录');assert.deepEqual(saved.world,saved.worlds.garden);
 await p.setViewportSize({width:844,height:390});assert.equal(await p.evaluate(()=>document.querySelector('#train-test-root').scrollWidth>innerWidth),false);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:'/tmp/train-world-landscape.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sameSave:true,gardenRoundTrip:true,failedSaveStays:true,boardingEnvironment:true,noDebugControls:true,mobile:true,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
