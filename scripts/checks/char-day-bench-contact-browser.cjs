// Ray-test the real clothed pelvis against the actual bench, including the
// training-base scene in Lisa's screenshot. No model-origin-only assertions.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DAY_URL||'http://127.0.0.1:18997',out=process.env.DAY_EVIDENCE||'/tmp/day-bench-contact',engine=process.env.DAY_ENGINE||'chromium';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await pw[engine].launch({headless:true,...(engine==='webkit'?{}:{channel:'chrome'})});try{
 const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(process.env.DAY_BASELINE_SHA){const exec=require('node:child_process').execFileSync;for(const file of ['traveler.mjs','seated-legs.mjs','day/home-catalog.mjs']){const body=exec('git',['show',process.env.DAY_BASELINE_SHA+':apps/fairy-garden/'+file],{encoding:'utf8'});await p.route('**/fairy-garden/'+file+'*',r=>r.fulfill({body,contentType:'text/javascript'}));}}
 await p.goto(base+'/apps/companion/');
 const report=await p.evaluate(async options=>{
  const {build}=await(await fetch('../fairy-garden/build.json')).json(),load=n=>import('../fairy-garden/'+n+'?v='+build),T=await import('three'),{createTraveler,loadTravelerSource,preloadOutfits}=await load('traveler.mjs'),{createRoomKit}=await load('day/places/room-kit.mjs'),{furnitureSeat}=await load('day/home-catalog.mjs'),{trainingMap,createTraining}=await load('day/places/training.mjs');
  await preloadOutfits();const catalog=await(await fetch('../fairy-garden/doll.json')).json(),actor=createTraveler(await loadTravelerSource(),true),low=Object.fromEntries(catalog.dims.map(p=>[p.key,p.min])),high=Object.fromEntries(catalog.dims.map(p=>[p.key,p.max])),variants=[{},low,high,{...low,height:high.height},{...high,height:low.height}],report={build,cases:[],failures:[],frames:0,shots:{}};let time=0;
  const up=new T.Vector3(0,1,0),down=up.clone().negate(),cast=new T.Raycaster(),point=new T.Vector3();
  for(const outfit of Object.keys(catalog.outfits).filter(o=>!options.outfit||o===options.outfit))for(const [variant,dims]of variants.entries())for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const gesture of ['rest','tea','read']){
   actor.setLook({outfit,hair:'korean',dims},true);await actor.ready();const piece={id:'bench',kind:'bench',x:0,z:0,w:3.4,d:.65,heading,seat:.45},seat=furnitureSeat(piece),kit=createRoomKit(),bench=kit.bench(piece);kit.root.updateMatrixWorld(true);actor.root.position.set(seat.x,0,seat.z);actor.root.rotation.y=heading;
   for(let i=0;i<100;i++){const task=gesture==='rest'?null:{kind:gesture==='tea'?'drink':'read',daily:true,progress:(time%5)/5,elapsed:time};actor.animate(time+=.04,{seated:true,seatPose:seat.pose,height:.58,gesture,task});report.frames++;}actor.root.updateMatrixWorld(true);
   const meshes=[],row={outfit,variant,heading,gesture,closestGap:Infinity,supported:0,shoePenetrations:0,finite:true};actor.root.traverse(m=>{let visible=true;for(let n=m;n;n=n.parent)visible&&=n.visible;if(visible&&m.isSkinnedMesh&&(m.userData.outfit||m.userData.skinBase)&&!m.userData.sleeveSide)meshes.push(m);});
   // Bake this measured frame once: every vertex comes from the real skin and
   // morphs. Re-skinning every triangle for every ray makes dense sampling slow.
   const posed=meshes.map(m=>{const geometry=new T.BufferGeometry(),positions=new Float32Array(m.geometry.attributes.position.count*3);for(let i=0;i<positions.length/3;i++){m.getVertexPosition(i,point);point.toArray(positions,i*3);}geometry.setAttribute('position',new T.BufferAttribute(positions,3));if(m.geometry.index)geometry.setIndex(m.geometry.index);const mesh=new T.Mesh(geometry,m.material);mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(m.matrixWorld);return mesh;});
   // An upward ray from a supported point hits the underside of the clothes or
   // body. A ray beyond the seat edge cannot count as support.
   for(const x of [-.10,-.08,-.06,-.04,0,.04,.06,.08,.10])for(const z of [-.12,-.08,-.04,-.03,-.022]){
    const q=actor.root.localToWorld(new T.Vector3(x,0,z));cast.set(new T.Vector3(q.x,1.5,q.z),down);cast.far=1.5;const support=cast.intersectObject(bench,true).find(h=>Math.abs(h.point.y-.53)<.004);if(!support)continue;
    cast.set(support.point.clone().addScaledVector(up,-.02),up);cast.far=.20;const hit=cast.intersectObjects(posed,false)[0];if(hit){row.closestGap=Math.min(row.closestGap,hit.point.y-support.point.y);row.supported++;}
   }
   // Real shoe vertices, rather than a broad character box, must clear the
   // plank's front edge. Integrated outfits also contain shoes in one mesh.
   const inverse=bench.matrixWorld.clone().invert();for(const m of meshes.filter(m=>m.userData.outfit)){const pos=m.geometry.attributes.position;for(let i=0;i<pos.count;i++){
    if(pos.getY(i)>.12)continue;m.localToWorld(m.getVertexPosition(i,point));point.applyMatrix4(inverse);
    if(point.y>.445&&point.y<.515&&Math.abs(point.x)<piece.w/2-.01&&Math.abs(point.z)<piece.d/2-.01)row.shoePenetrations++;
   }}
   row.contact=actor.root.userData.seatContact;row.finite=actor.root.matrixWorld.elements.every(Number.isFinite);row.ok=row.supported>0&&row.closestGap<.025&&row.closestGap>-.02&&row.shoePenetrations===0&&row.finite;
   if(!row.ok)report.failures.push(row);report.cases.push(row);bench.traverse(o=>o.geometry?.dispose());posed.forEach(m=>m.geometry.dispose());
   if(outfit==='jacket'&&variant===0&&heading===0&&gesture==='tea'&&options.shots){
    const scene=new T.Scene(),view=createTraining(),s=trainingMap.seats.water;actor.root.position.set(s.x,actor.root.position.y,s.z);scene.add(actor.root,view.root);scene.background=new T.Color('#e4e8df');scene.add(new T.HemisphereLight('#fff4dd','#958267',2.2));const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(3,8,4);scene.add(sun);const renderer=new T.WebGLRenderer({antialias:true}),camera=new T.OrthographicCamera(-1.475,1.475,2.125,-2.125,.1,40);renderer.setSize(590,850);
    for(const [name,offset]of Object.entries({side:[5,2.5,0],front:[3,5,4]})){camera.position.set(s.x+offset[0],offset[1],s.z+offset[2]);camera.lookAt(s.x,.6,s.z-.10);renderer.render(scene,camera);report.shots[name]=renderer.domElement.toDataURL('image/png');}renderer.dispose();view.root.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});actor.root.removeFromParent();
   }
  }
  return report;
 },{outfit:process.env.RIG_OUTFIT,shots:process.env.AUDIT_SHOTS==='1'});
 for(const [name,data]of Object.entries(report.shots))fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));delete report.shots;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...report,errors,ok:!report.failures.length&&!errors.length},null,2));console.log(JSON.stringify({cases:report.cases.length,frames:report.frames,failures:report.failures.length,examples:report.failures.slice(0,5),errors}));assert.deepEqual(errors,[]);assert.equal(report.failures.length,0);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
