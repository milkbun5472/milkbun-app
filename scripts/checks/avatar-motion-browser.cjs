const fs=require('node:fs'),path=require('node:path'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const OUT=process.env.MOTION_EVIDENCE||'/tmp/avatar-motion-review';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const engine=process.env.MOTION_BROWSER||'chromium',browser=await pw[engine].launch(engine==='webkit'?{headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}:{channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:640,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&!m.text().includes('GPU stall'))errors.push(m.text())});await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/pet.mjs'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(u.protocol))return r.abort();return r.continue()});await page.goto((process.env.COMPANION_TEST_URL||'http://127.0.0.1:18979')+'/apps/companion/');
console.log('Loading');await page.evaluate(async()=>{const T=await import('three'),mod=await import('../fairy-garden/traveler.mjs');const source=await mod.loadTravelerSource(),scene=new T.Scene();scene.background=new T.Color('#f4f1eb');scene.add(new T.HemisphereLight('#ffffff','#aaa29a',2.3));const light=new T.DirectionalLight('#ffffff',1.5);light.position.set(-2,3,4);scene.add(light);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,800);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);document.body.style.margin=0;const cam=new T.OrthographicCamera(-.64,.64,.8,-.8,.01,20);cam.position.set(0,.73,5);cam.lookAt(0,.7,0);const dims={height:1,shoulder:.92,waist:1,flare:1,build:1,head:1};const doll=mod.createTraveler(source,true,{outfit:'linen',hair:'korean',skin:'#f2cbb4',hairColor:'#292323',dims});scene.add(doll.root);await doll.ready();const catalog=await(await fetch('../fairy-garden/doll.json')).json();window.QA={T,mod,source,scene,renderer,cam,doll,dims,catalog,time:0};});console.log('Loaded');
if(process.env.MOTION_THINKING==='1')await checkThinking(page);else if(process.env.MOTION_CARDIGAN_SEAM==='1')await checkCardiganSeam(page);else if(process.env.MOTION_COLLAR_STRAP==='1')await checkCollarStrap(page);else if(process.env.MOTION_PHONE_CONTACT==='1')await checkPhoneContact(page);else if(process.env.MOTION_TRANSITIONS==='1')await checkTransitions(page);else{
const reports=[];
const catalog=await page.evaluate(()=>QA.catalog);
for(const id of Object.keys(catalog.outfits).filter(id=>!process.env.MOTION_OUTFITS||process.env.MOTION_OUTFITS.split(',').includes(id))){
 const dimensions=[['base',{height:1,shoulder:.92,waist:1,flare:1,build:1,head:1}],['minimum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]))],['maximum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]];
 for(const [dimName,dims] of dimensions){
  await page.evaluate(async({id,dims})=>{QA.doll.setLook({outfit:id,dims});await QA.doll.ready();const c=QA.doll.inspectMotion();if(!c.outfits.length||c.outfits.some(o=>o.userData.outfit!==id))throw Error('Wrong visible outfit '+id);},{id,dims});
  for(const [name,pose] of [['neutral',{}],['five-right',{emotion:'five-right'}],['cheer',{emotion:'cheer'}],['sit',{gesture:'sit',seated:true,seatPose:'chair'}],['phone',{emotion:'phone'}],['neutral-return',{}],['contact-lean',{}]]){
   const result=await page.evaluate(({pose,name})=>{const q=QA;for(let j=0;j<12;j++)q.doll.animate(q.time+=.1,{...pose,progress:.5});if(name==='contact-lean')q.doll.contactPose({tilt:.2,lean:.15,turn:.12});q.renderer.render(q.scene,q.cam);const c=q.doll.inspectMotion(),p=new q.T.Vector3();let max=0;for(const o of [c.body,...c.outfits]){o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,p);if(!Number.isFinite(p.lengthSq()))throw Error('Nonfinite '+o.name);max=Math.max(max,p.length());}}if(max>3)throw Error('Exploded garment '+max);if(!q.doll.handPoint('left').toArray().every(Number.isFinite))throw Error('Invalid left hand');return {max,feature:c.poseCurveCurrent.feature,hand:q.doll.handPoint('right').toArray(),bindingGeneration:c.bindingGeneration};},{pose,name});
   reports.push({id,dimName,name,...result});if(dimName==='base'||name==='cheer')await page.screenshot({path:path.join(OUT,id+'-'+dimName+'-'+name+'.png')});
  }
  fs.writeFileSync(path.join(OUT,'matrix.json'),JSON.stringify(reports));console.log(id,dimName);
 }
}
}
fs.writeFileSync(path.join(OUT,'errors.json'),JSON.stringify(errors));if(errors.length)throw Error(errors.join('\n'));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

