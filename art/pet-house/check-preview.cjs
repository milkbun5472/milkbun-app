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
  page.on('console',e=>{if(e.type()==='error')result.errors.push(e.text());});
  page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
  await page.goto(base+'/art/pet-house/preview.html');
  await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready,{timeout:60000});
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#loading').isHidden(),true);
  assert.ok((await page.evaluate(()=>petHousePreview.snapshot())).motion.feet.every(f=>f.stance),'Initial cat stands on all four paws');
  const geometry=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview;
   return {room:p.snapshot().roomMeshes,catHeight:new T.Box3().setFromObject(p.cat).getSize(new T.Vector3()).y,
    primitives:p.renderer.info.render.calls,triangles:p.renderer.info.render.triangles,
    rooms:p.room.children.map(o=>o.userData.zone).filter(Boolean),
    animations:p.cat.animations.length,skinned:(()=>{let n=0;p.cat.traverse(o=>{if(o.isSkinnedMesh)n++;});return n;})()};
  });
  assert.ok(geometry.room<100,'Static furniture must be batched for the mobile preview');
  assert.ok(Math.abs(geometry.catHeight-.88)<.015);
  assert.equal(geometry.skinned,1);assert.equal(geometry.animations,0);
  for(const zone of ['window','bed','sofa','tree','feeding','toys','rug'])assert.ok(geometry.rooms.includes(zone));
  result.geometry=geometry;
  await page.screenshot({path:path.join(out,'desktop-day.png')});
  for(const [width,height] of [[320,568],[390,780],[430,932]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.getByRole('button',{name:'切换到傍晚'}).isVisible());
   await page.locator('#fur').click();
   assert.equal(await page.locator('#fur-panel').isVisible(),true);
   for(const control of await page.locator('#fur-panel button,#fur-panel input,#walk,#fur').all()){
    const box=await control.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);assert.ok(box.height>=40);
   }
   await page.getByRole('button',{name:'浅紫',exact:true}).click();
   assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).look.patch,'#ada0c0');
   await page.screenshot({path:path.join(out,`mobile-fur-${width}.png`)});
   await page.locator('#fur').click();
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
  result.dyeProtection=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview,look=p.dye.snapshot();let mesh;p.cat.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
   const at=p.petRoot.position.clone().add(new T.Vector3(0,.45,0));
   p.camera.left=-.65;p.camera.right=.65;p.camera.top=.65;p.camera.bottom=-.65;
   p.camera.position.copy(at).add(new T.Vector3(.05,.25,1.8).applyAxisAngle(new T.Vector3(0,1,0),p.petRoot.rotation.y));p.camera.lookAt(at);p.camera.updateProjectionMatrix();
   p.camera.updateMatrixWorld(true);p.scene.updateMatrixWorld(true);
   const canvas=document.createElement('canvas');canvas.width=p.renderer.domElement.width;canvas.height=p.renderer.domElement.height;const ctx=canvas.getContext('2d');
   const probes=[[-.115,.51,.445],[.115,.51,.445],[0,.425,.455]].map(point=>{
    const pos=mesh.geometry.attributes.position;let best=0,dist=Infinity;const v=new T.Vector3(),goal=new T.Vector3().fromArray(point);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const d=v.distanceToSquared(goal);if(d<dist){dist=d;best=i;}}
    mesh.skeleton.update();v.fromBufferAttribute(pos,best);mesh.applyBoneTransform(best,v);mesh.localToWorld(v);v.project(p.camera);
    return [Math.round((v.x+1)*canvas.width/2),Math.round((1-v.y)*canvas.height/2)];
   });
   for(const [x,y] of probes)if(x<2||y<2||x>=canvas.width-2||y>=canvas.height-2)throw Error('Face dye probe outside rendered frame');
   function pixels(value){p.dye.set(value);p.renderer.render(p.scene,p.camera);ctx.drawImage(p.renderer.domElement,0,0);return {samples:probes.map(([x,y])=>Array.from(ctx.getImageData(x-1,y-1,3,3).data)),frame:ctx.getImageData(0,0,canvas.width,canvas.height).data};}
   const original=pixels({id:'original'}),dyed=pixels({base:'#ff3333',patch:'#3355ff'});p.dye.set(look);
   let changedPixels=0;for(let i=0;i<original.frame.length;i+=4)if([0,1,2].some(j=>Math.abs(original.frame[i+j]-dyed.frame[i+j])>5))changedPixels++;
   return {probes,changedPixels,maxChannelChange:Math.max(...original.samples.flatMap((a,i)=>a.map((v,j)=>Math.abs(v-dyed.samples[i][j]))))};
  });
  assert.ok(result.dyeProtection.changedPixels>100,'Fur dye must visibly change rendered pixels');
  assert.ok(result.dyeProtection.maxChannelChange<=1,'Eyes and nose must retain their original colour under extreme fur dye');
  await page.locator('#walk').click();
  result.motion=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview;
   let maxError=0,drift=0,prev,soleDrift=0,boneError=0,maxSoleGap=0,maxPenetration=0;
   const mesh=(()=>{let m;p.cat.traverse(o=>{if(o.isSkinnedMesh)m=o;});return m;})();
   const probes={};
   for(const leg of Object.keys(p.rig.legs)){
    const joint=mesh.skeleton.bones.findIndex(b=>b.name===leg+'Paw');const pos=mesh.geometry.attributes.position;
    const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;let best=-1,minY=Infinity;
    for(let i=0;i<pos.count;i++)for(let j=0;j<4;j++)if(si.getComponent(i,j)===joint&&sw.getComponent(i,j)>.99&&pos.getY(i)<minY){best=i;minY=pos.getY(i);}
    if(best<0)throw Error('No rigid paw sole '+leg);probes[leg]=best;
   }
   for(let i=0;i<3600;i++){
    p.step(1/60);const s=p.motion.snapshot();mesh.skeleton.update();
    for(const f of s.feet){
     maxError=Math.max(maxError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));
     const bone=p.cat.getObjectByName(f.name+'Paw');boneError=Math.max(boneError,bone.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3().fromArray(f.ankle)));
     const sole=mesh.localToWorld(mesh.applyBoneTransform(probes[f.name],new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,probes[f.name])));
     const r=(sole.x/1.86)**2+((sole.z-.54)/1.32)**2,ground=r<1?.067+.039*Math.sqrt(1-r):.04;
     if(f.stance){maxSoleGap=Math.max(maxSoleGap,sole.y-ground);maxPenetration=Math.max(maxPenetration,ground-sole.y);}
     if(prev){const old=prev.feet.find(g=>g.name===f.name);if(old.stance&&f.stance&&f.phase>=old.phase){drift=Math.max(drift,Math.hypot(...f.goal.map((v,j)=>v-old.goal[j])));soleDrift=Math.max(soleDrift,sole.distanceTo(new T.Vector3().fromArray(old.sole)));}}
     f.sole=sole.toArray();
    }
    prev=s;
   }
   return {maxError,drift,soleDrift,boneError,maxSoleGap,maxPenetration,clamps:p.motion.snapshot().clamps};
  });
  console.log('Motion contact metrics:',JSON.stringify(result.motion));
  assert.ok(result.motion.maxError<.001,'IK must reach the planted world target');
  assert.ok(result.motion.drift<1e-7&&result.motion.soleDrift<.0005,'Planted skinned soles must stay within sub-millimetre compression tolerance');
  assert.ok(result.motion.boneError<1e-6,'Exported bones must follow the solved ankles');
  assert.ok(result.motion.maxSoleGap<.004&&result.motion.maxPenetration<.002,'Skinned paw soles must contact the rug');
  await page.locator('#walk').click();
  await page.evaluate(()=>{for(let i=0;i<120;i++)petHousePreview.step(1/60);});
  const stopped=await page.evaluate(()=>petHousePreview.snapshot());
  assert.equal(stopped.walking,false);assert.equal(stopped.speed,0);assert.ok(stopped.motion.feet.every(f=>f.stance));
  await page.locator('#fur').click();await page.getByRole('button',{name:'橘白',exact:true}).click();
  await page.locator('#fur-base').fill('#e4e8d3');await page.locator('#fur-patch').fill('#78946c');
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).look.patch,'#78946c');
  await page.reload();await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready);
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).look.patch,'#78946c');
  await page.locator('#fur').click();await page.getByRole('button',{name:'原色',exact:true}).click();
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).look.id,'original');
  assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).evening,false);
  assert.deepEqual(result.errors,[]);
  result.ok=true;fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
