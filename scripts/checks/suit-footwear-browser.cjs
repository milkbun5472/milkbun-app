// Restored suit footwear: six angles, rest/raise/sit, body extremes and dye.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-suit-footwear-gallery';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:3000,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(process.env.PARTS_DIR)for(const id of ['suit'])await page.route('**/outfits/'+id+'.glb*',r=>r.fulfill({path:process.env.PARTS_DIR+'/'+id+'.glb',contentType:'model/gltf-binary'}));
 if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));await page.goto(base+'/apps/companion/');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb').then(async g=>(await preloadOutfits(),g))).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
  const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(3000,1500);document.body.append(renderer.domElement);const camera=new T.OrthographicCamera(-.25,.25,.25,-.25,.1,20);
  window.strapQA={T,createTraveler,source,catalog,scene,renderer,camera,dolls:[]};
 });
 const samples={};let views=0;
 for(const outfit of ['suit'])for(const mode of ['default','min','max','tinted']){
  views+=18;samples[outfit+mode]=await page.evaluate(({mode,outfit})=>{
   const {T,createTraveler,source,catalog,scene,renderer,camera,dolls}=strapQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;const pixels=[];renderer.setScissorTest(true);
   [0,.9,2.15,3.14,4.15,4.71].forEach((angle,col)=>['rest','stretch','sit'].forEach((gesture,row)=>{
    dolls.forEach(d=>d.root.visible=false);const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='min'||mode==='max'?d[mode]:mode==='narrow'&&d.key==='shoulder'?.96:1]));
    const d=createTraveler(source,false,{outfit,hair:'curtains',dims});if(mode==='tinted')d.setLook({outfitColors:{bottom:'#586f9c'}});if(mode==='accent')d.setLook({outfitColors:{accent:'#4c7998'}});scene.add(d.root);dolls.push(d);
    for(let f=0;f<30;f++)d.animate(f*.1,{gesture,progress:.5,height:0,seated:gesture==='sit'});d.root.rotation.y=angle;
    renderer.setViewport(col*500,(2-row)*500,500,500);renderer.setScissor(col*500,(2-row)*500,500,500);camera.position.set(0,gesture==='sit'?.22:.24,6);camera.lookAt(0,gesture==='sit'?.12:.14,0);renderer.render(scene,camera);if(row===0&&col===0){const gl=renderer.getContext();for(const [x,y] of [[320,1195],[320,1150]]){const pixel=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);pixels.push([...pixel]);}}
   }));renderer.setScissorTest(false);return pixels;
  },{mode,outfit});await page.screenshot({path:`${out}/${outfit}-${mode}.png`});
 }
 const distance=(a,b)=>a.slice(0,3).reduce((n,v,i)=>n+Math.abs(v-b[i]),0);assert(distance(samples.suitdefault[0],samples.suittinted[0])<8,'Socks must retain trim color');assert(distance(samples.suitdefault[1],samples.suittinted[1])>15,'Leather must follow bottom color');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({views,samples,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