// Same history on two actors; only one changes dimensions/outfit mid-motion.
// Full vertex comparisons at 0/18/19/30/31/60; stride-13 samples between.
async function checkTransitions(page){
const reports=[];
const ids=await page.evaluate(()=>Object.keys(QA.catalog.outfits));
for(const id of ids.filter(id=>!process.env.MOTION_OUTFITS||process.env.MOTION_OUTFITS.split(',').includes(id))){
 await page.evaluate(async id=>{const q=QA;q.doll.dispose();if(q.control)q.control.dispose();const look={outfit:id,hair:'korean',skin:'#f2cbb4',hairColor:'#292323',dims:q.dims};q.doll=q.mod.createTraveler(q.source,true,look);q.control=q.mod.createTraveler(q.source,true,look);q.scene.add(q.doll.root,q.control.root);q.control.root.visible=false;await Promise.all([q.doll.ready(),q.control.ready()]);q.time=0;},id);
 for(const emotion of ['five-right','five-left','cheer',...(process.env.MOTION_INCLUDE_CHIN==='1'?['chin']:[])]){
  for(let frame=0;frame<=60;frame++){
   const result=await page.evaluate(async({id,emotion,frame})=>{const q=QA,pose={emotion,progress:frame/60};
    if(frame===18){const dims=Object.fromEntries(q.catalog.dims.map(d=>[d.key,d.max]));q.doll.setLook({dims});await q.doll.ready();q.doll.setLook({dims:q.dims});await q.doll.ready();}
    if(frame===30){q.doll.setLook({outfit:id==='linen'?'cardigan':'linen'});await q.doll.ready();q.doll.setLook({outfit:id});await q.doll.ready();}
    q.time+=1/30;for(const d of [q.doll,q.control])d.animate(q.time,pose);
    const a=q.doll.inspectMotion(),b=q.control.inspectMotion(),pa=new q.T.Vector3(),pb=new q.T.Vector3();let maxDelta=0,maxRadius=0,boneDelta=0;
    if(!a.outfits.length||a.outfits.length!==b.outfits.length||[...a.outfits,...b.outfits].some(m=>m.userData.outfit!==id))throw Error('Wrong compared outfit '+id);
    for(const [m,n]of [[a.body,b.body],...a.outfits.map((m,i)=>[m,b.outfits[i]])]){
     if(m.name!==n.name||m.geometry.attributes.position.count!==n.geometry.attributes.position.count)throw Error('Mismatched mesh');m.skeleton.update();n.skeleton.update();
     const stride=[0,18,19,30,31,60].includes(frame)?1:13;
     for(let i=0;i<m.geometry.attributes.position.count;i+=stride){m.getVertexPosition(i,pa);n.getVertexPosition(i,pb);if(!Number.isFinite(pa.lengthSq()+pb.lengthSq()))throw Error('Nonfinite geometry');maxDelta=Math.max(maxDelta,pa.distanceTo(pb));maxRadius=Math.max(maxRadius,pa.length());}
    }
    for(let i=0;i<a.body.skeleton.bones.length;i++){const x=a.body.skeleton.bones[i],y=b.body.skeleton.bones[i];boneDelta=Math.max(boneDelta,x.position.distanceTo(y.position),1-Math.abs(x.quaternion.dot(y.quaternion)));}
    if(maxRadius>3)throw Error('Exploded geometry');q.renderer.render(q.scene,q.cam);return {maxDelta,maxRadius,boneDelta,bindingGeneration:a.bindingGeneration};
   },{id,emotion,frame});reports.push({id,emotion,frame,...result});
   if([6,18,30,54].includes(frame))await page.screenshot({path:path.join(OUT,id+'-'+emotion+'-'+frame+'.png')});
  }
  console.log(id,emotion,'max delta',Math.max(...reports.filter(r=>r.id===id&&r.emotion===emotion).map(r=>r.maxDelta)));
 }
 fs.writeFileSync(path.join(OUT,'transitions.json'),JSON.stringify(reports));
}
const failed=reports.filter(r=>r.maxDelta>2e-6);if(failed.length)throw Error('Transition changed geometry compared with unchanged actor: '+JSON.stringify(failed.slice(0,3)));
}

