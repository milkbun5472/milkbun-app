const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PET_CAREER_URL||'http://127.0.0.1:18954',out=process.env.PET_CAREER_EVIDENCE||'/tmp/pet-outside-browser';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const result={rooms:[],viewports:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:780},hasTouch:true});page.on('pageerror',e=>result.errors.push(e.message));
  await page.goto(base+'/art/pet-career/preview.html');await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready&&!petCareerPreview.snapshot().busy,{timeout:60000});
  assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).room,null);
  assert.equal(await page.evaluate(()=>petCareerPreview.layout.radius),55);
  for(const [width,height]of [[320,568],[390,780],[430,932]]){
   await page.setViewportSize({width,height});await page.locator('#reset').click();await page.waitForTimeout(150);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const button of await page.locator('.scene-head button').all()){const b=await button.boundingBox();assert.ok(b&&b.width>=40&&b.height>=40&&b.x>=0&&b.x+b.width<=width);assert.equal(await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true);}
   for(const button of await page.locator('.door-label:visible').all()){const b=await button.boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=width&&b.height>=40);assert.equal(await button.evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true);}
   await page.screenshot({path:path.join(out,'outside-'+width+'.png')});result.viewports.push({width,height,ok:true});
  }
  await page.setViewportSize({width:390,height:780});
  for(const id of ['home','bakery','florist','store','cafe','alley']){
   await page.locator('#reset').click();await page.waitForTimeout(100);
   const before=await page.evaluate(()=>petCareerPreview.snapshot());
   await page.getByRole('button',{name:'走到'+({home:'家里',bakery:'面包店',florist:'花店',store:'便利店',cafe:'咖啡店',alley:'侦探小巷'}[id]),exact:true}).click();
   const started=await page.evaluate(()=>petCareerPreview.snapshot());assert.ok(started.walking||started.busy);assert.ok(Math.hypot(started.position.x-before.position.x,started.position.z-before.position.z)<1.5,'Click must start walking rather than teleport');
   const route=await page.evaluate(()=>{let frames=0,p=petCareerPreview;while(p.snapshot().walking&&frames++<6000)p.step(.05);return {frames,state:p.snapshot()};});assert.ok(route.frames<6000);
   await page.waitForFunction(id=>petCareerPreview.snapshot().room===id&&!petCareerPreview.snapshot().busy,id,{timeout:60000});
   const inside=await page.evaluate(()=>petCareerPreview.snapshot());assert.ok(await page.evaluate(id=>petCareerPreview.world.canEnter(petCareerPreview.snapshot().outdoor.position,id),id));assert.equal(await page.locator('#door-labels').isHidden(),true);assert.equal(await page.locator('#back').textContent(),'出门');
   await page.screenshot({path:path.join(out,id+'-inside.png')});
   // Tap a real projected furniture surface, not a test-only selection hook.
   const points=await page.evaluate(async()=>{const T=await import('three'),p=petCareerPreview,a=[];p.model.traverse(o=>{if(!o.isMesh)return;let r=o;while(r&&!r.userData.zone)r=r.parent;if(!r||r.userData.zone==='shell')return;const v=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(p.camera);a.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});});return a;});let hit=false;
   for(const q of points){if(q.x<20||q.x>370||q.y<90||q.y>680)continue;await page.mouse.click(q.x,q.y);if((await page.evaluate(()=>petCareerPreview.snapshot())).zone){hit=true;break;}}assert.ok(hit,'Room furniture should be clickable');
   if(id==='cafe'){await page.getByRole('button',{name:'切换到傍晚'}).click();await page.reload();await page.waitForFunction(()=>window.petCareerPreview?.snapshot().room==='cafe'&&!petCareerPreview.snapshot().busy);assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).evening,true);await page.getByRole('button',{name:'切换到白天'}).click();result.reloadInside=true;}
   await page.getByRole('button',{name:'出门回到街区'}).click();await page.waitForFunction(()=>petCareerPreview.snapshot().room===null&&!petCareerPreview.snapshot().busy);
   const returned=await page.evaluate(()=>petCareerPreview.snapshot());assert.deepEqual(returned.position,inside.outdoor.position);assert.deepEqual(returned.pan,inside.outdoor.pan);assert.equal(returned.zoom,inside.outdoor.zoom);result.rooms.push({id,frames:route.frames,door:true,walking:true,inside:true,furniture:true,returnPosition:true,returnView:true});
  }
  // Scene failures leave the pet at the same exterior door and permit retry.
  await page.route('**/alley.glb*',r=>r.abort());assert.equal(await page.evaluate(()=>petCareerPreview.enter('alley')),false);assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).room,null);await page.unroute('**/alley.glb*');assert.equal(await page.evaluate(()=>petCareerPreview.enter('alley')),true);await page.evaluate(()=>petCareerPreview.leave());result.failedEntryRecovers=true;
  await page.locator('#reset').click();const oldPosition=(await page.evaluate(()=>petCareerPreview.snapshot())).position;
  await page.mouse.move(190,360);await page.mouse.down();await page.mouse.move(250,395,{steps:8});await page.mouse.up();assert.deepEqual((await page.evaluate(()=>petCareerPreview.snapshot())).position,oldPosition);result.dragDoesNotWalk=true;const cdp=await page.context().newCDPSession(page),touch=(a,b)=>[{x:a,y:600,id:1,radiusX:3,radiusY:3,force:1},{x:b,y:600,id:2,radiusX:3,radiusY:3,force:1}];const z=(await page.evaluate(()=>petCareerPreview.snapshot())).zoom;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(150,240)});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch(110,280)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[touch(110,280)[0]]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:125,y:610,id:1,radiusX:3,radiusY:3,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await page.evaluate(()=>petCareerPreview.snapshot())).zoom>z);assert.deepEqual((await page.evaluate(()=>petCareerPreview.snapshot())).position,oldPosition);result.pinchDoesNotWalk=true;
  
  await page.mouse.wheel(0,-150);await page.waitForTimeout(100);assert.ok((await page.evaluate(()=>petCareerPreview.snapshot())).zoom>.55);
  await page.locator('#reset').click();await page.waitForTimeout(100);const point=await page.evaluate(()=>petCareerPreview.project(0,20,.06));await page.mouse.click(point.x,point.y);await page.evaluate(()=>{const p=petCareerPreview;for(let i=0;i<6000&&p.snapshot().walking;i++)p.step(.05);});assert.ok(Math.hypot((await page.evaluate(()=>petCareerPreview.snapshot())).position.x,(await page.evaluate(()=>petCareerPreview.snapshot())).position.z-20)<.1);result.groundTap=true;
  await page.reload();await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready&&!petCareerPreview.snapshot().busy);assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).room,null);result.reloadOutside=true;
  assert.deepEqual(result.errors,[]);result.ok=true;fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
