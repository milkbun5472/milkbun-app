/* Real Draco/Three.js coverage regression. Optional MODEL selects a baseline GLB. */
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/lisa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:900,height:700}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.route('**/pet.mjs*',r=>r.fulfill({body:''}));
  if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));
  await page.goto(process.env.FOOTWEAR_URL||'http://127.0.0.1:18926/apps/companion/');
  const report=await page.evaluate(async()=>{
   const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler}=await import('../fairy-garden/traveler.mjs');
   const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
   const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;
   const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#bbb',2.3));
   const light=new T.DirectionalLight('#fff',1.5);light.castShadow=true;light.position.set(2,3,4);scene.add(light);
   const doll=createTraveler(source,false,{outfit:'cardigan',hair:'curtains'});scene.add(doll.root);
   const body=doll.root.getObjectByName('DollBody'),shoes=doll.root.getObjectByName('outfit_cardigan_footwear');
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.shadowMap.enabled=true;renderer.setSize(900,700);document.body.append(renderer.domElement);
   const camera=new T.OrthographicCamera(-.38,.38,.28,-.28,.1,10);camera.position.set(0,.35,2);camera.lookAt(0,.13,0);
   const target=new T.WebGLRenderTarget(360,280),pixels=new Uint8Array(360*280*4),map=body.material.map,color=body.material.color.clone();
   const originalGeometry=body.geometry,footGeometry=originalGeometry.clone(),footIndices=[];
   for(let i=0;i<originalGeometry.index.count;i+=3){const ids=[0,1,2].map(k=>originalGeometry.index.getX(i+k));if(ids.every(j=>originalGeometry.attributes.position.getY(j)<.095))footIndices.push(...ids);}
   footGeometry.setIndex(footIndices);body.geometry=footGeometry;
   const dims=[{}, {height:.85,shoulder:.85,waist:.85,flare:.78,build:.85,head:.88}, {height:1.25,shoulder:1.2,waist:1.15,flare:1.22,build:1.15,head:1.1}, {height:.85,build:1.15,flare:1.22}, {height:1.25,build:.85,flare:.78}];
   const samples=[];let clock=0;
   const frame=(angle=0)=>{doll.root.rotation.y=angle;scene.updateMatrixWorld(true);doll.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    const box=shoes?new T.Box3().setFromObject(shoes,true):new T.Box3(new T.Vector3(-.3,0,-.2),new T.Vector3(.3,.18,.2));
    const c=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),halfW=Math.max(.26,size.x*.58+.02),halfH=Math.max(size.y*.58+.015,halfW*280/360);
    camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.position.copy(c).add(new T.Vector3(0,.08,2));camera.lookAt(c);camera.updateProjectionMatrix();
   };
   for(let di=0;di<dims.length;di++)for(const pose of ['rest','walk','sit','wave'])for(const time of [.2,.7,1.2]){
    doll.setLook({outfit:'cardigan',dims:dims[di]});
    for(let i=0;i<25;i++){clock+=.05;doll.animate(clock,{gesture:pose==='walk'?'rest':pose,moving:pose==='walk',seated:pose==='sit',progress:time%1,height:0});}
    body.material.map=null;body.material.color.set('#ff0000');body.material.needsUpdate=true;
    for(const angle of [0,1.2,Math.PI]){frame(angle);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,360,280,pixels);let red=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i]>100&&pixels[i]>pixels[i+1]*3&&pixels[i]>pixels[i+2]*3)red++;
     samples.push({di,pose,time,angle,red});
    }
   }
   renderer.setRenderTarget(null);body.geometry=originalGeometry;footGeometry.dispose();body.material.map=map;body.material.color.copy(color);body.material.needsUpdate=true;
   const coverage=body.userData.coveredFeet?.value;
   const other=createTraveler(source,false,{outfit:'academy'}),otherBody=other.root.getObjectByName('DollBody');
   const isolated=otherBody.userData.coveredFeet?.value===-1&&body.userData.coveredFeet?.value===coverage;
   doll.setLook({outfit:'academy'});const off=body.userData.coveredFeet?.value===-1;
   doll.setLook({outfit:'cardigan',dims:{height:1,shoulder:1,waist:1,flare:1,build:1,head:1}});
   const restored=body.userData.coveredFeet?.value===coverage;
   for(let i=0;i<30;i++){clock+=.1;doll.animate(clock,{gesture:'rest',height:0});}
   frame(.35);renderer.render(scene,camera);
   window.footwearStudy={doll,scene,renderer,camera,frame,clock,body};
   draco.dispose();target.dispose();
   return {hasFootwear:!!shoes,coverage,isolated,off,restored,samples,maxRed:Math.max(...samples.map(x=>x.red)),totalRed:samples.reduce((a,x)=>a+x.red,0)};
  });
  const prefix=process.env.FOOTWEAR_OUT||'/tmp/footwear';
  await page.locator('canvas').last().screenshot({path:prefix+'-front.png'});
  await page.evaluate(()=>{const s=footwearStudy;s.frame(Math.PI);s.renderer.render(s.scene,s.camera);});
  await page.locator('canvas').last().screenshot({path:prefix+'-back.png'});
  await page.evaluate(()=>{const s=footwearStudy;s.frame(1.2);s.renderer.render(s.scene,s.camera);});
  await page.locator('canvas').last().screenshot({path:prefix+'-side.png'});
  for(const pose of ['walk','sit']){
   await page.evaluate(pose=>{const s=footwearStudy;s.doll.setLook({dims:{height:1.25,shoulder:1.2,waist:1.15,flare:1.22,build:1.15,head:1.1}});for(let i=0;i<35;i++){s.clock+=.05;s.doll.animate(s.clock,{gesture:pose==='walk'?'rest':pose,moving:pose==='walk',seated:pose==='sit',height:0});}s.frame(.6);s.renderer.render(s.scene,s.camera);},pose);
   await page.locator('canvas').last().screenshot({path:prefix+'-'+pose+'.png'});
  }
  report.errors=errors;fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({hasFootwear:report.hasFootwear,coverage:report.coverage,maxRed:report.maxRed,totalRed:report.totalRed,isolated:report.isolated,off:report.off,restored:report.restored,samples:report.samples.length,errors}));
  if(!process.env.BASELINE&&(!report.hasFootwear||!report.isolated||!report.off||!report.restored||report.maxRed>0||errors.length))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
