// Render each dye separately and check both its intended area and neighbouring regions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-all-shoulder-gallery';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:3000,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(process.env.DYE_MODULE_FILE)await page.route('**/outfit-dye.mjs*',r=>r.fulfill({path:process.env.DYE_MODULE_FILE,contentType:'text/javascript'}));
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
 const {T,createTraveler,source,catalog,scene,renderer,camera}=strapQA;
 renderer.setSize(800,800);renderer.setViewport(0,0,800,800);camera.left=-.4;camera.right=.4;camera.top=.4;camera.bottom=-.4;camera.position.set(0,.4,6);camera.lookAt(0,.4,0);camera.updateProjectionMatrix();
 const points={
 academy:{cloth:[.085,.52,.1],trim:[.06,.665,.10],bottom:[.08,.26,.08],accent:[0,.59,.12],socks:[.09,.135,.09],boots:[.09,.035,.12]},
 garden:{cloth:[.08,.30,.16],trim:[.08,.67,.08],accent:[.04,.58,.14],detail:[-.12,.37,.18],socks:[.09,.135,.09],boots:[.09,.035,.12]},
 ranger:{cloth:[-.07,.53,.12],bottom:[.09,.25,.09],accent:[.11,.43,.18],boots:[.09,.035,.12]},
 cardigan:{cloth:[-.08,.51,.11],bottom:[-.09,.24,.09],bag:[.11,.42,.18],boots:[.09,.035,.12]},
 jacket:{cloth:[.09,.5,.11],trim:[0,.54,.10],bottom:[.09,.25,.09],boots:[.09,.035,.12]},
 suit:{cloth:[.1,.46,.12],trim:[.025,.65,.10],bottom:[.09,.24,.1],accent:[0,.6,.12],socks:[.10,.09,.05],boots:[.09,.035,.12]}};
 const edges={
 garden:[['detail','left ear',[-.167,.373,.12]],['detail','right ear',[-.122,.375,.171]],['cloth','pouch flap',[-.08,.40,.18]]],
 ranger:[['cloth','front ribbed hem',[-.08,.376,.126]],['bottom','rolled trouser cuff',[-.13,.105,.08]]],
 cardigan:[['bag','pouch side shadow',[.15,.46,.096]],['bottom','upper trouser shadow',[-.08,.37,.10]]],
 jacket:[['trim','shirt collar shadow',[.039,.678,.08]],['cloth','pocket flap',[.105,.46,.13]]]
 };
 let report={};
 const diff=(a,b)=>Math.max(...a.map((n,i)=>Math.abs(n-b[i])));
 for(const [outfit,partPoints] of Object.entries(points)){
  const d=createTraveler(source,false,{outfit,hair:'curtains'});scene.add(d.root);d.animate(0,{gesture:'rest',height:0});
  const gl=renderer.getContext(),capture=()=>{renderer.render(scene,camera);const px=new Uint8Array(800*800*4);gl.readPixels(0,0,800,800,gl.RGBA,gl.UNSIGNED_BYTE,px);return px;},sample=(px,p)=>{const v=new T.Vector3(...p);d.root.getObjectByName('TravelerVisual').localToWorld(v);v.project(camera);const x=Math.round((v.x*.5+.5)*800),y=Math.round((v.y*.5+.5)*800);return [...px.slice((y*800+x)*4,(y*800+x)*4+3)];};
  const defaults=capture(),neutral=Object.fromEntries(Object.keys(catalog.outfits[outfit].colors).map(k=>[k,'#888888']));
  d.setLook({outfitColors:neutral});const plain=capture(),results={};
  for(const slot of Object.keys(catalog.outfits[outfit].colorLabels)){
   d.setLook({outfitColors:{...neutral,[slot]:'#ff2222'}});const changed=capture();let count=0;for(let i=0;i<plain.length;i+=4)if(Math.abs(plain[i]-changed[i])+Math.abs(plain[i+1]-changed[i+1])+Math.abs(plain[i+2]-changed[i+2])>12)count++;
   const deltas=Object.fromEntries(Object.entries(partPoints).map(([key,p])=>[key,diff(sample(plain,p),sample(changed,p))]));const edgeDeltas=(edges[outfit]||[]).map(([owner,name,p])=>({owner,name,delta:diff(sample(plain,p),sample(changed,p))}));results[slot]={changedPixels:count,deltas,edges:edgeDeltas};
  }
  d.setLook({outfitColors:{...catalog.outfits[outfit].colors}});const reset=capture();let resetDifference=0;for(let i=0;i<reset.length;i++)resetDifference=Math.max(resetDifference,Math.abs(reset[i]-defaults[i]));
  report[outfit]={regions:results,resetDifference};scene.remove(d.root);
 }
 return report;
 });
 fs.writeFileSync(out+'/regions.json',JSON.stringify({report,errors},null,2));assert.deepEqual(errors,[]);
 for(const [outfit,r] of Object.entries(report)){assert.equal(r.resetDifference,0,outfit+' reset');for(const [slot,v] of Object.entries(r.regions)){assert.ok(v.changedPixels>5,outfit+' '+slot+' must be visible');assert.ok(v.deltas[slot]>8,outfit+' '+slot+' target '+JSON.stringify(v));for(const e of v.edges)assert.ok(e.owner===slot?e.delta>8:e.delta<3,outfit+' '+slot+' edge '+JSON.stringify(e));for(const [other,delta] of Object.entries(v.deltas))if(other!==slot)assert.ok(delta<3,outfit+' '+slot+' leaks into '+other+': '+delta);}}
 console.log(JSON.stringify({report,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
