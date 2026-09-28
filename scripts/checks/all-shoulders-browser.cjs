// Shared clothing shoulder silhouettes: actual asset, six angles, rest/raise/sit and body extremes.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-all-shoulder-gallery';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:3000,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(process.env.PARTS_DIR)for(const id of ['academy','garden','ranger','cardigan','jacket','suit','tee'])await page.route('**/outfits/'+id+'.glb*',r=>r.fulfill({path:process.env.PARTS_DIR+'/'+id+'.glb',contentType:'model/gltf-binary'}));
 if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));await page.goto(base+'/apps/companion/');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb').then(async g=>(await preloadOutfits(),g))).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
  const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(3000,1500);document.body.append(renderer.domElement);const camera=new T.OrthographicCamera(-.38,.38,.38,-.38,.1,20);
  window.strapQA={T,createTraveler,source,catalog,scene,renderer,camera,dolls:[]};
 });
 const samples={};let views=0;
 for(const outfit of (process.env.CLOTH_OUTFITS?.split(',')||['academy','garden','ranger','cardigan','jacket','suit','tee']))for(const mode of ['default','narrow','min','max']){
  views+=18;samples[outfit+mode]=await page.evaluate(({mode,outfit})=>{
   const {T,createTraveler,source,catalog,scene,renderer,camera,dolls}=strapQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;const pixels=[];renderer.setScissorTest(true);
   [0,.9,2.15,3.14,4.15,4.71].forEach((angle,col)=>['rest','stretch','sit'].forEach((gesture,row)=>{
    dolls.forEach(d=>d.root.visible=false);const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='min'||mode==='max'?d[mode]:mode==='narrow'&&d.key==='shoulder'?.96:1]));
    const d=createTraveler(source,false,{outfit,hair:'curtains',dims});if(mode==='tinted')d.setLook({outfitColors:{cloth:'#b76673'}});if(mode==='accent')d.setLook({outfitColors:{accent:'#4c7998'}});scene.add(d.root);dolls.push(d);
    for(let f=0;f<30;f++)d.animate(f*.1,{gesture,progress:.5,height:0,seated:gesture==='sit'});d.root.rotation.y=angle;
    renderer.setViewport(col*500,(2-row)*500,500,500);renderer.setScissor(col*500,(2-row)*500,500,500);camera.position.set(0,gesture==='sit'?.42:.74,6);camera.lookAt(0,gesture==='sit'?.32:.64,0);renderer.render(scene,camera);if((row===0&&(col===0||col===3))||(row===1&&col===5)){const v=new T.Vector3(...(col===5?[.14,.54,0]:col===0?[.11,.43,.15]:[.034,.535,-.132]));d.root.getObjectByName('TravelerVisual').localToWorld(v);v.project(camera);const pixel=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(Math.round(col*500+(v.x*.5+.5)*500),Math.round((2-row)*500+(v.y*.5+.5)*500),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);pixels.push([...pixel]);}
   }));renderer.setScissorTest(false);return pixels;
  },{mode,outfit});await page.screenshot({path:`${out}/${outfit}-${mode}.png`});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({views,samples,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
