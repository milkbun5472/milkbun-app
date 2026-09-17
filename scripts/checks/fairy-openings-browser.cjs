const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894',out=process.env.GARDEN_TEST_OUTPUT||'/tmp';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const ctx=await browser.newContext({viewport:{width:1100,height:900}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 async function ready(){await p.waitForFunction(()=>window.gardenDebug?.getReady());await p.locator('#loading').waitFor({state:'detached'});}
 let generation=0;async function seed(s){const token='seed-'+(++generation);await p.addInitScript(({s,token})=>{if(!sessionStorage[token]){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage[token]='1'}},{s,token});await p.reload();await ready();await p.locator('#zoom-reset').click();await p.locator('#view-center').click();}
 await p.goto(base+'/apps/fairy-garden/');await ready();
 const cfg=await p.evaluate(async()=>{const w=await import('./world.mjs');return {cases:{fallenTree:{map:'garden',q:w.MAPS.garden.oldTower.fallenTree,chunk:'fallen-tree'},reedBridge:{map:'garden',q:w.MAPS.garden.lake.reedBridge,chunk:'reed-bridge'},towerVines:{map:'oldTower',q:w.MAPS.oldTower.plan.vines}},places:w.SPELL_PLACES};});
 const fresh=await p.evaluate(async()=>{const w=await import('./world.mjs');let s=w.freshState();s.herbs=23;s.spells=['relic','sense','dream'];for(const key of s.spells)s=w.takeShard(w.fillVein(s,[{kind:w.SPELLS[key].need,text:'浏览器验证用的碎片'}]),1);s.companion.mode='follow';return s;});
 async function folded(){if(await p.locator('#panel-content').isVisible())await p.locator('#panel-toggle').click();}
 async function visibility(key,side){await p.waitForFunction(({key,side})=>{const a=gardenDebug.getOpenings().filter(x=>x.key===key);return a.length===2&&a.every(x=>x.visible===(x.side===side));},{key,side});}
 async function walk(goal){const point=await p.evaluate(g=>gardenDebug.project(g.x,g.z),goal);await p.mouse.click(point.x,point.y);await p.waitForFunction(g=>Math.hypot(gardenDebug.getPlayer().x-g.x,gardenDebug.getPlayer().z-g.z)<.23&&!gardenDebug.getPlayer().moving,goal,{timeout:30000});}
 for(const [key,{map,q}] of Object.entries(cfg.cases)){
  await seed({...fresh,map,position:q.approach,companion:{...fresh.companion,map,position:{x:q.approach.x,z:q.approach.z+.6}}});await visibility(key,'shut');await folded();await p.locator('#zoom-out').click();
  const point=await p.evaluate(q=>gardenDebug.project(q.beyond.x,q.beyond.z),q),before=await p.evaluate(()=>gardenDebug.getPlayer());await p.mouse.click(point.x,point.y);await p.waitForTimeout(350);const after=await p.evaluate(()=>gardenDebug.getPlayer());assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.1,'closed '+key);await p.screenshot({path:out+'/'+key+'-game-shut.png'});
 }
 // Cast through the real wishing-tree UI. All three destination chunks are absent here.
 const forest=await p.evaluate(async()=>{const w=await import('./world.mjs');return w.MAPS.forest.stations.cast;});await seed({...fresh,map:'forest',position:forest,companion:{...fresh.companion,map:'forest',position:{x:forest.x+.7,z:forest.z+.3}}});
 for(const [key,spell] of [['fallenTree','relic'],['reedBridge','sense'],['towerVines','dream']]){
  if(await p.locator('#panel-content').isHidden())await p.locator('#panel-toggle').click();await p.locator('#cast').click();await p.locator('#cast-dialog').waitFor({state:'visible'});await p.locator(`[data-spell="${spell}"]`).click();await p.locator('#cast-shards button').first().click();await p.locator('#cast-places button').filter({hasText:cfg.places[key]}).click();await p.locator('#cast-dialog').waitFor({state:'hidden'});
 }
 const opened=await p.evaluate(()=>gardenDebug.getState());assert.equal(opened.casts.length,3);assert.equal(opened.shards.length,0);
 for(const [key,{map,q,chunk}] of Object.entries(cfg.cases)){
  await seed({...opened,map,position:q.approach,companion:{...opened.companion,map,position:{x:q.approach.x,z:q.approach.z+.6}}});await visibility(key,'open');await folded();await p.locator('#zoom-out').click();
  await walk(q.beyond);await p.waitForFunction(()=>{const a=gardenDebug.getPlayer(),b=gardenDebug.getCompanion().position;return Math.hypot(a.x-b.x,a.z-b.z)<1.6},null,{timeout:15000}).catch(async e=>{console.log('FOLLOW_FAIL',key,await p.evaluate(()=>({player:gardenDebug.getPlayer(),companion:gardenDebug.getCompanion(),state:gardenDebug.getState()})));await p.screenshot({path:out+'/'+key+'-follow-fail.png'});throw e;});
  if(key==='reedBridge')assert.ok(Math.abs(await p.evaluate(()=>gardenDebug.getPlayer().y)-.68)<.02);
  await p.screenshot({path:out+'/'+key+'-game-open.png'});await p.reload();await ready();await visibility(key,'open');assert.equal(await p.evaluate(()=>gardenDebug.getState().herbs),23);
  if(chunk){
   await folded();await p.locator('#zoom-reset').click();for(let i=0;i<12 && await p.evaluate(c=>gardenDebug.getDistricts().loaded.includes(c),chunk);i++){await p.mouse.move(900,650);await p.mouse.down();await p.mouse.move(150,250,{steps:8});await p.mouse.up();await p.waitForTimeout(150);}
   await p.waitForFunction(chunk=>!gardenDebug.getDistricts().loaded.includes(chunk),chunk);await p.locator('#view-center').click();await visibility(key,'open');
  }
  await p.setViewportSize({width:390,height:844});await folded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:out+'/'+key+'-phone.png'});await p.setViewportSize({width:1100,height:900});
  console.log('PASS',key,'real GLTF names, shut blocking, UI cast, opened walk/follow, reload and late chunk load',await p.evaluate(()=>gardenDebug.getOpenings()));
 }
 assert.deepEqual(errors,[]);await ctx.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
