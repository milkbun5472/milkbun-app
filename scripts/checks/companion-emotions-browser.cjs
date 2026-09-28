const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18938';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1500,height:1275}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
 const report=await page.evaluate(async()=>{
 const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs'),{MOODS,EXTRA_ACTIONS}=await import('./motion.mjs');
 const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);const source=(await loader.loadAsync('../fairy-garden/doll.glb').then(async g=>(await preloadOutfits(),g))).scene;
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1500,1275);document.body.append(renderer.domElement);renderer.setScissorTest(true);
 const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const sun=new T.DirectionalLight('#fff',1.5);sun.position.set(1,3,3);scene.add(sun);
 const camera=new T.PerspectiveCamera(26,300/425,.05,20);camera.position.set(0,.68,3.5);camera.lookAt(0,.65,0);
 const doll=createTraveler(source,true);scene.add(doll.root);let time=0,frames=0;const signatures=[];
 const catalog=await(await fetch('../fairy-garden/doll.json')).json(),actions=[...Object.keys(MOODS),...Object.keys(EXTRA_ACTIONS)];await doll.ready();
 for(const outfit of Object.keys(catalog.outfits))for(const dims of [{},Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]){
 doll.setLook({outfit,dims});await doll.ready();for(const face of actions)for(let j=0;j<=40;j++){
 doll.animate(time+=.04,{emotion:face,progress:j/40,height:0});frames++;doll.root.updateMatrixWorld(true);
 doll.root.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('invalid bone '+face);});
 }}
 const neutral=createTraveler(source,true);scene.add(neutral.root);
 const targetDims=Object.fromEntries(catalog.dims.map(d=>[d.key,d.min]));
 doll.root.position.set(3,2,1);doll.root.rotation.set(.2,.4,.1);doll.animate(time+=.04,{emotion:'irritated',progress:.4,height:1});doll.root.updateWorldMatrix(true,true);
 doll.setLook({dims:targetDims});neutral.setLook({dims:targetDims});await Promise.all([doll.ready(),neutral.ready()]);
 const matrices=d=>{const a=[];d.root.traverse(o=>{if(o.isSkinnedMesh)a.push(...o.bindMatrix.elements,...o.skeleton.boneInverses.flatMap(m=>m.elements));});return a;};
 const expected=matrices(neutral);if(matrices(doll).some((v,i)=>Math.abs(v-expected[i])>1e-6))throw Error('Body change used animated bind frame '+JSON.stringify(matrices(doll).map((v,i)=>[i,v,expected[i]]).filter(x=>Math.abs(x[1]-x[2])>1e-6).slice(0,12)));
 scene.remove(neutral.root);doll.root.position.set(0,0,0);doll.root.rotation.set(0,0,0);
 doll.setLook({outfit:'cardigan',hair:'bob',dims:Object.fromEntries(catalog.dims.map(d=>[d.key,1]))});await doll.ready();
 const bindSnapshot=()=>{const a=[];doll.root.traverse(o=>{if(o.isSkinnedMesh)a.push(...o.bindMatrix.elements,...o.skeleton.boneInverses.flatMap(m=>m.elements));});return a;};
 const before=bindSnapshot();
 let i=0;for(const face of actions){doll.setLook({face:EXTRA_ACTIONS[face]?.moods[0]||face,hair:'bob'});await doll.ready();await new Promise(resolve=>setTimeout(resolve,180));for(let j=0;j<20;j++)doll.animate(time+=.04,{emotion:face,progress:.45,height:0});
 if(bindSnapshot().some((v,i)=>Math.abs(v-before[i])>1e-8))throw Error('Face change rebound an animated skeleton');
 const bones=[];doll.root.traverse(o=>{if(o.isBone&&/Arm$/.test(o.name))bones.push(...o.quaternion.toArray().map(v=>v.toFixed(2)));});signatures.push(bones.join(','));
 const x=i%5*300,y=(2-Math.floor(i/5))*425;renderer.setViewport(x,y,300,425);renderer.setScissor(x,y,300,425);renderer.render(scene,camera);
 const label=document.createElement('div');label.textContent=face;label.style=`position:absolute;left:${x+12}px;top:${Math.floor(i/5)*425+12}px;color:#45382d;font:18px sans-serif`;document.body.append(label);i++;}
 if(new Set(signatures).size!==actions.length)throw Error('Emotion arm poses are not distinct');return {frames,distinctArmPoses:new Set(signatures).size};
 });
 await page.screenshot({path:'/tmp/companion-emotions.png'});if(errors.length)throw Error(errors.join('\n'));console.log(report);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
