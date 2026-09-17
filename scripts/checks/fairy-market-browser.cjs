const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894',out=process.env.GARDEN_TEST_OUTPUT||'/tmp';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const ctx=await browser.newContext({viewport:{width:1100,height:850}}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await ctx.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());
 const s=await p.evaluate(async()=>{const w=await import('./world.mjs'),s=w.freshState();s.minute=720;s.position={...w.MAPS.garden.sites.market.target};s.companion.mode='follow';s.companion.position={x:s.position.x+1,z:s.position.z+.3};s.herbs=17;return s});
 await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.seeded='1'}},s);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady()&&gardenDebug.getDistricts()?.loaded.includes('market'));
 if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();
 async function walk(goal){const pos=await p.evaluate(g=>gardenDebug.project(g.x,g.z),goal);assert.ok(pos.x>0&&pos.x<1100&&pos.y>60&&pos.y<760,JSON.stringify(pos));await p.mouse.click(pos.x,pos.y);await p.waitForFunction(g=>Math.hypot(gardenDebug.getPlayer().x-g.x,gardenDebug.getPlayer().z-g.z)<.22&&!gardenDebug.getPlayer().acting,goal,{timeout:30000});}
 for(let n=0;n<3;n++)await p.locator('#zoom-out').click();
 const sites=await p.evaluate(async()=>{const w=await import('./world.mjs');return w.MAPS.garden.market.stalls.map(q=>w.MAPS.garden.sites[q.id].target)});
 for(const t of sites)await walk(t);
 await walk({x:-1,z:-4});await p.locator('#view-center').click();await p.waitForTimeout(500);await p.screenshot({path:out+'/market-game-day.png'});
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());assert.equal(await p.evaluate(()=>gardenDebug.getState().herbs),17);
 if(await p.locator('#panel-content').isHidden())await p.locator('#panel-toggle').click();
 await p.locator('[data-door="hall"]').click();await p.waitForFunction(()=>gardenDebug.getState().map==='hall'&&gardenDebug.getReady());await p.waitForFunction(()=>gardenDebug.getCompanion().map==='hall');assert.equal(await p.evaluate(()=>gardenDebug.getDistricts()),null);
 await p.locator('#travel').click();await p.waitForFunction(()=>gardenDebug.getState().map==='garden'&&gardenDebug.getReady());await p.waitForFunction(()=>gardenDebug.getCompanion().map==='garden');
 // Same writer-produced state, seeded at dusk; never touch a real user profile.
 const dusk=await p.evaluate(()=>{const s=gardenDebug.getState();s.minute=1230;s.position={x:-1,z:-4};return s});
 await p.addInitScript(s=>{if(!sessionStorage.marketDusk){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.marketDusk='1'}},dusk);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady()&&gardenDebug.getDistricts()?.loaded.includes('market'));if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();await p.locator('#view-center').click();await p.waitForTimeout(500);assert.ok(await p.evaluate(()=>gardenDebug.getState().minute>=1230));await p.screenshot({path:out+'/market-game-night.png'});
 await p.setViewportSize({width:390,height:844});const before=await p.evaluate(()=>gardenDebug.getView().pan);await p.mouse.move(190,340);await p.mouse.down();await p.mouse.move(110,460,{steps:12});await p.mouse.up();const after=await p.evaluate(()=>gardenDebug.getView().pan);assert.ok(Math.hypot(before.x-after.x,before.z-after.z)>.3);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/market-phone.png'});
 assert.deepEqual(errors,[]);console.log('PASS market fronts, saved inventory, companion hall round trip, district disposal, dusk, mobile pan',await p.evaluate(()=>gardenDebug.getRenderStats()));await ctx.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
