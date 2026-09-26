// Actual Draco asset + shared traveler: joint articulation, grip synchronization,
// morph rebinding, pose continuity, and clone isolation. Run against a local HTTP server.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ARM_TEST_URL||'http://127.0.0.1:18926';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:''}));
 await page.goto(base+'/apps/companion/');
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');
  const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;
  const catalog=await (await fetch('../fairy-garden/doll.json')).json();
  const check=(ok,msg)=>{if(!ok)throw Error(msg);};
  const scene=new T.Scene();scene.background=new T.Color('#eee9df');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));
  const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const camera=new T.OrthographicCamera(-1.8,1.8,1.3,-1.3,.1,20);camera.position.set(0,1.3,6);camera.lookAt(0,.6,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,850);document.body.append(renderer.domElement);
  const dimsList=[{},Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))];
  dimsList.push({...dimsList[1],head:dimsList[2].head,build:dimsList[2].build},{...dimsList[2],shoulder:dimsList[1].shoulder});
  const doll=createTraveler(source),other=createTraveler(source,true);scene.add(doll.root,other.root);
  const findBone=(d,name)=>{let bone;d.root.traverse(o=>{if(o.isBone&&o.name===name)bone=o;});return bone;};
  for(const side of ['left','right']){
   const lower=findBone(doll,side+'Forearm');check(lower?.parent===findBone(doll,side+'Arm'),'Missing connected elbow');
   check(doll.root.getObjectByName(side==='left'?'Left_hand':'Right_hand').parent===lower,'Grip detached from forearm');
  }
  other.animate(1,{gesture:'stretch',progress:.5});
  const otherBones=[];other.root.traverse(o=>{if(o.isBone)otherBones.push([o,o.quaternion.clone(),o.position.clone()]);});
  const inverses=[];other.root.traverse(o=>{if(o.isSkinnedMesh)inverses.push([o,o.skeleton.boneInverses.map(m=>m.clone())]);});
  let frames=0,t=0,maxGripError=0,maxHeadIntrusions=0;
  for(const outfit of Object.keys(catalog.outfits))for(const hair of Object.keys(catalog.hair))for(const dims of dimsList){
   doll.setLook({outfit,hair,dims:Object.fromEntries(catalog.dims.map(d=>[d.key,dims[d.key]??1]))});
   for(const gesture of ['wave','stretch','tea','read','water','lamp','plant','draw','eat','give']){
    for(const progress of [0,.2,.5,.8,1]){
     doll.animate(t+=.1,{gesture,progress,height:0});frames++;
     doll.root.updateMatrixWorld(true);
     for(const side of ['left','right']){
      const name=side==='left'?'Left_hand':'Right_hand',hand=doll.root.getObjectByName(name);
      const error=doll.handPoint(side).distanceTo(hand.getWorldPosition(new T.Vector3()));
      maxGripError=Math.max(maxGripError,error);check(error<1e-5,'Stale grip: '+gesture);
     }
     for(const [name,side,offset]of [['TeaCup','right',0],['WateringCan','right',-.025],['FoodBowl','left',-.02],['SeedPacket','left',0]]){
      const prop=doll.root.getObjectByName(name);if(!prop.visible)continue;
      const expected=doll.root.getObjectByName('TravelerVisual').worldToLocal(doll.handPoint(side));expected.y+=offset;
      check(expected.distanceTo(prop.position)<1e-5,'Prop not on current pose: '+name);
     }
     const body=doll.root.getObjectByName('DollBody'),position=body.geometry.attributes.position,weights=body.geometry.attributes.skinWeight,joints=body.geometry.attributes.skinIndex;
     const head=doll.root.getObjectByName('HeadAnchor'),center=head.getWorldPosition(new T.Vector3());
     // Distal arm samples must not enter the solid central skull. Hair shells are checked visually below.
     let intrusions=0;
     for(let i=0;i<position.count;i+=13){
      let forearm=0;for(let k=0;k<4;k++)if(/Forearm$/.test(body.skeleton.bones[joints.getComponent(i,k)]?.name||''))forearm+=weights.getComponent(i,k);
      if(forearm<.85)continue;
      const v=body.localToWorld(body.getVertexPosition(i,new T.Vector3())).sub(center);
      const scale=dims.head??1;
      if((v.x/(.16*scale))**2+(v.y/(.14*scale))**2+(v.z/(.15*scale))**2<1)intrusions++;
     }
     maxHeadIntrusions=Math.max(maxHeadIntrusions,intrusions);check(!intrusions,'Forearm inside skull '+outfit+' '+hair+' '+gesture);
    }
   }
  }
  for(const [bone,q,p]of otherBones)check(bone.quaternion.angleTo(q)<1e-6&&bone.position.distanceTo(p)<1e-8,'Other avatar changed');
  for(const [mesh,old]of inverses)old.forEach((m,i)=>check(m.equals(mesh.skeleton.boneInverses[i]),'Shared inverse bind matrix'));
  // Release from a raised pose must ease, not teleport back to idle.
  for(let i=0;i<20;i++)doll.animate(t+=1/60,{gesture:'wave',progress:.5});
  const arm=findBone(doll,'rightForearm'),before=arm.quaternion.clone();
  doll.animate(t+=1/60,{gesture:'rest'});check(before.angleTo(arm.quaternion)<.65,'Abrupt action release');
  for(let i=0;i<60;i++)doll.animate(t+=1/60,{gesture:'rest'});
  doll.setLook({dims:{height:1,shoulder:1,waist:1,flare:1,build:1,head:1}});
  for(let i=0;i<20;i++)doll.animate(t+=.1,{gesture:'stretch',progress:.5});
  const right=findBone(doll,'rightForearm');check(right.quaternion.angleTo(source.getObjectByName('rightForearm').quaternion)>.5,'Elbow never bends');
  scene.remove(doll.root,other.root);
  const display=[];for(let i=0;i<6;i++){
   const d=createTraveler(source,false,{hair:i<3?'airbang':'pixie',outfit:['academy','garden','ranger','cardigan','academy','garden'][i]});scene.add(d.root);
   for(let j=0;j<20;j++)d.animate(j*.1,{gesture:i%3===0?'tea':i%3===1?'wave':'stretch',progress:.5,height:0});
   d.root.position.set((i%3-1)*.95,i<3?.65:-.65,0);display.push(d);
  }
  window.armStudy={display,scene,renderer,camera,T,dimsList};renderer.render(scene,camera);draco.dispose();
  return {frames,maxGripError,maxHeadIntrusions,outfits:Object.keys(catalog.outfits).length,hair:Object.keys(catalog.hair).length,bodyVariants:dimsList.length};
 });
 await page.screenshot({path:process.env.ARM_SCREENSHOT||'/tmp/shared-arm-front.png'});
 await page.evaluate(()=>{const {display,renderer,scene,camera}=armStudy;display.forEach(d=>d.root.rotation.y=.85);renderer.render(scene,camera);});
 await page.screenshot({path:'/tmp/shared-arm-side.png'});
 await page.evaluate(()=>{const {display,renderer,scene,camera,dimsList}=armStudy;display.forEach((d,i)=>{d.setLook({dims:dimsList[i%2+1]});for(let j=0;j<20;j++)d.animate(3+j*.1,{gesture:i%3===0?'tea':i%3===1?'wave':'stretch',progress:.5,height:0});d.root.position.y=i<3?.65:-.65;});renderer.render(scene,camera);});
 await page.screenshot({path:'/tmp/shared-arm-extremes.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
 // The real companion route must load and animate the same exported asset.
 await page.unroute('**/pet.mjs*');await page.goto(base+'/apps/companion/');await page.waitForFunction(()=>window.petDebug);
 await page.evaluate(()=>petDebug.play('stretch',.5));await page.screenshot({path:'/tmp/shared-arm-companion.png'});
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/apps/fairy-garden/');
 await page.waitForFunction(()=>window.gardenDebug?.getReady());
 await page.locator('#loading').waitFor({state:'detached'});
 await page.locator('#gesture-stretch').evaluate(b=>b.click());
 await page.waitForFunction(()=>gardenDebug.getDailyActions().player?.stretching);
 await page.screenshot({path:'/tmp/shared-arm-garden.png'});
 await page.waitForFunction(()=>!gardenDebug.getPlayer().acting);
 assert.deepEqual(errors,[]);console.log('PASS shared rig, current-frame props, independent avatars, companion and garden actions');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
