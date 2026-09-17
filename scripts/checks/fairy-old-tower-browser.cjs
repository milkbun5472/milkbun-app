const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894',out=process.env.GARDEN_TEST_OUTPUT||'/tmp';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const ctx=await browser.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});
 const seed=await p.evaluate(async()=>{const w=await import('./world.mjs'),s=w.freshState();s.position={...w.MAPS.garden.sites.hall.target};s.minute=720;s.herbs=23;s.companion.mode='follow';s.companion.position={x:s.position.x+1,z:s.position.z+.4};return s});
 await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.seeded='1'}},seed);await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});
 assert.ok(!await p.evaluate(()=>gardenDebug.getDistricts().loaded.includes('old-tower')),'tower is not loaded from the hall');
 if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();
 await p.locator('#map-open').click();await p.locator('[data-label="林尽头的旧塔"]').click();
 await p.waitForFunction(()=>gardenDebug.getPlayer().z<-26,null,{timeout:120000});await p.screenshot({path:out+'/woodland-game-route.png'});
 await p.waitForFunction(()=>{const a=gardenDebug.getPlayer();return Math.hypot(a.x,a.z+42.65)<.23&&!a.moving},null,{timeout:120000});
 await p.waitForFunction(()=>{const a=gardenDebug.getPlayer(),b=gardenDebug.getCompanion().position;return Math.hypot(a.x-b.x,a.z-b.z)<2.8},null,{timeout:60000});
 await p.waitForFunction(()=>gardenDebug.getDistricts().loaded.includes('old-tower'));console.log('ARRIVED',await p.evaluate(()=>({player:gardenDebug.getPlayer(),companion:gardenDebug.getCompanion(),districts:gardenDebug.getDistricts()})));
 for(let n=0;n<4;n++)await p.locator('#zoom-out').click();await p.screenshot({path:out+'/old-tower-game.png'});
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});const saved=await p.evaluate(()=>gardenDebug.getState());assert.equal(saved.herbs,23);assert.ok(Math.hypot(saved.position.x,saved.position.z+42.65)<.23);
 await p.setViewportSize({width:390,height:844});if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const before=await p.evaluate(()=>gardenDebug.getView().pan);await p.mouse.move(190,360);await p.mouse.down();await p.mouse.move(125,435,{steps:12});await p.mouse.up();const after=await p.evaluate(()=>gardenDebug.getView().pan);assert.ok(Math.hypot(before.x-after.x,before.z-after.z)>.3);await p.screenshot({path:out+'/old-tower-phone.png'});
 await p.locator('#map-open').click();await p.locator('[data-label="家"] text').click();await p.waitForFunction(()=>{const a=gardenDebug.getPlayer();return Math.hypot(a.x+13.4,a.z-8.55)<.25&&!a.moving},null,{timeout:180000});
 await p.waitForFunction(()=>!gardenDebug.getDistricts().loaded.includes('old-tower'));console.log('RETURNED',await p.evaluate(()=>gardenDebug.getDistricts()));
 // Winter/night uses the same save writer and outdoor renderer, in this isolated profile only.
 const winter=await p.evaluate(()=>{const s=gardenDebug.getState();s.position={x:0,z:-42.65};s.companion.position={x:1,z:-42};s.day=43;s.minute=1260;return s});
 await p.addInitScript(s=>{if(!sessionStorage.winter){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.winter='1'}},winter);await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>gardenDebug.getState().day),43);assert.equal(await p.evaluate(()=>gardenDebug.getEnvironment().outside),true);
 await p.setViewportSize({width:1100,height:900});await p.screenshot({path:out+'/old-tower-winter.png'});assert.deepEqual(errors,[]);console.log('PASS actual map route, companion, all stream boundaries, reload, mobile pan, return unload, winter/night',await p.evaluate(()=>gardenDebug.getRenderStats()));
 await ctx.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
