const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PET_CAREER_URL||'http://127.0.0.1:18954';
const out=process.env.PET_CAREER_EVIDENCE||'/tmp/pet-career-evidence/browser';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const result={scenes:[],errors:[]};
 try{
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
 const places=JSON.parse(fs.readFileSync(path.join(__dirname,'scenes.json'),'utf8'));
 for(const [index,{id}] of places.entries()){
  await page.setViewportSize({width:1100,height:1000});await page.goto(base+'/art/pet-career/preview.html?scene='+id);await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready,{timeout:60000});await page.waitForTimeout(250);
  const geometry=await page.evaluate(async()=>{const T=await import('three'),p=petCareerPreview;return {meshes:p.snapshot().roomMeshes,height:new T.Box3().setFromObject(p.cat).getSize(new T.Vector3()).y,zones:p.room.children.map(o=>o.userData.zone).filter(Boolean),expected:Object.keys(p.layout.zones),title:p.layout.title,calls:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles};});
  assert.ok(geometry.meshes<100);assert.ok(Math.abs(geometry.height-.88)<.001);for(const key of geometry.expected)assert.ok(geometry.zones.includes(key));
  const grounded=await page.evaluate(async()=>{const T=await import('three'),p=petCareerPreview,[x,y,z]=p.layout.cat.position,ray=new T.Raycaster(new T.Vector3(x,z+3,-y),new T.Vector3(0,-1,0));return ray.intersectObject(p.room,true)[0]?.point.y;});assert.ok(Math.abs(grounded-(await page.evaluate(()=>petCareerPreview.layout.cat.position[2])))<.04,'Pet must sit on an authored surface');
  assert.equal(await page.locator('[aria-current=page]').getAttribute('data-scene'),id);await page.screenshot({path:path.join(out,id+'-desktop.png')});
  for(const [width,height] of [[320,568],[390,780],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(150);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const link of await page.locator('.places a').all()){const b=await link.boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=width&&b.height>=40);await link.scrollIntoViewIfNeeded();assert.equal(await link.evaluate(el=>{const b=el.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return el.contains(hit);}),true,'Scene link must be unobstructed');}
   await page.screenshot({path:path.join(out,id+'-'+width+'.png')});
  }
  for(const key of geometry.expected){await page.evaluate(key=>petCareerPreview.select(key),key);assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).zone,key);}
  // Real ray hit on an authored zone: scan its projected mesh centres until a visible part is hit.
  const candidates=await page.evaluate(async()=>{const T=await import('three'),p=petCareerPreview,a=[];p.room.traverse(o=>{if(!o.isMesh)return;let r=o;while(r&&!r.userData.zone)r=r.parent;if(!r||!p.layout.zones[r.userData.zone])return;const v=new T.Box3().setFromObject(o).getCenter(new T.Vector3()).project(p.camera);a.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});});return a;});
  let hit=false;for(const point of candidates){if(point.y<195||point.y>700)continue;await page.evaluate(()=>petCareerPreview.reset());await page.mouse.click(point.x,point.y);if((await page.evaluate(()=>petCareerPreview.snapshot())).zone){hit=true;break;}}assert.ok(hit,'Furniture tap should hit a real semantic zone');
  await page.getByRole('button',{name:'切换到傍晚'}).click();assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).evening,true);await page.screenshot({path:path.join(out,id+'-evening.png')});
  await page.mouse.move(190,380);await page.mouse.wheel(0,-250);await page.waitForTimeout(150);assert.ok((await page.evaluate(()=>petCareerPreview.snapshot())).zoom>1);
  await page.mouse.move(190,360);await page.mouse.down();await page.mouse.move(260,395,{steps:8});await page.mouse.up();assert.ok((await page.evaluate(()=>petCareerPreview.camera.position.toArray())).every(Number.isFinite));
  await page.locator('#reset').click();assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).zoom,1);
  await page.reload();await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready);assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).evening,false);
  const next=places[(index+1)%places.length].id;await page.locator('[data-scene='+next+']').click();await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready);assert.equal(new URL(page.url()).searchParams.get('scene'),next);
  result.scenes.push({id,geometry,viewports:[320,390,430],tap:true,lighting:true,drag:true,zoom:true,reset:true,reload:true,navigation:true});
 }
 await page.goto(base+'/art/pet-career/preview.html?scene=unknown');await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready);assert.equal(await page.locator('h1').textContent(),places[0].title);assert.equal(await page.locator('.places a').count(),places.length+1);result.unknownFallsBack=true;
 assert.deepEqual(result.errors,[]);result.ok=true;fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
