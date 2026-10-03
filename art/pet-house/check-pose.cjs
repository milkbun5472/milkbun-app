// Real exported skin regression: a skull must keep its facial/back-of-head
// distances under the motion engine; planted paws are checked by check-preview.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PET_HOUSE_URL||'http://127.0.0.1:18952',out=process.env.PET_HOUSE_EVIDENCE||'/tmp/pet-head-gait/pose';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:720,height:720}}),errors=[],results={};page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/art/pet-house/preview.html');await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready);await page.evaluate(()=>{requestAnimationFrame=()=>0;});
  for(const species of ['cat','dog']){
   await page.locator('#pet-species').selectOption(species);
   results[species]=await page.evaluate(async()=>{
    const T=await import('three'),p=petHousePreview;let mesh;p.cat.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});const pos=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,headIndex=mesh.skeleton.bones.findIndex(b=>b.name==='head');
    const anchors=p.pet.species==='cat'?[[0,.425,.455],[-.115,.51,.445],[.115,.51,.445],[0,.60,.06],[-.14,.81,.12],[.14,.81,.12]]:[[0,.555,.489],[-.075,.617,.382],[.075,.617,.382],[0,.66,.075],[-.23,.65,.19],[.23,.65,.19]];
    const probes=anchors.map(a=>{let best=0,dist=Infinity;const v=new T.Vector3(),target=new T.Vector3().fromArray(a);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const d=v.distanceToSquared(target);if(d<dist){dist=d;best=i;}}let headWeight=0;for(let j=0;j<4;j++)if(si.getComponent(best,j)===headIndex)headWeight+=sw.getComponent(best,j);return {index:best,rest:new T.Vector3().fromBufferAttribute(pos,best).toArray(),headWeight,distance:Math.sqrt(dist)};});
    p.petRoot.position.set(0,.041,0);p.petRoot.rotation.y=0;const m=p.pet.bind({ground:()=>.04});m.update(0,0);mesh.skeleton.update();
    const points=()=>probes.map(v=>mesh.localToWorld(mesh.applyBoneTransform(v.index,new T.Vector3().fromBufferAttribute(pos,v.index))));
    const original=points(),restPairs=[];for(let i=0;i<original.length;i++)for(let j=i+1;j<original.length;j++)restPairs.push([i,j,original[i].distanceTo(original[j])]);
    let maxSkullChange=0,minSupport=4,maxFootError=0,previousFeet=null,maxPawJump=0,jumpDetail=null,maxLiftJump=0,maxLandingJump=0;
    const speed=p.rig.stride/p.rig.duty/p.rig.cycle*p.cat.scale.x;
    for(let i=0;i<900;i++){
     const walking=i<600,dt=1/60,v=walking?speed:0;p.petRoot.position.z+=v*dt;m.update(dt,v,.7*Math.sin(i/50),walking);mesh.skeleton.update();const frame=points();for(const [a,b,d]of restPairs)maxSkullChange=Math.max(maxSkullChange,Math.abs(frame[a].distanceTo(frame[b])-d));
     const s=m.snapshot();minSupport=Math.min(minSupport,s.feet.filter(f=>f.stance).length);for(const f of s.feet){maxFootError=Math.max(maxFootError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));if(previousFeet){const old=previousFeet.find(g=>g.name===f.name);const jump=Math.hypot(...f.ankle.map((v,j)=>v-old.ankle[j]));if(old.stance&&!f.stance)maxLiftJump=Math.max(maxLiftJump,jump);if(!old.stance&&f.stance)maxLandingJump=Math.max(maxLandingJump,jump);if(jump>maxPawJump){maxPawJump=jump;jumpDetail={frame:i,name:f.name,old,f};}}}previousFeet=s.feet;
    }
    const walkResult={probes,maxSkullChange,minSupport,maxFootError,maxPawJump,maxLiftJump,maxLandingJump,jumpDetail,clamps:m.snapshot().clamps,stopped:m.snapshot().feet.every(f=>f.stance)};
    p.petRoot.position.set(0,.041,0);const fast=p.pet.bind({ground:()=>.04,matchSpeed:true});let fastError=0,fastSupport=4,diagonalError=0,fastHeadChange=0;
    for(let i=0;i<900;i++){const v=i<600?1.1:0;p.petRoot.position.z+=v/60;fast.update(1/60,v,0,v>0);mesh.skeleton.update();const ss=fast.snapshot(),frame=points();for(const [a,b,d]of restPairs)fastHeadChange=Math.max(fastHeadChange,Math.abs(frame[a].distanceTo(frame[b])-d));fastSupport=Math.min(fastSupport,ss.feet.filter(f=>f.stance).length);for(const f of ss.feet)fastError=Math.max(fastError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));const phase=name=>ss.feet.find(f=>f.name===name).phase;diagonalError=Math.max(diagonalError,Math.abs(phase('frontL')-phase('backR')),Math.abs(phase('frontR')-phase('backL')));}
    const fs=fast.snapshot();walkResult.fast={gait:fs.gait,rate:fs.rate,maxError:fastError,minSupport:fastSupport,diagonalError,maxSkullChange:fastHeadChange,clamps:fs.clamps,stopped:fs.feet.every(f=>f.stance)};return walkResult;
   });
   console.log('POSE',species,JSON.stringify(results[species]));
   assert.ok(results[species].probes.every(p=>p.headWeight>.99999),'Front face, rear skull and ears must all bind to the head');assert.ok(results[species].maxSkullChange<1e-6,'The skull must stay rigid rather than splitting between head/chest');assert.equal(results[species].minSupport,2);assert.ok(results[species].maxFootError<.001);assert.ok(results[species].maxLiftJump<.005,'A lift must start smoothly at the planted point');assert.ok(results[species].maxLandingJump<.005,'Touchdown must finish smoothly at the planted point');assert.equal(results[species].clamps,0);assert.equal(results[species].stopped,true);const fast=results[species].fast;assert.equal(fast.gait,'trot');assert.ok(fast.rate<3.1,'Outdoor pace must not turn into six-cycle-per-second shuffling');assert.equal(fast.diagonalError,0);assert.equal(fast.minSupport,2);assert.ok(fast.maxError<.001);assert.ok(fast.maxSkullChange<1e-6);assert.equal(fast.clamps,0);assert.equal(fast.stopped,true);
   if(process.env.PET_POSE_CAPTURE!=='0'){
   // Fresh bind, no queued animation, one complete cycle viewed from both sides.
   await page.evaluate(async()=>{const T=await import('three'),p=petHousePreview;window.poseT=T;p.petRoot.position.set(0,.041,0);p.petRoot.rotation.y=0;window.poseMotion=p.pet.bind({ground:()=>.04});window.poseSpeed=p.rig.stride/p.rig.duty/p.rig.cycle*p.cat.scale.x;for(let i=0;i<180;i++){p.petRoot.position.z+=poseSpeed/60;poseMotion.update(1/60,poseSpeed);}p.room.visible=false;p.scene.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry').position.y=.04;document.querySelectorAll('body > :not(#view):not(script)').forEach(el=>el.style.visibility='hidden');});
   for(let i=0;i<36;i++){
    await page.evaluate(()=>{const p=petHousePreview,T=poseT,dt=p.rig.cycle/36;p.petRoot.position.z+=poseSpeed*dt;poseMotion.update(dt,poseSpeed);const at=p.petRoot.position.clone().add(new T.Vector3(0,.43,0));p.camera.left=-.71;p.camera.right=.71;p.camera.top=.71;p.camera.bottom=-.71;p.camera.position.copy(at).add(new T.Vector3(2,.34,.75));p.camera.lookAt(at);p.camera.updateProjectionMatrix();p.renderer.render(p.scene,p.camera);});await page.locator('canvas').screenshot({path:path.join(out,`${species}-${String(i).padStart(2,'0')}.png`)});
   }
   await page.evaluate(()=>{document.querySelectorAll('body > :not(#view):not(script)').forEach(el=>el.style.removeProperty('visibility'));});
   }
  }
  await page.goto(base+'/art/pet-career/preview.html?scene=outside');await page.waitForFunction(()=>window.petCareerPreview?.snapshot().ready);await page.evaluate(()=>requestAnimationFrame=()=>0);results.street={};
  for(const species of ['cat','dog']){
   await page.locator('#pet-species').selectOption(species);
   results.street[species]=await page.evaluate(()=>{const p=petCareerPreview;let maxError=0,minSupport=4,maxTurn=0,frames=0;for(const b of p.layout.buildings){p.goTo(b.approach);for(let i=0;i<6000&&p.snapshot().walking;i++){const heading=p.petRoot.rotation.y;p.step(.05);frames++;maxTurn=Math.max(maxTurn,Math.abs(p.petRoot.rotation.y-heading));const ss=p.snapshot();minSupport=Math.min(minSupport,ss.motion.feet.filter(f=>f.stance).length);for(const f of ss.motion.feet)maxError=Math.max(maxError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));}for(let i=0;i<20;i++)p.step(.05);}return {frames,maxError,minSupport,maxTurn,clamps:p.snapshot().motion.clamps};});
   const r=results.street[species];assert.ok(r.frames>2000);assert.ok(r.maxError<.001,'Paws must remain reachable through all real street turns');assert.equal(r.clamps,0);assert.equal(r.minSupport,2);assert.ok(r.maxTurn<=.150001,'Facing must turn smoothly rather than jump at a path corner');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'pose.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
