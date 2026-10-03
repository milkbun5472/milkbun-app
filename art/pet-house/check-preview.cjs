const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PET_HOUSE_URL||'http://127.0.0.1:18952';
const out=process.env.PET_HOUSE_EVIDENCE||'/tmp/pet-house-browser';fs.mkdirSync(out,{recursive:true});

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const result={viewports:[],zones:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});
  page.on('pageerror',e=>result.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
  await page.goto(base+'/art/pet-house/preview.html');
  await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready,{timeout:60000});
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#loading').isHidden(),true);
  const geometry=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview;
   return {room:p.snapshot().roomMeshes,catHeight:new T.Box3().setFromObject(p.cat).getSize(new T.Vector3()).y,
    primitives:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles,
    rooms:p.room.children.map(o=>o.userData.zone).filter(Boolean),
    animations:p.cat.animations.length,skinned:(()=>{let n=0;p.cat.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;})()};
  });
  assert.ok(geometry.room<100,'Static furniture must be batched for the mobile preview');
  assert.ok(Math.abs(geometry.catHeight-.88)<.001);
  assert.equal(geometry.skinned,0);assert.equal(geometry.animations,0);
  for(const zone of ['window','bed','sofa','tree','feeding','toys','rug'])assert.ok(geometry.rooms.includes(zone));
  result.geometry=geometry;
  await page.screenshot({path:path.join(out,'desktop-day.png')});
  for(const [width,height] of [[320,568],[390,780],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.getByRole('button',{name:'切换到傍晚'}).isVisible());
   await page.screenshot({path:path.join(out,`mobile-${width}.png`)});
   result.viewports.push({width,height,ok:true});
  }
  await page.setViewportSize({width:390,height:780});await page.waitForTimeout(150);
  await page.getByRole('button',{name:'切换到傍晚'}).click();
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).evening,true);
  await page.screenshot({path:path.join(out,'mobile-evening.png')});
  await page.getByRole('button',{name:'切换到白天'}).click();
  const point=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview,a=p.layout.zones.feeding.target;
   const v=new T.Vector3(a[0],a[2],-a[1]).project(p.camera);
   return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};
  });
  await page.mouse.click(point.x,point.y);
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).zone,'feeding');
  assert.equal(await page.locator('#zone-title').textContent(),'饭盆角');
  for(const key of ['window','bed','sofa','tree','feeding','toys','rug']){
   await page.evaluate(key=>petHousePreview.select(key),key);
   assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).zone,key);result.zones.push(key);
  }
  await page.mouse.move(190,380);await page.mouse.wheel(0,-250);await page.waitForTimeout(150);
  assert.ok((await page.evaluate(()=>petHousePreview.snapshot())).zoom>1);
  await page.mouse.move(190,360);await page.mouse.down();await page.mouse.move(260,395,{steps:8});await page.mouse.up();
  assert.ok((await page.evaluate(()=>petHousePreview.camera.position.toArray())).every(Number.isFinite));
  await page.getByRole('button',{name:'回到小屋全景'}).click();
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).zoom,1);
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).zone,'');
  await page.reload();await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready);
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).evening,false);
  assert.deepEqual(result.errors,[]);
  result.ok=true;fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
