// Actual shared traveler rendering: outfit-specific shoes, body sizes, dye and gait.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-shoes/gallery';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1200}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));
 await page.goto(base+'/apps/companion/');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb').then(async g=>(await preloadOutfits(),g))).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
  const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1500,1200);document.body.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-.86,.86,.688,-.688,.1,20);camera.position.set(0,1.2,6);camera.lookAt(0,.55,0);
  window.shoeQA={T,createTraveler,source,catalog,scene,renderer,camera,dolls:[]};
 });
 for(const mode of ['default','min','max','tinted','walk','sit','skate']){
  const report=await page.evaluate(mode=>{
   const {createTraveler,source,catalog,scene,renderer,camera,dolls}=shoeQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;
   const checks=[];
   ['academy','garden','ranger'].forEach((outfit,col)=>[0,1.3,3.1].forEach((angle,row)=>{
    const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='min'||mode==='max'?d[mode]:1]));
    const d=createTraveler(source,false,{outfit,hair:'curtains',dims});if(mode==='tinted')d.setLook({outfitColors:{boots:'#986d75'}});
    scene.add(d.root);dolls.push(d);
    for(let f=0;f<30;f++)d.animate(f*.1,{gesture:mode==='sit'?'sit':'rest',moving:mode==='walk'||mode==='skate',skating:mode==='skate',progress:.5,height:0});
    // Crop lower leg without moving its actual geometry or changing its bones.
    d.root.position.set((col-1)*3,(1-row)*3,0);d.root.rotation.y=angle;
    let parts=0;d.root.traverse(o=>{if(o.isMesh&&o.visible&&o.userData.footwearVersion){parts++;if(o.userData.colorSlot==='boots')checks.push(o.material.color.getHexString());}});checks.push(parts);
   }));
   camera.left=-.29;camera.right=.29;camera.top=.232;camera.bottom=-.232;camera.updateProjectionMatrix();renderer.setScissorTest(true);
   dolls.forEach((d,i)=>{dolls.forEach(x=>x.root.visible=x===d);const col=Math.floor(i/3),row=i%3;renderer.setViewport(col*500,(2-row)*400,500,400);renderer.setScissor(col*500,(2-row)*400,500,400);const bounds=new shoeQA.T.Box3();d.root.updateMatrixWorld(true);d.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible&&o.name.endsWith('_shoes_sole')){const p=new shoeQA.T.Vector3();for(let j=0;j<o.geometry.attributes.position.count;j++){p.fromBufferAttribute(o.geometry.attributes.position,j);o.applyBoneTransform(j,p);bounds.expandByPoint(p.applyMatrix4(o.matrixWorld));}}});const center=bounds.getCenter(new shoeQA.T.Vector3());camera.position.set(center.x,center.y+.37,center.z+3);camera.lookAt(center.x,center.y+.10,center.z);renderer.render(scene,camera);});
   renderer.setScissorTest(false);renderer.setViewport(0,0,1500,1200);return checks;
  },mode);
  assert.equal(report.filter(x=>x===5).length,9);if(mode==='tinted')assert.equal(report.filter(x=>x==='986d75').length,9);
  await page.screenshot({path:`${out}/shoes-${mode}.png`});
 }
 await page.evaluate(()=>{
  const {scene,renderer,camera,dolls}=shoeQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;
  const {createTraveler,source}=shoeQA;['academy','garden','ranger'].forEach((outfit,col)=>{const d=createTraveler(source,false,{outfit,hair:'curtains'});scene.add(d.root);dolls.push(d);d.animate(0,{height:0});d.root.position.x=(col-1)*.7;d.root.rotation.y=.23;});
  camera.left=-1.13;camera.right=1.13;camera.top=.904;camera.bottom=-.904;camera.position.set(0,.75,6);camera.lookAt(0,.67,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
 });await page.screenshot({path:out+'/outfits.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({rendered:66,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
