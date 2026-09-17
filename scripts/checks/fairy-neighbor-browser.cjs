const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894',out=process.env.GARDEN_TEST_OUTPUT||'/tmp';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
const p=await browser.newPage({viewport:{width:1100,height:850}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());
const s=await p.evaluate(async()=>{const w=await import('./world.mjs'),s=w.freshState();s.position={...w.MAPS.garden.exits.neighbor1.target};s.companion.mode='follow';s.companion.position={x:s.position.x+1,z:s.position.z+.3};return s});
await p.addInitScript(s=>{if(!sessionStorage.seeded){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.seeded='1'}},s);await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());
await p.locator('[data-door="neighbor1"]').click();await p.waitForFunction(()=>gardenDebug.getState().map==='neighbor1'&&gardenDebug.getReady());await p.waitForFunction(()=>gardenDebug.getCompanion().map==='neighbor1');
if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();
for(let n=0;n<5;n++)await p.locator('#zoom-out').click();
const goal={x:0,z:0},pos=await p.evaluate(g=>gardenDebug.project(g.x,g.z),goal);await p.mouse.click(pos.x,pos.y);
await p.waitForFunction(g=>Math.hypot(gardenDebug.getPlayer().x-g.x,gardenDebug.getPlayer().z-g.z)<.2,goal,{timeout:25000});
await p.waitForTimeout(500);await p.screenshot({path:out+'/neighbor-desktop.png'});
assert.deepEqual(await p.evaluate(()=>gardenDebug.getRenderStats().maps),['neighbor1']);assert.equal(await p.evaluate(()=>gardenDebug.getEnvironment().rain),false);
await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());assert.equal(await p.evaluate(()=>gardenDebug.getState().map),'neighbor1');
if(await p.locator('#panel-content').isHidden())await p.locator('#panel-toggle').click();await p.locator('#travel').click();await p.waitForFunction(()=>gardenDebug.getState().map==='garden'&&gardenDebug.getReady());await p.waitForFunction(()=>gardenDebug.getCompanion().map==='garden');
await p.locator('[data-door="neighbor1"]').click();await p.waitForFunction(()=>gardenDebug.getState().map==='neighbor1'&&gardenDebug.getReady());await p.setViewportSize({width:390,height:844});if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();await p.screenshot({path:out+'/neighbor-phone.png'});
assert.deepEqual(errors,[]);console.log('PASS actual neighbour door, follow in/out, map unloading, save reload, indoor weather, desktop/mobile screenshots',await p.evaluate(()=>gardenDebug.getRenderStats()));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
