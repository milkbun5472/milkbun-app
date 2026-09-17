// Isolated local fixtures only. No phone/cloud storage or API requests.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());
 const fixture=await p.evaluate(async()=>{const w=await import('./world.mjs');let s=w.freshState();s=w.advanceTime(s,900);return w.perform({...s,position:w.targetFor(s,'dive')},'dive');});
 await p.addInitScript(s=>{if(!sessionStorage.getItem('well-test-seeded')){localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s));sessionStorage.setItem('well-test-seeded','1');}},fixture);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());
 assert.equal(await p.evaluate(()=>gardenDebug.getState().map),'depths');
 const environment=await p.evaluate(()=>gardenDebug.getEnvironment());assert.equal(environment.rain,false);assert.equal(environment.seasonTint,false);
 await p.locator('#panel-toggle').click();await p.waitForTimeout(1000);await p.screenshot({path:'/tmp/well-mobile.png'});
 // Exercise actual rendered picking for every layer, hidden/harvested nodes and resource disposal.
 const visual=await p.evaluate(async()=>{const T=await import('three'),{makeDepths}=await import('./depths.mjs'),{NODES}=await import('./world.mjs'),{disposeMap}=await import('./map-loader.mjs');const v=makeDepths();let checked=0;
  for(let depth=1;depth<=12;depth++){v.update({depth,picked:[]},0);v.root.updateMatrixWorld(true);const ns=NODES.filter(n=>n.map==='depths'&&n.depth===depth);for(const n of ns){const ray=new T.Raycaster(new T.Vector3(n.x,4,n.z),new T.Vector3(0,-1,0));if(v.pick(ray)!==n.id)throw Error('Wrong visible node '+n.id);checked++;}v.update({depth,picked:ns.map(n=>n.id)},1);for(const n of ns){const node=v.root.children.find(o=>o.userData.nodeId===n.id);if(node.children[0].visible)throw Error('Harvested crystal visible');}}
  const resources=new Set();v.root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){resources.add(m);for(const x of Object.values(m))if(x?.isTexture)resources.add(x);}});let disposed=0;for(const r of resources)r.addEventListener('dispose',()=>disposed++);disposeMap(v.root);return {checked,resources:resources.size,disposed};});
 console.log('All 36 layer nodes pick correctly; hidden veins and disposal verified');assert.equal(visual.checked,36);assert.equal(visual.resources,visual.disposed);
 // Actual screen tap -> walk -> gather, then next layer and return outside.
 const node=await p.evaluate(async()=>{const {NODES}=await import('./world.mjs');return NODES.find(n=>n.map==='depths'&&n.depth===gardenDebug.getState().depth);});
 const point=await p.evaluate(n=>gardenDebug.project(n.x,n.z),node);await p.mouse.click(point.x,point.y);
 await p.waitForFunction(id=>gardenDebug.getState().picked.includes(id),node.id,{timeout:30000});
 await p.locator('#panel-toggle').click();await p.locator('#garden').click();await p.waitForFunction(()=>gardenDebug.getState().depth===2&&!gardenDebug.getPlayer().acting,null,{timeout:30000});
 console.log('Screen tap mined and descended successfully');const collected=await p.evaluate(()=>gardenDebug.getState().sand);assert.ok(collected>0);
 await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());assert.equal(await p.evaluate(()=>gardenDebug.getState().depth),2);assert.equal(await p.evaluate(()=>gardenDebug.getState().sand),collected);
 if(await p.locator('#panel-content').isHidden())await p.locator('#panel-toggle').click();
 const memory=[];
 for(let i=0;i<5;i++){
  await p.locator('#travel').click();await p.waitForFunction(()=>gardenDebug.getState().map==='garden'&&!gardenDebug.getPlayer().acting,null,{timeout:30000});
  const outdoor=await p.evaluate(()=>gardenDebug.getEnvironment());assert.equal(outdoor.fill,1);assert.equal(outdoor.seasonTint,true);
  await p.locator('#dive').click();await p.waitForFunction(()=>gardenDebug.getState().map==='depths'&&!gardenDebug.getPlayer().acting,null,{timeout:30000});
  await p.waitForTimeout(200);memory.push(await p.evaluate(()=>gardenDebug.getRenderStats()));
 }
 console.log('Five map round trips completed (first two warm shared outdoor geometry)',JSON.stringify(memory));assert.equal(memory[2].geometries,memory[4].geometries);assert.equal(memory[2].textures,memory[4].textures);assert.ok(memory[4].calls<140);
 await p.locator('#quality').click();await p.locator('#panel-toggle').click();await p.screenshot({path:'/tmp/well-mobile-lite.png'});
 const night=await p.evaluate(async()=>{const {advanceTime}=await import('./world.mjs');const s=gardenDebug.getState();return advanceTime(s,1260-s.minute);});await p.addInitScript(s=>localStorage.setItem('fairy-garden-prototype-v1',JSON.stringify(s)),night);await p.reload();await p.waitForFunction(()=>window.gardenDebug?.getReady());assert.deepEqual(await p.evaluate(()=>gardenDebug.getEnvironment()),environment);await p.locator('#zoom-in').click();await p.locator('#zoom-in').click();await p.waitForTimeout(700);await p.screenshot({path:'/tmp/well-mobile-night.png'});assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,visual,memory,environment},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
