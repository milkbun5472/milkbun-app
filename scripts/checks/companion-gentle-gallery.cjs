const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');const out=process.env.COMPANION_EVIDENCE||'/tmp/companion-gentle';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto((process.env.COMPANION_TEST_URL||'http://127.0.0.1:18939')+'/apps/companion/');
await page.evaluate(async()=>{
 const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs');
 const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;await preloadOutfits();
 const catalog=await(await fetch('../fairy-garden/doll.json')).json(),outfits=Object.keys(catalog.outfits),doll=createTraveler(source,true),neutral=createTraveler(source,true);await Promise.all([doll.ready(),neutral.ready()]);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1050);document.body.append(renderer.domElement);renderer.setScissorTest(true);const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const sun=new T.DirectionalLight('#fff',1.5);sun.position.set(1,3,3);scene.add(sun);scene.add(doll.root);
 const camera=new T.PerspectiveCamera(26,200/350,.05,20);camera.position.set(0,.68,3.5);camera.lookAt(0,.65,0);
 let time=0;window.gallery={T,doll,catalog,outfits,renderer,scene,camera,report:{frames:0,maxChinError:0,outfits},render:async name=>{
 document.querySelectorAll('.label').forEach(e=>e.remove());let i=0;
 for(const dims of [{},Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))])for(const outfit of outfits){
  doll.setLook({outfit,dims,hair:'bob',face:'cozy'});await doll.ready();
  for(let j=0;j<=40;j++){doll.animate(time+=.04,{emotion:name,progress:j/40,height:0});doll.root.updateWorldMatrix(true,true);window.gallery.report.frames++;doll.root.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('Nonfinite bone '+outfit);});}
  for(let j=0;j<30;j++)doll.animate(time+=.04,{emotion:name,progress:.42,height:0});doll.root.updateWorldMatrix(true,true);
  if(name==='chin'){const head=doll.root.getObjectByName('HeadAnchor'),hand=doll.root.getObjectByName('Right_hand');const error=hand.getWorldPosition(new T.Vector3()).distanceTo(head.localToWorld(new T.Vector3(0,-.47,.64)));window.gallery.report.maxChinError=Math.max(window.gallery.report.maxChinError,error);if(error>.025)throw Error('Hand misses chin '+outfit+' '+error);}
  const x=i%outfits.length*200,y=(2-Math.floor(i/outfits.length))*350;renderer.setViewport(x,y,200,350);renderer.setScissor(x,y,200,350);renderer.render(scene,camera);
  const label=document.createElement('div');label.className='label';label.textContent=(name==='chin'?'托腮陪你':'摸头回应')+' · '+outfit+' · '+['默认','最小体型','最大体型'][Math.floor(i/outfits.length)];label.style=`position:absolute;left:${x+6}px;top:${Math.floor(i/outfits.length)*350+5}px;color:#45382d;font:12px sans-serif`;document.body.append(label);i++;
  for(let j=0;j<50;j++)doll.animate(time+=.04,{height:0});neutral.setLook({outfit,dims,hair:'bob',face:'cozy'});await neutral.ready();neutral.animate(time,{height:0});
  const lower=doll.root.getObjectByName('rightForearm'),rest=neutral.root.getObjectByName('rightForearm');
  if(lower.quaternion.angleTo(rest.quaternion)>1e-6)throw Error('Elbow did not return to rest '+outfit);
 }
}};
});
for(const name of ['chin','headpat']){await page.evaluate(name=>gallery.render(name),name);await page.screenshot({path:out+'/'+name+'-outfits.png'});}const report=await page.evaluate(()=>gallery.report);assert.deepEqual(errors,[]);fs.writeFileSync(out+'/gallery.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
