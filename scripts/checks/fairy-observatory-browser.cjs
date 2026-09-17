const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894',out=process.env.GARDEN_TEST_OUTPUT||'/tmp';
const targets=process.argv.slice(2);if(!targets.length)targets.push('oldTower');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 for(const map of targets){
 const ctx=await browser.newContext({viewport:{width:1100,height:850}}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});
 const s=await p.evaluate(async map=>{const w=await import('./world.mjs'),s=w.freshState();s.position={...w.MAPS.garden.exits[map].target};s.herbs=23;s.companion.mode='follow';s.companion.position={x:s.position.x+1,z:s.position.z+.3};return s},map);
 await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.seeded='1'}},s);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});
 const entered=()=>p.waitForFunction(map=>gardenDebug.getState().map===map&&gardenDebug.getReady(),map);
 const follow=()=>p.waitForFunction(map=>gardenDebug.getCompanion().map===map,map);
 await p.locator(`[data-door="${map}"]`).click();await entered().catch(async e=>{console.log('ENTRY_FAIL',await p.evaluate(()=>({state:gardenDebug.getState(),player:gardenDebug.getPlayer(),body:document.body.innerText})),errors);await p.screenshot({path:out+'/entry-fail.png'});throw e;});await follow();
 if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();
 for(let n=0;n<5;n++)await p.locator('#zoom-out').click();
 async function walk(goal){const pos=await p.evaluate(g=>gardenDebug.project(g.x,g.z),goal);await p.mouse.click(pos.x,pos.y);await p.waitForFunction(g=>Math.hypot(gardenDebug.getPlayer().x-g.x,gardenDebug.getPlayer().z-g.z)<.2&&!gardenDebug.getPlayer().acting,goal,{timeout:25000});}
 await walk({x:0,z:3});
 await walk({x:3.5,z:-2.1});await walk({x:3.5,z:-4.2});assert.ok(Math.abs(await p.evaluate(()=>gardenDebug.getPlayer().y)-.78)<.08);
 const sites=await p.evaluate(async map=>{const w=await import('./world.mjs');return Object.values(w.MAPS[map].sites).map(s=>s.target)},map);
 for(const target of sites)await walk(target);
 await walk({x:0,z:3});await p.waitForTimeout(300);await p.screenshot({path:out+'/'+map+'-desktop.png'});
 assert.deepEqual(await p.evaluate(()=>gardenDebug.getRenderStats().maps),[map]);assert.equal(await p.evaluate(()=>gardenDebug.getEnvironment().outside),false);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>gardenDebug.getState().map),map);assert.equal(await p.evaluate(()=>gardenDebug.getState().herbs),23);
 if(await p.locator('#panel-content').isHidden())await p.locator('#panel-toggle').click();await p.locator('#travel').click();
 await p.waitForFunction(()=>gardenDebug.getState().map==='garden'&&gardenDebug.getReady());await p.waitForFunction(()=>gardenDebug.getCompanion().map==='garden');
 await p.locator(`[data-door="${map}"]`).click();await entered().catch(async e=>{console.log('ENTRY_FAIL',await p.evaluate(()=>({state:gardenDebug.getState(),player:gardenDebug.getPlayer(),body:document.body.innerText})),errors);await p.screenshot({path:out+'/entry-fail.png'});throw e;});await follow();await p.setViewportSize({width:390,height:844});
 if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const before=await p.evaluate(()=>gardenDebug.getView().pan);await p.mouse.move(190,340);await p.mouse.down();await p.mouse.move(110,460,{steps:12});await p.mouse.up();
 const after=await p.evaluate(()=>gardenDebug.getView().pan);assert.ok(Math.hypot(before.x-after.x,before.z-after.z)>.3);
 await p.screenshot({path:out+'/'+map+'-phone.png'});assert.deepEqual(errors,[]);
 console.log('PASS',map,'actual door, all sites, companion in/out, unload, reload, indoor weather, mobile pan',await p.evaluate(()=>gardenDebug.getRenderStats()));await ctx.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
