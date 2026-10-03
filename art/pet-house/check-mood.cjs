// Exercise actual exported skins, rather than just checking mood coefficients.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PET_HOUSE_URL||'http://127.0.0.1:18952',out=process.env.PET_HOUSE_EVIDENCE||'/tmp/pet-moods/browser';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:640,height:640}}),errors=[],result={};page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(base+'/art/pet-house/preview.html');await page.waitForFunction(()=>window.petHousePreview?.snapshot().ready);await page.evaluate(()=>requestAnimationFrame=()=>0);
 for(const species of ['cat','dog']){
  await page.locator('#pet-species').selectOption(species);result[species]={};
  await page.evaluate(async()=>{const p=petHousePreview,T=await import('three');window.moodT=T;p.petRoot.position.set(0,.041,0);p.petRoot.rotation.y=0;p.pet.setTail({wag:false});p.pet.setMood('neutral');p.pet.bind({ground:()=>.04});p.room.visible=false;p.scene.children.find(o=>o.isMesh&&o.geometry.type==='PlaneGeometry').position.y=.04;
   let mesh;p.cat.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});window.moodMesh=mesh;const pos=mesh.geometry.attributes.position;
   const anchors=p.pet.species==='cat'?[[0,.425,.455],[-.115,.51,.445],[.115,.51,.445],[0,.60,.06],[-.14,.71,.198]]:[[0,.555,.489],[-.075,.617,.382],[.075,.617,.382],[0,.66,.075],[-.23,.653,.19]];
   window.moodProbes=anchors.map(a=>{let best=0,dist=Infinity;const v=new T.Vector3(),target=new T.Vector3().fromArray(a);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const d=v.distanceToSquared(target);if(d<dist){dist=d;best=i;}}return best;});
   window.skinPoints=()=>{mesh.skeleton.update();return moodProbes.map(i=>mesh.localToWorld(mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(pos,i))));};
   window.neutralPoints=skinPoints().map(v=>v.toArray());window.neutralEars=p.cat.getObjectByName('earL').quaternion.toArray();
   document.querySelectorAll('body > :not(#view):not(script)').forEach(e=>e.style.visibility='hidden');
  });
  for(const mood of ['happy','relaxed','curious','sleepy','guarded','gloomy']){
   result[species][mood]=await page.evaluate(mood=>{const p=petHousePreview,T=moodT;p.petRoot.position.set(0,.041,0);p.petRoot.rotation.y=0;p.pet.setMood('neutral');p.pet.bind({ground:()=>.04});for(let i=0;i<300;i++)p.pet.motion.update(1/60,0);p.pet.setMood(mood);let skullError=0,footError=0,minSupport=4,maxStep=0,previous=null;
    for(let i=0;i<180;i++){p.pet.motion.update(1/60,0);const points=skinPoints();for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)skullError=Math.max(skullError,Math.abs(points[a].distanceTo(points[b])-new T.Vector3().fromArray(neutralPoints[a]).distanceTo(new T.Vector3().fromArray(neutralPoints[b]))));if(previous)maxStep=Math.max(maxStep,points[0].distanceTo(previous));previous=points[0].clone();const s=p.pet.motion.snapshot();minSupport=Math.min(minSupport,s.feet.filter(f=>f.stance).length);for(const f of s.feet)footError=Math.max(footError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));}
    const ss=p.pet.motion.snapshot(),points=skinPoints(),headChange=points[0].distanceTo(new T.Vector3().fromArray(neutralPoints[0]));
    const earRelativeChange=new T.Vector3().fromArray(neutralPoints[4]).sub(new T.Vector3().fromArray(neutralPoints[0])).length()-points[4].distanceTo(points[0]);
    const at=new T.Vector3(0,.43,0);p.camera.left=-.71;p.camera.right=.71;p.camera.top=.71;p.camera.bottom=-.71;p.camera.position.copy(at).add(new T.Vector3(1.7,.32,2.5));p.camera.lookAt(at);p.camera.updateProjectionMatrix();p.renderer.render(p.scene,p.camera);
    return {skullError,footError,minSupport,maxStep,clamps:ss.clamps,headChange,earRelativeChange,head:points[0].toArray(),ear:points[4].toArray(),pose:ss.pose};
   },mood);
   const r=result[species][mood];assert.ok(r.skullError<1e-6,JSON.stringify(r));assert.ok(r.footError<.001,JSON.stringify(r));assert.equal(r.clamps,0,JSON.stringify(r));assert.equal(r.minSupport,4);assert.ok(r.maxStep<.005,'Mood changes must ease into the pose '+species+' '+mood+' '+JSON.stringify(r));assert.ok(r.headChange>.005,'A mood must visibly change the skin');assert.ok(Math.abs(r.earRelativeChange)>.0001,'Ears must move relative to the face');
   await page.locator('canvas').screenshot({path:path.join(out,species+'-'+mood+'.png')});
  }
  assert.ok(Math.hypot(...result[species].sleepy.head.map((v,i)=>v-result[species].curious.head[i]))>.03,'Curious and sleepy need visibly different poses');
  result[species].rebind=await page.evaluate(()=>{const p=petHousePreview,before=skinPoints()[0].clone(),pose=p.pet.motion.snapshot().pose;p.pet.bind({ground:()=>.04});const after=skinPoints()[0];return {distance:before.distanceTo(after),posePreserved:JSON.stringify(pose)===JSON.stringify(p.pet.motion.snapshot().pose)};});assert.ok(result[species].rebind.distance<1e-6);assert.equal(result[species].rebind.posePreserved,true);
  // Mood poses must not break faster locomotion or manual tail adjustment.
  result[species].walking=await page.evaluate(()=>{const p=petHousePreview;let maxError=0,minSupport=4,clamps=0;for(const id of ['happy','curious','sleepy','guarded','gloomy']){p.petRoot.position.set(0,.041,0);p.pet.setMood(id);const m=p.pet.bind({ground:()=>.04,matchSpeed:true});for(let i=0;i<600;i++){p.petRoot.position.z+=1.1/60;m.update(1/60,1.1);const s=m.snapshot();minSupport=Math.min(minSupport,s.feet.filter(f=>f.stance).length);for(const f of s.feet)maxError=Math.max(maxError,Math.hypot(...f.ankle.map((v,j)=>v-f.goal[j])));}clamps+=m.snapshot().clamps;}return {maxError,minSupport,clamps};});
  assert.ok(result[species].walking.maxError<.001,JSON.stringify(result[species].walking));assert.equal(result[species].walking.clamps,0);assert.equal(result[species].walking.minSupport,2);
  await page.evaluate(()=>document.querySelectorAll('body > :not(#view):not(script)').forEach(e=>e.style.removeProperty('visibility')));
 }
 result.viewports=[];
 for(const [width,height]of[[320,568],[390,844],[430,932],[932,430]]){
  await page.setViewportSize({width,height});await page.locator('#mood').click();await page.locator('[data-mood=curious]').click();assert.equal(await page.evaluate(()=>petHousePreview.snapshot().mood.id),'curious');assert.equal(await page.locator('[data-mood=curious]').getAttribute('aria-pressed'),'true');
  for(const b of await page.locator('.pet-choice select,.pet-choice button,#mood-panel button').all()){const rect=await b.boundingBox();assert.ok(rect.height>=40&&rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<=height,JSON.stringify(rect));}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'mood-ui-'+width+'.png')});await page.locator('#tail').click();assert.equal(await page.locator('#mood-panel').isVisible(),false);await page.locator('#fur').click();assert.equal(await page.locator('#tail-panel').isVisible(),false);await page.locator('#mood').click();assert.equal(await page.locator('#fur-panel').isVisible(),false);await page.locator('#mood').click();result.viewports.push({width,height});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log('Mood skins, rigid skulls, grounded paws and mobile controls passed');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
