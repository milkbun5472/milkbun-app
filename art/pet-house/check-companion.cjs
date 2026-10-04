const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PET_HOUSE_URL||'http://127.0.0.1:18952',out=process.env.PET_HOUSE_EVIDENCE||'/tmp/pet-companion-browser';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true}),page=await b.newPage({viewport:{width:390,height:780}}),errors=[],report={pets:{},viewports:[]};page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 try{
  await page.goto(base+'/art/pet-house/preview.html');await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready);
  for(const species of ['cat','dog']){
   await page.locator('#pet-species').selectOption(species);await page.locator('#look-cat').click();await page.locator('#tail').click();await page.locator('#tail-pitch').fill('20');await page.locator('#tail-yaw').fill('-25');
   assert.deepEqual((await page.evaluate(()=>petHousePreview.snapshot())).tail,{wag:true,pitch:20,yaw:-25});
   await page.locator('#tail-wag').click();assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).tail.wag,false);
   const deformation=await page.evaluate(async()=>{
    const T=await import('three'),p=petHousePreview;const mesh=(()=>{let m;p.cat.traverse(o=>{if(o.isSkinnedMesh)m=o;});return m;})();
    function pose(tail,time=0){p.motion.setTail(tail);p.motion.update(time,0);mesh.skeleton.update();const pos=mesh.geometry.attributes.position;return Array.from({length:pos.count},(_,i)=>mesh.localToWorld(mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(pos,i))).toArray());}
    const neutral=pose({wag:false}),angled=pose({wag:false,pitch:20,yaw:-25}),wag0=pose({wag:true}),wag1=pose({wag:true},.05);pose(p.pet.tail);
    return {angledChange:Math.max(...neutral.map((v,i)=>Math.hypot(...v.map((n,j)=>n-angled[i][j])))),wagChange:Math.max(...wag0.map((v,i)=>Math.hypot(...v.map((n,j)=>n-wag1[i][j])))),bones:mesh.skeleton.bones.length};
   });
   assert.equal(deformation.bones,20);assert.ok(deformation.angledChange>.04);assert.ok(deformation.wagChange>.0001);report.pets[species]={deformation};
   report.pets[species].dyeProtection=await page.evaluate(async()=>{
   const T=await import('three'),p=petHousePreview,look=p.dye.snapshot();let mesh;p.cat.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
   const at=p.petRoot.position.clone().add(new T.Vector3(0,.45,0));
   p.camera.left=-.65;p.camera.right=.65;p.camera.top=.65;p.camera.bottom=-.65;
   p.camera.position.copy(at).add(new T.Vector3(.05,.25,1.8).applyAxisAngle(new T.Vector3(0,1,0),p.petRoot.rotation.y));p.camera.lookAt(at);p.camera.updateProjectionMatrix();
   p.camera.updateMatrixWorld(true);p.scene.updateMatrixWorld(true);
   const canvas=document.createElement('canvas');canvas.width=p.renderer.domElement.width;canvas.height=p.renderer.domElement.height;const ctx=canvas.getContext('2d');
   const probes=(p.pet.species==='dog'?[[-.075,.617,.382],[.075,.617,.382],[0,.555,.489],[0,.47,.455]]:[[-.115,.51,.445],[.115,.51,.445],[0,.425,.455]]).map(point=>{
    const pos=mesh.geometry.attributes.position;let best=0,dist=Infinity;const v=new T.Vector3(),goal=new T.Vector3().fromArray(point);
    for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const d=v.distanceToSquared(goal);if(d<dist){dist=d;best=i;}}
    mesh.skeleton.update();v.fromBufferAttribute(pos,best);mesh.applyBoneTransform(best,v);mesh.localToWorld(v);v.project(p.camera);
    return [Math.round((v.x+1)*canvas.width/2),Math.round((1-v.y)*canvas.height/2)];
   });
   for(const [x,y] of probes)if(x<2||y<2||x>=canvas.width-2||y>=canvas.height-2)throw Error('Face dye probe outside rendered frame');
   function pixels(value){p.dye.set(value);p.renderer.render(p.scene,p.camera);ctx.drawImage(p.renderer.domElement,0,0);return {samples:probes.map(([x,y])=>Array.from(ctx.getImageData(x-1,y-1,3,3).data)),frame:ctx.getImageData(0,0,canvas.width,canvas.height).data};}
   const original=pixels({id:'original'}),dyed=pixels({base:'#ff3333',patch:'#3355ff'});p.dye.set(look);
   let changedPixels=0;for(let i=0;i<original.frame.length;i+=4)if([0,1,2].some(j=>Math.abs(original.frame[i+j]-dyed.frame[i+j])>5))changedPixels++;
   return {probes,changedPixels,centres:original.samples.map((a,i)=>Math.max(...[16,17,18].map(j=>Math.abs(a[j]-dyed.samples[i][j])))),changes:original.samples.map((a,i)=>Math.max(...a.map((v,j)=>Math.abs(v-dyed.samples[i][j])))),maxChannelChange:Math.max(...original.samples.flatMap((a,i)=>a.map((v,j)=>Math.abs(v-dyed.samples[i][j]))))};
  });
  console.log('DYE',species,JSON.stringify(report.pets[species].dyeProtection));
  assert.ok(report.pets[species].dyeProtection.changedPixels>100,'Fur dye must visibly change rendered pixels');
  assert.ok(report.pets[species].dyeProtection.maxChannelChange<=1,'Eyes and nose must retain their original colour under extreme fur dye');

   await page.screenshot({path:path.join(out,species+'-tail.png')});await page.locator('#tail-reset').click();await page.locator('#tail').click();
   // Both actual skinned pets must support every foot with one master cycle,
   // maintain quarter-cycle spacing, and stop on the ground after deceleration.
   await page.locator('#walk').click();
   report.pets[species].walk=await page.evaluate(()=>{
    const p=petHousePreview;let minSupport=4,maxError=0,phaseError=0,errorDetail=null;
    for(let i=0;i<3600;i++){p.step(1/60);const s=p.motion.snapshot();minSupport=Math.min(minSupport,s.feet.filter(f=>f.stance).length);for(const f of s.feet){const error=Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j]));if(error>maxError){maxError=error;errorDetail={frame:i,foot:f};}const offset={backL:0,frontL:.75,backR:.5,frontR:.25}[f.name],expected=((s.cycle+offset)%1+1)%1;phaseError=Math.max(phaseError,Math.abs(f.phase-expected));}}
    return {minSupport,maxError,phaseError,errorDetail,clamps:p.motion.snapshot().clamps};
   });
   console.log('WALK',species,JSON.stringify(report.pets[species].walk));assert.equal(report.pets[species].walk.minSupport,2);assert.ok(report.pets[species].walk.maxError<.001);assert.equal(report.pets[species].walk.phaseError,0);assert.equal(report.pets[species].walk.clamps,0);
   await page.locator('#walk').click();await page.evaluate(()=>{for(let i=0;i<180;i++)petHousePreview.step(1/60);});assert.ok((await page.evaluate(()=>petHousePreview.snapshot())).motion.feet.every(f=>f.stance));
   await page.locator('#tail').click();await page.locator('#tail-yaw').fill(species==='cat'?'12':'-15');await page.locator('#tail').click();
   if((await page.evaluate(()=>petHousePreview.snapshot())).following)await page.locator('#look-cat').click();
  }
  await page.reload();await page.waitForFunction(()=>window.petHousePreview);assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).species,'dog');assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).tail.yaw,-15);await page.locator('#pet-species').selectOption('cat');assert.equal((await page.evaluate(()=>petHousePreview.snapshot())).tail.yaw,12);
  for(const [width,height] of [[320,568],[390,780],[430,932],[932,430]]){
   await page.setViewportSize({width,height});await page.locator('#tail').click();await page.waitForTimeout(100);
   for(const el of await page.locator('.pet-choice select,.pet-choice button,#tail-panel input,#tail-panel button').all()){const r=await el.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width&&r.y>=0&&r.y+r.height<=height,JSON.stringify(r));assert.ok(r.height>=40);}
   await page.screenshot({path:path.join(out,'controls-'+width+'.png')});await page.locator('#tail').click();report.viewports.push({width,height});
  }
  await page.setViewportSize({width:640,height:640});
  // Render a complete gait cycle from a fixed side view for human inspection.
  await page.evaluate(()=>{requestAnimationFrame=()=>0;});
  for(const species of ['cat','dog']){
   await page.locator('#pet-species').selectOption(species);
   await page.evaluate(async()=>{const T=await import('three'),p=petHousePreview;p.petRoot.position.set(0,.041,0);p.petRoot.rotation.y=0;p.pet.setTail({wag:true});window.gaitMotion=p.pet.bind({ground:()=>.04});window.gaitT=T;window.gaitSpeed=p.rig.stride/p.rig.duty/p.rig.cycle*p.cat.scale.x;for(let i=0;i<180;i++){p.petRoot.position.z+=gaitSpeed/60;gaitMotion.update(1/60,gaitSpeed);}});
   for(let i=0;i<30;i++){
    await page.evaluate(()=>{const p=petHousePreview,T=gaitT;for(let j=0;j<2;j++){const dt=p.rig.cycle/60;p.petRoot.position.z+=gaitSpeed*dt;gaitMotion.update(dt,gaitSpeed);}const at=p.petRoot.position.clone().add(new T.Vector3(0,.40,0));p.camera.left=-.74;p.camera.right=.74;p.camera.top=.74;p.camera.bottom=-.74;p.camera.position.copy(at).add(new T.Vector3(2,.45,.5));p.camera.lookAt(at);p.camera.updateProjectionMatrix();p.renderer.render(p.scene,p.camera);});
    await page.locator('canvas').screenshot({path:path.join(out,`${species}-walk-${String(i).padStart(2,'0')}.png`)});
   }
  }
  // Selection and articulated tails carry through every physical doorway.
  await page.goto(base+'/art/pet-career/preview.html?scene=outside');await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready);await page.locator('#pet-species').selectOption('dog');report.rooms=[];
  for(const id of ['home','bakery','florist','store','cafe','alley']){
   const state=await page.evaluate(async id=>{const p=petCareerPreview;if(p.snapshot().room)p.leave();p.goTo(p.world.building(id).approach,id);for(let i=0;i<16000&&p.snapshot().walking;i++)p.step(.05);return p.snapshot();},id);
   await page.waitForFunction(id=>petCareerPreview.snapshot().room===id&&!petCareerPreview.snapshot().busy,id,{timeout:60000});assert.equal((await page.evaluate(()=>petCareerPreview.snapshot())).species,'dog');
   await page.locator('#tail').click();await page.locator('#tail-pitch').fill('10');await page.locator('#tail').click();await page.locator('#look-cat').click();await page.screenshot({path:path.join(out,'dog-room-'+id+'.png')});report.rooms.push(id);
  }
  assert.deepEqual(errors,[]);report.ok=true;fs.writeFileSync(path.join(out,'companion.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
