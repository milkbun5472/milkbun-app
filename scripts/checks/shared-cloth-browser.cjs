// Render actual skinned garments at body extremes, and test per-avatar coverage.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/shared-cloth-check';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:2000,height:1900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
 await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
  const scene=new T.Scene();scene.background=new T.Color('#f0e8db');scene.add(new T.HemisphereLight('#fff','#aaa',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(2,3,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(2000,1900);document.body.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-2.37,2.37,2.25,-2.25,.1,20);camera.position.set(0,1,6);camera.lookAt(0,.7,0);
  window.clothQA={T,createTraveler,source,catalog,scene,renderer,camera,dolls:[],draco};
 });
 const state=await page.evaluate(()=>{
  const {createTraveler,source}=clothQA,a=createTraveler(source,false,{outfit:'cardigan'}),b=createTraveler(source,true,{outfit:'academy'});
  const ua=a.root.getObjectByName('DollBody').userData.skinCoverageUniforms,ub=b.root.getObjectByName('DollBody').userData.skinCoverageUniforms;
  const torsoStates=[ua.torso.value,ub.torso.value];
  const states=[ua.feet.value,ua.sleeve.value.x,ub.feet.value,ub.sleeve.value.x];
  a.setLook({outfit:'garden'});torsoStates.push(ua.torso.value);states.push(ua.feet.value,ua.sleeve.value.x);b.setLook({outfit:'cardigan'});torsoStates.push(ub.torso.value,ua.torso.value);states.push(ub.feet.value,ub.sleeve.value.x,ua.feet.value);
  const body=b.root.getObjectByName('DollBody');let shadows=0;body.customDepthMaterial.addEventListener('dispose',()=>shadows++);body.customDistanceMaterial.addEventListener('dispose',()=>shadows++);body.material.dispose();return {states,torsoStates,shadows};
 });
 assert.deepEqual(state.states,[.14,.205,-1,-1,-1,-1,.14,.205,-1]);assert.equal(state.shadows,2);assert.deepEqual(state.torsoStates,[.705,-1,-1,.705,-1]);
 const batches=[['rest','wave','stretch','tea','read'],['water','plant','draw','eat','give']];
 for(let batch=0;batch<batches.length;batch++)for(const angle of [0,1.55,3.1]){
  await page.evaluate(({gestures,angle})=>{
   const {T,createTraveler,source,catalog,scene,renderer,camera,dolls}=clothQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;
   for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,row===0?1:row===1?d.min:d.max]));
    const d=createTraveler(source,false,{outfit:'cardigan',hair:'curtains',dims});scene.add(d.root);dolls.push(d);
    for(let f=0;f<30;f++)d.animate(f*.1,{gesture:gestures[col],progress:.5,height:0});d.root.position.set((col-2)*.87,(1-row)*1.5,0);d.root.rotation.y=angle;
   }renderer.render(scene,camera);
  },{gestures:batches[batch],angle});
  await page.screenshot({path:`${out}/cardigan-${batch}-${angle}.png`});
 }
 // Other outfits retain their own skin visibility after changing out of cardigan.
 await page.evaluate(()=>{
  const {createTraveler,source,scene,renderer,camera,dolls}=clothQA;for(const d of dolls)scene.remove(d.root);dolls.length=0;
  ['academy','garden','ranger'].forEach((outfit,row)=>['rest','wave','stretch','tea','read'].forEach((gesture,col)=>{
   const d=createTraveler(source,false,{outfit:'cardigan',hair:'curtains'});d.setLook({outfit});scene.add(d.root);dolls.push(d);for(let f=0;f<30;f++)d.animate(f*.1,{gesture,progress:.5});d.root.position.set((col-2)*.87,(1-row)*1.5,0);d.root.rotation.y=.35;
  }));renderer.render(scene,camera);
 });await page.screenshot({path:out+'/outfits.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({coverage:state,renderedPoses:105,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
