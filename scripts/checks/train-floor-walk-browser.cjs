const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {freshState}=await import('./apps/fairy-garden/world.mjs');const s=freshState();saveJSON('x_fairyGarden:walk-test',{version:1,id:'walk-save',partnerId:'first',world:s,worlds:{garden:s},journey:{},dialogs:{}});saveJSON('x_fairyGardenSaves',[{id:'walk-test',world:'garden',name:'走动档'}]);
 const el=document.createElement('div');el.id='walk-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{characters:[{id:'first',name:'同行者甲'}],initialWorld:'train',toast:()=>{},onBack:()=>{}}));});
await p.locator('#walk-root').getByRole('button',{name:/走动档/}).click();await p.waitForFunction(()=>document.querySelector('#walk-root iframe')?.contentWindow.TrainGame?.ready);
const f=p.frames().find(f=>f.url().includes('/apps/train/'));
const box=await f.locator('#stage canvas').boundingBox();
let moved=false;for(const [fx,fy] of [[.3,.8],[.5,.85],[.4,.75],[.6,.8],[.3,.9]]){await p.mouse.click(box.x+box.width*fx,box.y+box.height*fy);if(await f.evaluate(()=>TrainGame.passengers.people.find(x=>x.who==='me').spot==='free')){moved=true;break;}}
assert.ok(moved,'tapping the floor sends me walking');
await f.evaluate(()=>{for(let i=0;i<80;i++)TrainGame.passengers.tick(performance.now()+i*100,.1,true);});
assert.equal(await f.evaluate(()=>TrainGame.passengers.people.find(x=>x.who==='me').path.length),0,'arrived');
assert.ok((await f.evaluate(()=>TrainGame.chatContext().rest.you||''))!==undefined);
// 拖动不算点
const before=await f.evaluate(()=>TrainGame.passengers.people.find(x=>x.who==='me').pos.x);await p.mouse.move(box.x+box.width*.5,box.y+box.height*.8);await p.mouse.down();await p.mouse.move(box.x+box.width*.2,box.y+box.height*.8,{steps:5});await p.mouse.up();
assert.equal(await f.evaluate(()=>TrainGame.passengers.people.find(x=>x.who==='me').path.length),0,'drag does not walk');
assert.deepEqual(errors,[]);console.log('PASS tap floor walks me there, arrives, drag ignored');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