async function checkPhoneContact(page){
 const catalog=await page.evaluate(()=>QA.catalog),reports=[],timeline=[];
 const dimensions=[['base',{height:1,shoulder:.92,waist:1,flare:1,build:1,head:1}],['minimum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]))],['maximum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]];
 await page.evaluate(async()=>{
  QA.phoneDuration=(await import('../companion/motion.mjs')).DUR['emotion-phone'];
  if(!Number.isFinite(QA.phoneDuration)||QA.phoneDuration<=0)throw Error('Missing registered phone duration');
  QA.measurePhoneContact=()=>{
   const q=QA,c=q.doll.inspectMotion(),m=c.body,g=m.geometry,ids=g.index.array,R=c.dimensionCanonicalRest,screen=q.doll.root.getObjectByName('PhoneScreen'),target=screen.localToWorld(new q.T.Vector3(0,.02,0)),normal=new q.T.Vector3(0,0,1).transformDirection(screen.matrixWorld),v=new q.T.Vector3(),tri=new q.T.Triangle(),cache=new Map();
   if(q.doll.root.getObjectByName('CompanionHand-right-point')?.visible)throw Error('Phone replaced native hand');
   const u=m.userData.skinCoverageUniforms;if(!u||u.rightHand.value!==0||u.leftHand.value!==0)throw Error('Phone clipped native palm');
   function point(i){if(!cache.has(i))cache.set(i,m.localToWorld(m.getVertexPosition(i,new q.T.Vector3())));return cache.get(i)}
   let distance=Infinity,closest;
   for(let j=0;j<ids.length;j+=3){const is=[ids[j],ids[j+1],ids[j+2]];if(!is.every(i=>g.attributes.skinRightForearmInfluence.getX(i)>.9&&R[i*3+1]<.46))continue;tri.set(...is.map(point));tri.closestPointToPoint(target,v);const d=v.distanceTo(target);if(d<distance){distance=d;closest=v.clone();}}
   return {distance,signedDepth:closest.clone().sub(target).dot(normal),target:target.toArray(),closest:closest.toArray(),nativeHands:true};
  };
 });
 for(const id of Object.keys(catalog.outfits))for(const [dimension,dims]of dimensions){
  const row=await page.evaluate(async({id,dims})=>{const q=QA;q.doll.setLook({outfit:id,dims});await q.doll.ready();for(let j=0;j<30;j++)q.doll.animate(q.time+=.1,{emotion:'phone',progress:.5});const c=q.doll.inspectMotion();if(!c.outfits.length||c.outfits.some(o=>o.userData.outfit!==id))throw Error('Wrong outfit '+id);q.renderer.render(q.scene,q.cam);return q.measurePhoneContact();},{id,dims});reports.push({id,dimension,...row});
  if(dimension==='base'||id==='linen')await page.screenshot({path:path.join(OUT,id+'-'+dimension+'-phone.png')});console.log(id,dimension,row.distance);fs.writeFileSync(path.join(OUT,'contacts.json'),JSON.stringify(reports));
 }
 if(reports.some(r=>!Number.isFinite(r.distance)||r.distance>.003))throw Error('Native hand misses the phone surface');
 const frames=await page.evaluate(()=>Math.ceil(QA.phoneDuration*30));
 for(const [dimension,dims]of dimensions){
  await page.evaluate(async dims=>{const q=QA;q.doll.setLook({outfit:'linen',dims});await q.doll.ready();for(let j=0;j<20;j++)q.doll.animate(q.time+=.1,{emotion:'poke',progress:.5});},dims);
  for(let frame=0;frame<=frames;frame++){
   const progress=frame/frames,row=await page.evaluate(async progress=>{const q=QA;const {emotionPose}=await import('../fairy-garden/emotion-pose.mjs');q.doll.animate(q.time+=1/30,{emotion:'phone',progress});const pose=emotionPose('phone',progress);q.renderer.render(q.scene,q.cam);return pose.phone>.95?{...q.measurePhoneContact(),tap:pose.phoneTap,progress}:null;},progress);
   if(row)timeline.push({dimension,frame,...row});if([Math.round(frames*.3889),Math.round(frames*.5),Math.round(frames*.6111)].includes(frame))await page.screenshot({path:path.join(OUT,'timeline-'+dimension+'-'+frame+'.png')});
  }
  await page.evaluate(()=>{const q=QA;for(let j=0;j<30;j++)q.doll.animate(q.time+=.1,{});if(q.doll.root.userData.phoneContactError!==null)throw Error('Phone contact state survived release');if(q.doll.root.getObjectByName('CompanionPhone').visible)throw Error('Phone prop survived release');});
 }
 fs.writeFileSync(path.join(OUT,'timeline.json'),JSON.stringify(timeline));
 const taps=timeline.filter(r=>r.tap>.95&&r.progress>.3&&r.progress<.7);if(!taps.length||taps.some(r=>r.distance>.006))throw Error('Moving native palm misses screen at tap');
 console.log('Native phone contacts passed',reports.length,'settled poses;',timeline.length,'trajectory samples; peak tap distance',Math.max(...taps.map(r=>r.distance)));
}

