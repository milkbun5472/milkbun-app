const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[],failures=[];const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push([r.status(),r.url()]);});
 try{
  await page.goto((process.env.TRAIN_URL||'http://127.0.0.1:18924')+'/art/train-carriage/preview.html');
  await page.waitForFunction(()=>window.carriageReview,{timeout:30000});
  const state=await page.evaluate(()=>{const r=carriageReview,groups={},anchors=[];let vertices=0;r.asset.traverse(o=>{if(o.isMesh){groups[o.userData.carriageGroup]=(groups[o.userData.carriageGroup]||0)+1;const p=o.geometry.attributes.position;vertices+=p.count;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))throw Error('Non finite position');}if(o.userData.anchor)anchors.push(o.userData.anchor);});return {groups,anchors,vertices,triangles:r.renderer.info.render.triangles,calls:r.renderer.info.render.calls};});
  assert.equal(state.anchors.length,7);assert.ok(state.groups.Interior>0);assert.ok(state.groups.Roof>0);
  await page.screenshot({path:'/tmp/lisa-train-desktop.png'});
  for(const name of ['table','berths','top','window','overview']){await page.locator(`[data-view=${name}]`).click();assert.equal(await page.evaluate(()=>carriageReview.currentView),name);}
  await page.locator('#shell').check();assert.equal(await page.evaluate(()=>{let n=0;carriageReview.asset.traverse(o=>{if(o.userData.carriageGroup==='Roof'&&o.visible)n++;});return n;}),5);
  await page.locator('#shell').uncheck();await page.evaluate(()=>carriageReview.setEnvironment({hour:22,playing:false}));await page.screenshot({path:'/tmp/lisa-train-night.png'});await page.evaluate(()=>carriageReview.setEnvironment({hour:9}));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/lisa-train-mobile.png'});
  await page.locator('[data-view=table]').click();await page.screenshot({path:'/tmp/lisa-train-mobile-table.png'});
  const before=await page.evaluate(()=>carriageReview.camera.position.toArray());await page.mouse.move(130,200);await page.mouse.down();await page.mouse.move(210,220,{steps:8});await page.mouse.up();const after=await page.evaluate(()=>carriageReview.camera.position.toArray());assert.notDeepEqual(before,after);
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  fs.writeFileSync(__dirname+'/browser-validation.json',JSON.stringify({glb_sha256:createHash('sha256').update(fs.readFileSync(__dirname+'/carriage.glb')).digest('hex'),state,desktop:[1280,900],mobile:[390,844],views:5,shellToggle:true,nightLighting:true,drag:true,horizontalOverflow:false,errors,failures},null,2)+'\n');
  console.log(JSON.stringify({state,errors,failures}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
