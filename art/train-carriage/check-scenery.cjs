const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRAIN_URL||'http://127.0.0.1:18924';
const out=process.env.TRAIN_SCENERY_SHOTS||'/Users/lisa/.codex/visualizations/2026/09/24/train-scenery';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[],failed=[];
 function monitor(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});}
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});monitor(page);
  await page.goto(base+'/art/train-carriage/preview.html');await page.waitForFunction(()=>window.carriageReview?.scenery);
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>carriageReview.scenery.state.playing),false);
  const paused=await page.evaluate(()=>carriageReview.scenery.frames);await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>carriageReview.scenery.frames),paused);
  const result=await page.evaluate(()=>{
   const r=carriageReview,s=r.scenery;const samples=[];
   const signature=()=>{const d=s.canvas.getContext('2d').getImageData(0,0,s.canvas.width,s.canvas.height).data;let hash=2166136261,brightness=0;for(let i=0;i<d.length;i+=100){hash=Math.imul(hash^d[i],16777619);brightness+=d[i]+d[i+1]+d[i+2];}return {hash:hash>>>0,brightness};};
   const initialChildren=r.scene.children.length;
   for(const season of ['spring','summer','autumn','winter'])for(const route of ['forest','coast','country'])for(const weather of ['clear','cloudy','rain','snow','fog'])for(const hour of [6,12,18.5,22]){
    r.setEnvironment({route,season,weather,hour,playing:false});samples.push({route,season,weather,hour,...signature()});
   }
   const corners=s.canvas.getContext('2d').getImageData(0,0,1,1).data[3];
   r.setEnvironment({route:'forest',weather:'clear',hour:12,playing:true,autoTime:false});
   const before=signature(),offsets=s.layers.map(l=>l.offset);s.step(.1);const after=signature(),travel=s.layers.map((l,i)=>({name:l.name,speed:l.speed,delta:(l.offset-offsets[i]+1600)%1600}));
   r.setEnvironment({hour:23.999,autoTime:true});s.step(.1);const wrappedHour=s.state.hour;
   r.setEnvironment({playing:false,autoTime:false,hour:9});
   return {samples,transparentCorner:corners,motionChanged:before.hash!==after.hash,travel,wrappedHour,initialChildren,finalChildren:r.scene.children.length,textures:r.renderer.info.memory.textures,triangles:r.renderer.info.render.triangles,layerCount:s.layers.length,output:[s.canvas.width,s.canvas.height]};
  });
  assert.equal(result.samples.length,240);assert.ok(new Set(result.samples.map(s=>s.hash)).size>=236);
  assert.equal(result.transparentCorner,0);assert.ok(result.motionChanged);assert.equal(result.layerCount,5);
  for(const layer of result.travel)assert.ok(Math.abs(layer.delta-layer.speed*.1)<1e-6);
  assert.ok(result.wrappedHour>=0&&result.wrappedHour<.02);assert.equal(result.initialChildren,result.finalChildren);
  const day=result.samples.find(s=>s.route==='forest'&&s.weather==='rain'&&s.hour===12),night=result.samples.find(s=>s.route==='forest'&&s.weather==='rain'&&s.hour===22);assert.ok(night.brightness<day.brightness*.7);
  await page.locator('[data-view=window]').click();
  for(const season of ['spring','summer','autumn','winter']){await page.evaluate(season=>carriageReview.setEnvironment({season,route:'country',weather:'clear',hour:12,playing:false}),season);await page.screenshot({path:path.join(out,'season-'+season+'.png')});}
  await page.selectOption('#season','spring');
  for(const [name,route,weather,hour] of [['forest-morning','forest','clear',8],['coast-sunset','coast','clear',18.5],['country-night','country','clear',22],['rain-window','forest','rain',17],['snow-window','forest','snow',10],['fog-window','coast','fog',7]]){
   await page.selectOption('#route',route);await page.selectOption('#weather',weather);await page.locator('#hour').evaluate((el,h)=>{el.value=h;el.dispatchEvent(new Event('input',{bubbles:true}));},hour);
   await page.screenshot({path:path.join(out,name+'.png')});
  }
  await page.selectOption('#route','forest');await page.selectOption('#weather','clear');await page.evaluate(()=>carriageReview.setEnvironment({hour:9}));await page.locator('[data-view=overview]').click();await page.screenshot({path:path.join(out,'overview.png')});
  await page.locator('#play').click();const f1=await page.evaluate(()=>carriageReview.scenery.frames);await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>carriageReview.scenery.frames)>f1);await page.locator('#play').click();
  // Native controls remain reachable on a small portrait device, including the sole scroll container.
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});monitor(mobile);
  await mobile.goto(base+'/art/train-carriage/preview.html');await mobile.waitForFunction(()=>window.carriageReview?.scenery);
  assert.equal(await mobile.evaluate(()=>carriageReview.scenery.state.playing),false);
  assert.deepEqual(await mobile.evaluate(()=>[carriageReview.scenery.canvas.width,carriageReview.scenery.canvas.height]),[960,480]);
  await mobile.locator('[data-view=window]').click();await mobile.selectOption('#route','coast');await mobile.selectOption('#weather','snow');await mobile.selectOption('#season','winter');assert.equal(await mobile.evaluate(()=>carriageReview.scenery.state.season),'winter');
  const layout=await mobile.evaluate(()=>{const stage=document.querySelector('#stage').getBoundingClientRect(),aside=document.querySelector('aside').getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect();return {noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,stageHeight:stage.height,controlsBottom:aside.bottom,footerTop:footer.top,viewport:innerHeight};});
  assert.ok(layout.noHorizontalOverflow);assert.ok(layout.stageHeight>300);assert.ok(layout.controlsBottom<=layout.footerTop+.5);
  await mobile.screenshot({path:path.join(out,'mobile-snow.png')});
  await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(150);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const sourceHashes=Object.fromEntries(['destinations.mjs','journey.mjs','scenery.mjs','preview.mjs','preview.html'].map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex')]));
  fs.writeFileSync(path.join(__dirname,'scenery-validation.json'),JSON.stringify({sourceHashes,combinations:240,uniqueFrames:new Set(result.samples.map(s=>s.hash)).size,motionChanged:result.motionChanged,travel:result.travel,wrappedHour:result.wrappedHour,stableSceneObjects:result.initialChildren===result.finalChildren,textureCount:result.textures,layerCount:result.layerCount,transparentCorner:result.transparentCorner,nightRainDarkerThanDay:true,pauseResume:true,reducedMotionStartsPaused:true,mobileCanvas:[960,480],layout,errors,failed},null,2)+'\n');
  console.log(JSON.stringify({combinations:240,uniqueFrames:new Set(result.samples.map(s=>s.hash)).size,layout,errors,failed}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