async function checkCollarStrap(page){
 const report=[],catalog=await page.evaluate(()=>QA.catalog),dimensions=[['base',{height:1,shoulder:.92,waist:1,flare:1,build:1,head:1}],['minimum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]))],['maximum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]];
 for(const id of ['garden','ranger'].filter(id=>!process.env.MOTION_OUTFITS||process.env.MOTION_OUTFITS.split(',').includes(id)))for(const [dimension,dims]of dimensions)for(const pose of ['rest','five-left','five-right','cheer']){
  await page.evaluate(async({id,dims,pose})=>{const q=QA;q.doll.setLook({outfit:id,dims,outfitColors:{}});await q.doll.ready();q.cam.left=-.32;q.cam.right=.32;q.cam.top=.4;q.cam.bottom=-.4;q.cam.position.set(0,.62,5);q.cam.lookAt(0,.62,0);q.cam.updateProjectionMatrix();q.time=0;for(let i=0;i<12;i++)q.doll.animate(q.time+=.1,pose==='rest'?{}:{emotion:pose,progress:.5});const c=q.doll.inspectMotion(),p=new q.T.Vector3();if(!c.outfits.length||c.outfits.some(m=>m.userData.outfit!==id))throw Error('Wrong outfit');for(const m of [c.body,...c.outfits])for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p);if(!Number.isFinite(p.lengthSq())||p.length()>3)throw Error('Invalid outfit geometry');}},{id,dims,pose});
  for(const [view,angle]of [['front',0],['left',Math.PI/2],['right',-Math.PI/2],['back',Math.PI]]){
   const pixel=await page.evaluate(({angle,id,check})=>{const q=QA;q.doll.root.rotation.y=angle;q.renderer.render(q.scene,q.cam);if(!check)return null;const gl=q.renderer.getContext(),values=[];let x=320,y=229;if(id==='ranger'){const m=q.doll.inspectMotion().outfits.find(m=>m.name==='outfit_ranger_back_strap'),a=m.geometry.attributes.position,center=new q.T.Vector3(),point=new q.T.Vector3();let count=0;for(let i=0;i<a.count;i++)if(a.getY(i)>.665&&Math.abs(a.getZ(i))<.008){center.add(m.localToWorld(m.getVertexPosition(i,point)));count++;}if(!count)throw Error('Missing shoulder band samples');center.divideScalar(count).project(q.cam);x=Math.round((center.x*.5+.5)*640);y=Math.round((.5-center.y*.5)*800);}for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const p=new Uint8Array(4);gl.readPixels(x+dx,799-y-dy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);values.push([...p]);}return {at:[x,y],values};},{angle,id,check:dimension==='base'&&pose==='rest'&&view==='left'});
   await page.screenshot({path:path.join(OUT,[id,dimension,pose,view].join('-')+'.png')});
   if(pixel){if(id==='garden'&&pixel.values.some(([r,g,b])=>r-g>12||b<170))throw Error('Skin still protrudes through collar: '+JSON.stringify(pixel));if(id==='ranger'&&pixel.values.every(([r,g,b])=>Math.max(r,g,b)>100))throw Error('Shoulder strap is still hidden: '+JSON.stringify(pixel));}
   report.push({id,dimension,pose,view,pixel});
  }
 }
 // Different cloth and leather dyes must remain independent after the asset edit.
 for(const [id,colors]of [['garden',{cloth:'#477f86',trim:'#9ed87d'}],['ranger',{cloth:'#b76673',accent:'#4c7998'}]]){
  await page.evaluate(async({id,colors})=>{const q=QA;q.doll.setLook({outfit:id,dims:q.dims,outfitColors:colors});await q.doll.ready();for(let i=0;i<12;i++)q.doll.animate(q.time+=.1,{});q.doll.root.rotation.y=Math.PI/2;q.renderer.render(q.scene,q.cam);},{id,colors});await page.screenshot({path:path.join(OUT,id+'-dyed.png')});
 }
 fs.writeFileSync(path.join(OUT,'collar-strap.json'),JSON.stringify(report,null,2));console.log('Collar and strap passed',report.length,'views; two independent dye looks');
}

