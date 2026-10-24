// Render the actual garment/skin shaders. Bone continuity alone cannot detect
// skin poking through a continuous sleeve. Optional old traveler must fail.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946';
const out=process.env.COMPANION_EVIDENCE||'/tmp/companion-sleeves';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const reports={},errors=[];
 for(const baseline of process.env.SLEEVE_BASELINE?[true,false]:[false]){
  const page=await browser.newPage({viewport:{width:1200,height:1200}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  if(baseline)await page.route('**/traveler.mjs*',r=>r.fulfill({body:fs.readFileSync(process.env.SLEEVE_BASELINE,'utf8'),contentType:'text/javascript'}));
  await page.goto(base+'/apps/companion/');
  reports[baseline?'before':'after']=await page.evaluate(async baseline=>{
   const T=await import('three'),{loadTravelerSource,createTraveler}=await import('../fairy-garden/traveler.mjs');
   const source=await loadTravelerSource(),catalog=await(await fetch('../fairy-garden/doll.json')).json();
   const d=createTraveler(source,true,{outfit:'cardigan',hair:'bob',face:'cozy'});await d.ready();
   const body=d.root.getObjectByName('DollBody'),original=body.material,diagnostic=original.clone(),compile=original.onBeforeCompile;
   diagnostic.customProgramCacheKey=()=>original.customProgramCacheKey()+'-sleeve-probe';
   diagnostic.onBeforeCompile=sh=>{compile(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
    // Read the coverage bounds authored by fit_cuffs.py on the loaded outfit.
    // Keep a small hem margin: the test targets the cloth interior, not its edge.
    bool covered=uSleeve.x>0. && abs(vSkinRest.x)>uSleeve.w && sleeveAlong<uSleeve.x-.002 && vSkinRest.y>uSleeve.y && vSkinRest.y<uSleeve.z;
    bool hand=vSkinRest.y<.435 && max(vSkinRightForearm,vSkinLeftForearm)>.9;
    gl_FragColor=covered?vec4(1.,0.,0.,1.):hand?vec4(0.,1.,0.,1.):vec4(0.,0.,0.,1.);`);};
   const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(d.root,new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(1,3,3);scene.add(light);
   const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);document.body.append(renderer.domElement);
   const camera=new T.OrthographicCamera(-.55,.55,.55,-.55,.01,20),pixels=new Uint8Array(256*256*4),gl=renderer.getContext();let time=0;
   const actions=['wipesweat','shade','wind','thunder','ears','cheeks','scratch','chin','rubeyes','peekaboo','cry','selfie','catchrain','catchsnow','warmhands','rainclose','raindry','fan'];
   const report={views:0,leakingViews:0,maxLeakPixels:0,minHandPixels:Infinity,examples:[]},handPixels=[];
   function pose(action,p){for(let j=0;j<10;j++)d.animate(time+=.04,{height:0,emotion:action,progress:p});d.root.updateMatrixWorld(true);}
   function view(angle){const h=d.root.getObjectByName('HeadAnchor').getWorldPosition(new T.Vector3()).y-.12;camera.position.set(Math.sin(angle)*3,h+.15,Math.cos(angle)*3);camera.lookAt(0,h,0);}
   for(const outfit of Object.keys(catalog.outfits))for(const variant of ['default','min','max']){
    d.setLook({outfit,dims:Object.fromEntries(catalog.dims.map(x=>[x.key,variant==='default'?1:x[variant]]))});await d.ready();
    for(const action of actions)for(const p of [.25,.5,.75]){pose(action,p);body.material=diagnostic;
     for(const angle of [0,Math.PI/2,-Math.PI/2]){
      view(angle);renderer.render(scene,camera);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let red=0,green=0;
      for(let i=0;i<pixels.length;i+=4){if(pixels[i]>250&&pixels[i+1]<2&&pixels[i+2]<2)red++;if(pixels[i]<2&&pixels[i+1]>250&&pixels[i+2]<2)green++;}
      report.views++;report.maxLeakPixels=Math.max(report.maxLeakPixels,red);report.minHandPixels=Math.min(report.minHandPixels,green);handPixels.push(green);
      if(red){report.leakingViews++;if(report.examples.length<12)report.examples.push({outfit,variant,action,p,angle,red});}
     }
    }
   }
   body.material=original;
   // Close front/side views of the same raised arm with every outfit, including
   // both short sleeves. Save actual wrist/hem appearance for visual inspection.
   renderer.setSize(1200,1200);renderer.setScissorTest(true);
   window.sleeveGallery=async outfit=>{d.setLook({outfit,dims:Object.fromEntries(catalog.dims.map(x=>[x.key,1]))});await d.ready();
    for(const [row,action]of ['thunder','shade','catchrain'].entries())for(const [col,angle]of [0,Math.PI/2,-Math.PI/2].entries()){
     pose(action,.6);view(angle);renderer.setViewport(col*400,(2-row)*400,400,400);renderer.setScissor(col*400,(2-row)*400,400,400);renderer.render(scene,camera);
    }
   };
   return {...report,handPixels,outfits:Object.keys(catalog.outfits)};
  },baseline);
  for(const outfit of baseline?['cardigan']:reports.after.outfits){await page.evaluate(o=>sleeveGallery(o),outfit);await page.screenshot({path:out+'/'+(baseline?'before-':'after-')+outfit+'.png'});}
  await page.close();
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));
 assert.deepEqual(errors,[]);assert.equal(reports.after.maxLeakPixels,0,'covered skin shows through sleeve');
 if(reports.before){assert.ok(reports.before.leakingViews>30,'baseline must reproduce visible cracks');assert.deepEqual(reports.after.handPixels,reports.before.handPixels,'visible hands were lost while hiding the covered arm');}
 for(const r of Object.values(reports))delete r.handPixels;
 console.log(JSON.stringify(reports));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
