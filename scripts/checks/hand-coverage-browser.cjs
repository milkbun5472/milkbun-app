// Render each dye separately and check both its intended area and neighbouring regions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-all-shoulder-gallery';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:3000,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(process.env.TRAVELER_MODULE_FILE)await page.route('**/traveler.mjs*',r=>r.fulfill({path:process.env.TRAVELER_MODULE_FILE,contentType:'text/javascript'}));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(process.env.PARTS_DIR)for(const id of ['academy','garden','ranger','cardigan','jacket','suit'])await page.route('**/outfits/'+id+'.glb*',r=>r.fulfill({path:process.env.PARTS_DIR+'/'+id+'.glb',contentType:'model/gltf-binary'}));
 if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));await page.goto(base+'/apps/companion/');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb').then(async g=>(await preloadOutfits(),g))).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
  const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(3000,1500);document.body.append(renderer.domElement);const camera=new T.OrthographicCamera(-.70,.70,.70,-.70,.1,20);
  window.strapQA={T,createTraveler,source,catalog,scene,renderer,camera,dolls:[]};
 });


 const report=await page.evaluate(()=>{
 const {T,createTraveler,source,scene,renderer,camera,catalog}=strapQA;renderer.setSize(800,800);camera.left=-.7;camera.right=.7;camera.top=.7;camera.bottom=-.7;camera.position.set(0,.65,6);camera.lookAt(0,.65,0);camera.updateProjectionMatrix();let checks=0,maxDifference=0,handVertices=0;
 for(const outfit of ['ranger','cardigan','jacket','tee'])for(const mode of ['default','min','max'])for(const gesture of ['rest','stretch','sit'])for(const angle of [0,1.57,3.14]){
 const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='default'?1:d[mode]]));const d=createTraveler(source,false,{outfit,dims});scene.add(d.root);for(let i=0;i<30;i++)d.animate(i*.1,{gesture,progress:.5,height:0,seated:gesture==='sit'});d.root.rotation.y=angle;scene.updateMatrixWorld(true);
 const body=d.root.getObjectByName('DollBody'),p=body.geometry.attributes.position,arm=body.geometry.attributes.skinArmInfluence,boxes=[{x:800,y:800,X:0,Y:0},{x:800,y:800,X:0,Y:0}];
 for(let i=0;i<p.count;i++)if(p.getY(i)<.39&&arm.getX(i)>.99){const v=body.getVertexPosition(i,new T.Vector3());body.localToWorld(v);v.project(camera);const x=(v.x*.5+.5)*800,y=(v.y*.5+.5)*800,b=boxes[p.getX(i)<0?0:1];b.x=Math.min(b.x,x);b.X=Math.max(b.X,x);b.y=Math.min(b.y,y);b.Y=Math.max(b.Y,y);handVertices++;}
 const gl=renderer.getContext(),capture=()=>{renderer.render(scene,camera);const px=new Uint8Array(800*800*4);gl.readPixels(0,0,800,800,gl.RGBA,gl.UNSIGNED_BYTE,px);return px;};
 const actual=capture(),feet=body.userData.skinCoverageUniforms.feet,previous=feet.value;feet.value=-1;const uncovered=capture();feet.value=previous;
 for(const b of boxes)for(let y=Math.max(0,Math.floor(b.y));y<Math.min(800,Math.ceil(b.Y));y++)for(let x=Math.max(0,Math.floor(b.x));x<Math.min(800,Math.ceil(b.X));x++)for(let c=0;c<3;c++)maxDifference=Math.max(maxDifference,Math.abs(actual[(y*800+x)*4+c]-uncovered[(y*800+x)*4+c]));
 checks++;scene.remove(d.root);
 }
 return {checks,handVertices,maxDifference};
 });fs.writeFileSync(out+'/hand-coverage.json',JSON.stringify({report,errors},null,2));assert.deepEqual(errors,[]);assert.ok(report.handVertices>100);assert.equal(report.maxDifference,0,'trouser coverage must not remove fingertip pixels');console.log(report);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