// Close views of the user-reported underarm slab, including partial single lifts.
async function checkCardiganSeam(page){
 const modified=JSON.parse(fs.readFileSync(path.join(__dirname,'../../test/fixtures/cardigan-armholes.json'),'utf8')).modifiedVertices;
 const catalog=await page.evaluate(()=>QA.catalog),reports=[];
 const dimensions=[['base',{height:1,shoulder:.92,waist:1,flare:1,build:1,head:1}],['minimum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]))],['maximum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]];
 for(const [dimName,dims]of dimensions){
  await page.evaluate(async({dims,modified})=>{const q=QA;q.doll.setLook({outfit:'cardigan',dims,outfitColors:{cloth:'#9dceb9',bottom:'#83bc21',boots:'#e657d4'}});await q.doll.ready();const c=q.doll.inspectMotion(),m=c.outfits[0];if(m.userData.outfit!=='cardigan'||m.userData.armholeSurfaceVersion!==2)throw Error('Wrong cardigan revision');const indices=m.geometry.index.array,changed=new Set(modified);q.seamFaces=[];for(let k=0;k<indices.length;k+=3){const f=Array.from(indices.slice(k,k+3));if(f.some(i=>changed.has(i)))q.seamFaces.push(f);}q.cam.left=-.4;q.cam.right=.4;q.cam.top=.5;q.cam.bottom=-.5;q.cam.position.set(0,.6,5);q.cam.lookAt(0,.6,0);q.cam.updateProjectionMatrix();},{dims,modified});
  for(const pose of ['rest','five-left','five-right','cheer'])for(const progress of pose==='rest'?[0]:[.2,.35,.5,.75]){
   const report=await page.evaluate(({pose,progress})=>{const q=QA;for(let i=0;i<12;i++)q.doll.animate(q.time+=.1,pose==='rest'?{}:{emotion:pose,progress});const c=q.doll.inspectMotion(),m=c.outfits[0],points=Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new q.T.Vector3()));let minimumArea=Infinity;for(const [a,b,d]of q.seamFaces){const area=new q.T.Vector3().subVectors(points[b],points[a]).cross(new q.T.Vector3().subVectors(points[d],points[a])).length();minimumArea=Math.min(minimumArea,area);}if(minimumArea<1e-12)throw Error('Collapsed underarm face');if(points.some(p=>!Number.isFinite(p.lengthSq())||p.length()>3))throw Error('Invalid cardigan geometry');return {minimumArea,triangles:q.seamFaces.length,feature:c.poseCurveCurrent.feature};},{pose,progress});
   for(const [view,angle]of [['front',0],['oblique',.65],['back',Math.PI]]){await page.evaluate(angle=>{QA.doll.root.rotation.y=angle;QA.renderer.render(QA.scene,QA.cam)},angle);await page.screenshot({path:path.join(OUT,[dimName,pose,progress,view].join('-')+'.png')});}
   reports.push({dimName,pose,progress,...report});
  }
  console.log('cardigan seam',dimName);
 }
 fs.writeFileSync(path.join(OUT,'cardigan-seam.json'),JSON.stringify(reports,null,2));
}

