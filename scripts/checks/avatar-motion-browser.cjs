const fs=require('node:fs'),path=require('node:path'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const OUT=process.env.MOTION_EVIDENCE||'/tmp/avatar-motion-review';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const engine=process.env.MOTION_BROWSER||'chromium',browser=await pw[engine].launch(engine==='webkit'?{headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}:{channel:'chrome',headless:true});try{const page=await browser.newPage({viewport:{width:640,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&!m.text().includes('GPU stall'))errors.push(m.text())});await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.endsWith('/pet.mjs'))return r.fulfill({body:'',contentType:'text/javascript'});if(u.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(u.protocol))return r.abort();return r.continue()});await page.goto((process.env.COMPANION_TEST_URL||'http://127.0.0.1:18979')+'/apps/companion/');
console.log('Loading');await page.evaluate(async()=>{const T=await import('three'),mod=await import('../fairy-garden/traveler.mjs');const source=await mod.loadTravelerSource(),scene=new T.Scene();scene.background=new T.Color('#f4f1eb');scene.add(new T.HemisphereLight('#ffffff','#aaa29a',2.3));const light=new T.DirectionalLight('#ffffff',1.5);light.position.set(-2,3,4);scene.add(light);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,800);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.replaceChildren(renderer.domElement);document.body.style.margin=0;const cam=new T.OrthographicCamera(-.64,.64,.8,-.8,.01,20);cam.position.set(0,.73,5);cam.lookAt(0,.7,0);const dims={height:1,shoulder:.92,waist:1,flare:1,build:1,head:1};const doll=mod.createTraveler(source,true,{outfit:'linen',hair:'korean',skin:'#f2cbb4',hairColor:'#292323',dims});scene.add(doll.root);await doll.ready();const catalog=await(await fetch('../fairy-garden/doll.json')).json();window.QA={T,mod,source,scene,renderer,cam,doll,dims,catalog,time:0};});console.log('Loaded');
if(process.env.MOTION_TRANSITIONS==='1')await checkTransitions(page);else{
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
 for(const emotion of ['five-right','five-left','cheer']){
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
