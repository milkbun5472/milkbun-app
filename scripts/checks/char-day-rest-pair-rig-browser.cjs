// Real doll, both bodies, clothing and actual furniture. No mocked hand targets.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DAY_URL||'http://127.0.0.1:18994',engine=process.env.DAY_ENGINE||'chromium',out=process.env.DAY_EVIDENCE||'/tmp/day-rest-rig';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await pw[engine].launch({headless:true,...(engine==='webkit'?{}:{channel:'chrome'})});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
 const result=await page.evaluate(async opts=>{
  const {build}=await(await fetch('../fairy-garden/build.json')).json(),load=n=>import('../fairy-garden/'+n+'?v='+build),T=await import('three'),{GLTFLoader}=await load('vendor/GLTFLoader.js'),{DRACOLoader}=await load('vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await load('traveler.mjs'),{createTogether}=await load('day/together.mjs'),{buildSpace}=await load('day/spaces.mjs'),{createSpaceView}=await load('day/space-view.mjs'),{furniturePoint,furnitureSeat}=await load('day/home-catalog.mjs'),{MAPS,segmentClear}=await load('world.mjs'),{PAIR_STYLES}=await load('day/motion-profile.mjs'),{pairSize}=await load('day/pair-pose.mjs'),{disposeMap}=await load('map-loader.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;await preloadOutfits();const catalog=await(await fetch('../fairy-garden/doll.json')).json(),a=createTraveler(source,true),b=createTraveler(source),scene=new T.Scene();scene.add(a.root,b.root);
  const low=Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),high=Object.fromEntries(catalog.dims.map(d=>[d.key,d.max])),variants=[[{},{}],[low,low],[high,high],[low,high],[high,low]],kinds=Object.keys(CharDaySocial.rest).filter(k=>!opts.kinds||opts.kinds.includes(k)),report={cases:[],failures:[],frames:0};let time=0;
  const renderer=new T.WebGLRenderer({antialias:true}),camera=new T.OrthographicCamera(-2,2,4,-4,.1,70);renderer.setSize(390,780);scene.background=new T.Color('#e3e8df');scene.add(new T.HemisphereLight('#fff4dd','#958267',2.2));const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(3,8,4);scene.add(sun);
  const point=(d,n)=>d.root.getObjectByName(n).getWorldPosition(new T.Vector3());
  for(const outfit of Object.keys(catalog.outfits).filter(o=>!opts.outfit||o===opts.outfit))for(let v=0;v<variants.length;v++){if(opts.variant!=null&&v!==opts.variant)continue;
   a.setLook({outfit,hair:'korean',dims:variants[v][0]},true);b.setLook({outfit,hair:'bob',dims:variants[v][1]},true);await Promise.all([a.ready(),b.ready()]);
   for(const initiator of ['a','b'])for(const kind of kinds){
    const stored=Object.fromEntries(buildSpace('dayHome').furniture.filter(p=>!['sofa','double-bed'].includes(p.id)).map(p=>[p.id,{stored:true}])),heading=(v+kinds.indexOf(kind))%4*Math.PI/2,map=MAPS.dayHome=buildSpace('dayHome',{...stored,sofa:{x:2,z:2,heading},'double-bed':{x:-3,z:-2,heading}}),p=map.furniture.find(p=>p.id===(kind.startsWith('lie')?'double-bed':'sofa'));
    const origin={a:{x:0,z:3.3},b:{x:0,z:4.8}};if(kind.startsWith('sit')){const at=furniturePoint(p,{x:p.w/2+.6,z:.25});origin.a={...at,seat:furnitureSeat(p,at,{x:.4})};}
    for(const [who,d]of [['a',a],['b',b]]){const at=origin[who],seat=at.seat;d.root.position.set((seat||at).x,0,(seat||at).z);d.root.rotation.y=seat?.heading||0;for(let n=0;n<80;n++)d.animate(time+=.025,{seated:!!seat,seatPose:seat?.pose,height:.08+(seat?seat.rise+.05:0)});}
    let stopped;const style=Object.values(PAIR_STYLES)[v%4],ctl=createTogether({a,b,map:()=>map,from:()=>origin,pair:()=>({a:style,b:style}),onStop:s=>stopped=s}),row={kind,initiator,outfit,variant:v,heading,frames:0,maxHandError:0,minHeadGap:Infinity,minimumHeadGap:(pairSize(a).radius+pairSize(b).radius)*.9,maxSeatDrift:0,maxStep:0,finite:true};
    const start=ctl.start(kind,{initiator});if(!start.ok){report.failures.push({...row,reason:start.reason});continue;}let prev=ctl.inspect();
    for(let f=0;f<3000&&ctl.inspect()?.phase!=='active';f++){
     ctl.tick(.025,time+=.025);report.frames++;const q=ctl.inspect();if(!q)break;
     for(const who of ['a','b'])if(!segmentClear(prev[who],q[who],'dayHome'))row.path=false;prev=q;
     if(kind.startsWith('sit')){if(!a.root.userData.posture||Math.abs(a.root.getObjectByName('leftLeg').rotation.x)<.5)row.stood=true;const expected=origin.a.seat;row.maxSeatDrift=Math.max(row.maxSeatDrift,Math.hypot(a.root.position.x-expected.x,a.root.position.z-expected.z));}
    }
    if(ctl.inspect()?.phase!=='active'){report.failures.push({...row,reason:'never active',stopped});ctl.dispose();continue;}
    let prior=[a.root.position.clone(),b.root.position.clone()];
    for(let f=0;f<320;f++){ctl.tick(.025,time+=.025);report.frames++;const s=ctl.inspect();if(!s)break;const q=s.intimate;for(const d of [a,b])for(const n of ['body','HeadAnchor','leftArm','rightArm','leftForearm','rightForearm','Left_hand','Right_hand'])if(!d.root.getObjectByName(n).matrixWorld.elements.every(Number.isFinite))row.finite=false;
     const current=[a.root.position.clone(),b.root.position.clone()];if(f<150){prior=current;continue;}row.frames++;for(const c of q?.contacts||[])row.maxHandError=Math.max(row.maxHandError,c.error);row.minHeadGap=Math.min(row.minHeadGap,point(a,'HeadAnchor').distanceTo(point(b,'HeadAnchor')));
     [a,b].forEach((d,i)=>{row.maxStep=Math.max(row.maxStep,d.root.position.distanceTo(prior[i]));prior[i]=d.root.position.clone();});
     if(kind.startsWith('lie')&&[a,b].some(d=>d.root.userData.posture!=='lying'||Math.abs(d.root.getObjectByName('TravelerVisual').rotation.x+Math.PI/2)>.001))row.lying=false;
    }
    row.ok=!!ctl.inspect()&&row.frames>0&&row.finite&&row.path!==false&&row.stood!==true&&row.lying!==false&&row.maxHandError<.13&&row.minHeadGap>row.minimumHeadGap&&row.maxSeatDrift<.005&&row.maxStep<.01;
    if(opts.shots&&outfit===(opts.outfit||Object.keys(catalog.outfits)[0])&&v===(opts.variant??0)){
     const view=createSpaceView('dayHome','warm',{...map,furniture:[p],structure:[]},{furnitureOnly:true});scene.add(view.root);const center=furniturePoint(p,{x:0,z:0});camera.position.set(center.x+Math.sin(heading)*6+Math.cos(heading)*4,5,center.z+Math.cos(heading)*6-Math.sin(heading)*4);camera.lookAt(center.x,.7,center.z);camera.zoom=1.05;camera.updateProjectionMatrix();renderer.render(scene,camera);row.preview=renderer.domElement.toDataURL('image/png');view.root.removeFromParent();view.root.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});}
    if(!row.ok)report.failures.push({...row,state:ctl.inspect()});report.cases.push(row);ctl.dispose();for(const o of [...scene.children,...a.root.children].filter(o=>['TogetherSpoon','TogetherSnack','TogetherCup'].includes(o.name))){o.removeFromParent();disposeMap(o);}
   }
  }
  renderer.dispose();draco.dispose();return report;
 },{outfit:process.env.RIG_OUTFIT,variant:process.env.RIG_VARIANT==null?null:Number(process.env.RIG_VARIANT),shots:process.env.AUDIT_SHOTS==='1',kinds:process.env.DAY_KINDS?.split(',')});
 for(const row of result.cases)if(row.preview){fs.writeFileSync(path.join(out,row.kind+'-'+row.initiator+'-'+row.outfit+'.png'),Buffer.from(row.preview.split(',')[1],'base64'));delete row.preview;}
 for(const row of result.failures)delete row.preview;
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...result,errors,ok:!result.failures.length&&!errors.length},null,2));console.log(JSON.stringify({engine,cases:result.cases.length,frames:result.frames,failureCount:result.failures.length,failures:result.failures.slice(0,6)}));assert.deepEqual(errors,[]);assert.equal(result.failures.length,0);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