async function checkThinking(page){
 const catalog=await page.evaluate(()=>QA.catalog),reports=[];
 const dimensions=[['base',{height:1,shoulder:.92,waist:1,flare:1,build:1,head:1}],['minimum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]))],['maximum',Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]];
 for(const id of Object.keys(catalog.outfits).filter(id=>!process.env.MOTION_OUTFITS||process.env.MOTION_OUTFITS.split(',').includes(id)))for(const [dimName,dims]of dimensions){
  await page.evaluate(async({id,dims})=>{const q=QA;q.doll.setLook({outfit:id,dims});await q.doll.ready();q.doll.root.rotation.y=0;q.cam.left=-.4;q.cam.right=.4;q.cam.top=.5;q.cam.bottom=-.5;q.cam.position.set(0,.6,5);q.cam.lookAt(0,.6,0);q.cam.updateProjectionMatrix();const c=q.doll.inspectMotion(),f=c.rigFit[1],S=new q.T.Vector3(...f.shoulder),axis=new q.T.Vector3(...f.wrist).sub(S).normalize(),a=c.body.geometry.attributes,ids=[];for(let i=0;i<a.position.count;i++){const p=new q.T.Vector3().fromArray(c.dimensionRest,i*3);let own=0;for(let k=0;k<4;k++)if(c.body.skeleton.bones[a.skinIndex.getComponent(i,k)]?.name==='rightForearm')own+=a.skinWeight.getComponent(i,k);if(own>.9&&p.sub(S).dot(axis)>.24)ids.push(i);}q.handIds=ids.filter((_,i)=>i%4===0);if(q.handIds.length<20)throw Error('Missing hand material probes');},{id,dims});
  const poses=[['rest',0],['chin',.15],['chin',.5],['chin',.85],['rest-return',1],...(id==='tee'?[['five-left',.35],['five-left',.5],['five-right',.35],['five-right',.5],['cheer',.5]]:[])];
  for(const [pose,progress]of poses){
   const row=await page.evaluate(({pose,progress})=>{const q=QA;q.doll.root.rotation.y=0;for(let j=0;j<16;j++)q.doll.animate(q.time+=.1,pose.startsWith('rest')?{}:{emotion:pose,progress});const c=q.doll.inspectMotion(),T=q.T,p=new T.Vector3();q.doll.root.updateMatrixWorld(true);const s=c.body.skeleton.bones.find(b=>b.name==='rightArm'),e=c.body.skeleton.bones.find(b=>b.name==='rightForearm'),h=q.doll.root.getObjectByName('Right_hand'),local=o=>c.body.worldToLocal(o.getWorldPosition(new T.Vector3())),S=local(s),E=local(e),H=local(h),fit=c.rigFit[1],a=new T.Vector3(...fit.shoulder).distanceTo(new T.Vector3(...fit.elbow)),b=new T.Vector3(...fit.elbow).distanceTo(new T.Vector3(...fit.wrist)),error=Math.max(Math.abs(S.distanceTo(E)-a),Math.abs(E.distanceTo(H)-b));if(error>1e-6)throw Error('Arm bone length changed '+error);
   if(pose==='chin'&&progress===.5&&(E.y-S.y)/a<0)throw Error('Thinking elbow stayed below the shoulder');
   const rest=q.handIds.map(i=>new T.Vector3().fromArray(c.dimensionRest,i*3)),posed=q.handIds.map(i=>c.body.getVertexPosition(i,new T.Vector3()));let rd=0,pd=0;for(let i=0;i<rest.length;i++)for(let j=0;j<i;j++){rd=Math.max(rd,rest[i].distanceTo(rest[j]));pd=Math.max(pd,posed[i].distanceTo(posed[j]));}
   if(pd/rd>1.025)throw Error('Thinking hand material elongated');
   let max=0,minArea=Infinity,maxEdge=0;for(const m of [c.body,...c.outfits]){m.skeleton.update();const points=[];for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,p);if(!Number.isFinite(p.lengthSq()))throw Error('Invalid geometry');max=Math.max(max,p.length());if(m.userData.sewnArmholeVersion)points.push(p.clone());}if(points.length){const index=m.geometry.index.array;for(let i=0;i<index.length;i+=3){const [a,b,d]=[points[index[i]],points[index[i+1]],points[index[i+2]]];minArea=Math.min(minArea,new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(d,a)).length());maxEdge=Math.max(maxEdge,a.distanceTo(b),b.distanceTo(d),d.distanceTo(a));}}}if(max>3||minArea<1e-12||maxEdge>.15)throw Error('Collapsed or exploded garment');return {boneLengthError:error,elbowRise:(E.y-S.y)/a,handDiameterRatio:pd/rd,handDiameter:pd,restHandDiameter:rd,minArea:Number.isFinite(minArea)?minArea:null,maxEdge,max};},{pose,progress});
   reports.push({id,dimName,pose,progress,...row});
   for(const [view,angle]of [['front',0],['oblique',.65],['side',Math.PI/2]]){await page.evaluate(angle=>{QA.doll.root.rotation.y=angle;QA.renderer.render(QA.scene,QA.cam)},angle);await page.screenshot({path:path.join(OUT,[id,dimName,pose,progress,view].join('-')+'.png')});}
  }
  if(process.env.MOTION_THINKING_TIMELINE==='1'&&id==='tee'){
   const duration=await page.evaluate(async()=>{QA.doll.root.rotation.y=0;for(let i=0;i<24;i++)QA.doll.animate(QA.time+=.1,{});return (await import('../companion/motion.mjs')).DUR['emotion-chin'];});
   if(!(duration>0))throw Error('Missing real thinking duration');const frames=Math.ceil(duration*30),timeline=[];
   for(let frame=0;frame<=frames;frame++){
    const sample=await page.evaluate(({frame,frames})=>{const q=QA;q.doll.animate(q.time+=1/30,{emotion:'chin',progress:frame/frames});const c=q.doll.inspectMotion(),T=q.T,p=q.handIds.map(i=>c.body.getVertexPosition(i,new T.Vector3())),rest=q.handIds.map(i=>new T.Vector3().fromArray(c.dimensionRest,i*3));let diameter=0,original=0;for(let i=0;i<p.length;i++)for(let j=0;j<i;j++){diameter=Math.max(diameter,p[i].distanceTo(p[j]));original=Math.max(original,rest[i].distanceTo(rest[j]));}const hand=q.doll.root.worldToLocal(q.doll.handPoint('right')).toArray();if(diameter/original>1.025)throw Error('Hand stretched during thinking');return {ratio:diameter/original,hand};},{frame,frames});
    if(timeline.length){const old=timeline.at(-1).hand,jump=Math.hypot(...sample.hand.map((v,i)=>v-old[i]));if(jump>.02){fs.writeFileSync(path.join(OUT,'thinking-jump.json'),JSON.stringify({id,dimName,frame,previous:timeline.at(-1),sample}));throw Error('Thinking arm jumps '+jump+' at '+frame);}sample.jump=jump;}timeline.push({frame,...sample});
   }
   fs.writeFileSync(path.join(OUT,'thinking-timeline-'+dimName+'.json'),JSON.stringify(timeline));
  }
  fs.writeFileSync(path.join(OUT,'thinking.json'),JSON.stringify(reports,null,2));console.log('thinking',id,dimName);
 }
}
