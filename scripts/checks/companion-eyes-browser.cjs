const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946',out=process.env.COMPANION_EVIDENCE||'/tmp/companion-eyes';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const errors=[],results=[];
 for(const resolution of ['float','full']){
  const page=await browser.newPage({viewport:{width:512,height:512}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
  await page.evaluate(async resolution=>{
   const T=await import('three'),mod=await import('../fairy-garden/traveler.mjs');if(resolution==='full')mod.setFaceBase(new URL('./faces/',location.href).href);
   const source=await mod.loadTravelerSource(),d=mod.createTraveler(source,true,{outfit:'tee',hair:'curtains',face:'default'}),other=mod.createTraveler(source,true);await Promise.all([d.ready(),other.ready()]);
   const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(d.root,new T.HemisphereLight('#ffffff','#b8a38c',2.3));const light=new T.DirectionalLight('#fff',1.5);light.position.set(1,3,3);scene.add(light);
   const camera=new T.OrthographicCamera(-.32,.32,.32,-.32,.01,20);camera.position.set(0,.96,3);camera.lookAt(0,.96,0);
   const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(512,512);document.body.style.margin='0';document.body.replaceChildren(renderer.domElement);
   let time=0;window.qa={d,other,renderer,scene,camera,T,pose:()=>{for(let j=0;j<30;j++)d.animate(time+=.04,{height:0});},pixels:async look=>{d.setLook(look,true);await d.ready();renderer.render(scene,camera);const pixels=new Uint8Array(512*512*4);renderer.getContext().readPixels(0,0,512,512,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);return pixels;}};
  },resolution);
  const report=await page.evaluate(async()=>{
   const faces=Object.keys(await fetch('../fairy-garden/doll.json').then(r=>r.json()).then(x=>x.faces)),rows=[];
   function diff(a,b){let left=0,right=0;for(let i=0;i<a.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])))>3){if((i/4)%512<256)left++;else right++;}return {left,right};}
   for(const face of faces){const common={hair:'curtains',outfit:'tee',face,eye:'#2244cc'};
    const both=await qa.pixels(common),left=await qa.pixels({...common,eyeMode:'split',eyeLeft:'#ee4422',eyeRight:'#2244cc'}),right=await qa.pixels({...common,eyeMode:'split',eyeLeft:'#2244cc',eyeRight:'#ee4422'});
    const l=diff(both,left),r=diff(both,right);if(l.left||r.right)throw Error('Eyes reversed/leaked '+face+JSON.stringify({l,r}));
    if(!['happy','cozy','relax'].includes(face)&&(!l.right||!r.left))throw Error('Open eyes did not recolor '+face);
    if(['happy','cozy'].includes(face)&&(l.right||r.left))throw Error('Closed eyes recolored '+face);
    if(face==='relax'&&(!l.right||r.left))throw Error('Wink must only tint open left eye');rows.push({face,leftChanged:l,rightChanged:r});
   }
   // Default colour keeps the original texture, split with equal colours is pixel-identical.
   const common={hair:'curtains',outfit:'tee',face:'default'},original=await qa.pixels(common),brown=await qa.pixels({...common,eye:'#5d4435'});if(diff(original,brown).left||diff(original,brown).right)throw Error('Legacy default changed');
   const solid=await qa.pixels({...common,eye:'#2244cc'}),same=await qa.pixels({...common,eye:'#2244cc',eyeMode:'split',eyeLeft:'#2244cc',eyeRight:'#2244cc'});if(diff(solid,same).left||diff(solid,same).right)throw Error('Equal colours differ');
   await qa.pixels({...common,eyeMode:'split',eyeLeft:'#22aadd',eyeRight:'#e6ab39'});
   const a=qa.d.root.getObjectByName('DollBody').userData.skinCoverageUniforms,b=qa.other.root.getObjectByName('DollBody').userData.skinCoverageUniforms;if(a===b||b.eyeOn.value||b.eyeRightOn.value)throw Error('Another avatar inherited eyes');
   qa.d.animate(100,{gesture:'sleep',seated:true,height:0});await qa.d.ready();if(!qa.d.root.getObjectByName('DollBody').material.map.image.src.includes('/cozy.webp'))throw Error('Sleep must close eyes');
   qa.d.setLook({eyeLeft:'#3f6fa8'});await qa.d.ready();qa.pose();await qa.d.ready();if(a.eye.value.getHexString()!=='3f6fa8'||a.eyeRight.value.getHexString()!=='e6ab39')throw Error('Wake lost eye colours');
   qa.renderer.render(qa.scene,qa.camera);return {resolution:innerWidth,faces:rows,defaultUnchanged:true,equalColours:true,instanceIsolation:true,sleepWake:true};
  });
  await page.screenshot({path:out+'/'+resolution+'-eyes.png'});results.push({mode:resolution,...report});await page.close();
 }
 // Real Companion page, its real shared controls, original saveJSON/IDB writer, and actual iframe.
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 const mount=async()=>{await page.goto(base+'/');await page.waitForFunction(()=>window.Companion&&window.LazyMods,{},{polling:100,timeout:60000});await page.evaluate(async()=>{await txtVaultReady();await LazyMods.load('garden');const el=document.createElement('div');el.style.cssText='position:fixed;inset:0;z-index:99999;background:white';el.id='eyes-fixture';document.body.append(el);ReactDOM.createRoot(el).render(React.createElement(Companion,{characters:[{id:'eyes-one',name:'试色一号',gender:'男'},{id:'eyes-two',name:'试色二号',gender:'女'}],moods:{},onBack:()=>{}}));});await page.getByRole('checkbox',{name:'左右眼不同颜色（异瞳）'}).waitFor({timeout:60000});};
 await mount();const box=page.getByRole('checkbox',{name:'左右眼不同颜色（异瞳）'});await page.getByLabel('眼睛色号',{exact:true}).fill('#4e8a62');await box.check();await page.getByLabel('左眼色号',{exact:true}).fill('#3f6fa8');await page.getByLabel('右眼色号',{exact:true}).fill('#e6ab39');
 const f=await page.locator('#eyes-fixture iframe').elementHandle().then(e=>e.contentFrame());await f.waitForFunction(()=>PetGame.getDyes().eyeRight==='#e6ab39',{},{polling:100});
 const saved=await page.evaluate(()=>loadJSON('x_companion',{}));assert.equal(saved.looks['eyes-one'].eyeLeft,'#3f6fa8');assert.equal(saved.looks['eyes-one'].eyeMode,'split');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await box.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const b=await box.locator('..').boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=width);await page.screenshot({path:out+'/controls-'+width+'.png'});}
 await box.uncheck();assert.equal(await page.getByLabel('眼睛色号',{exact:true}).inputValue(),'#4e8a62');await box.check();assert.equal(await page.getByLabel('右眼色号',{exact:true}).inputValue(),'#e6ab39');
 await page.getByRole('button',{name:'试色二号',exact:true}).click();assert.equal(await box.isChecked(),false);await page.getByRole('button',{name:'试色一号',exact:true}).click();assert.equal(await box.isChecked(),true);
 await page.waitForTimeout(600);await mount();assert.equal(await page.getByRole('checkbox',{name:'左右眼不同颜色（异瞳）'}).isChecked(),true);assert.equal(await page.getByLabel('左眼色号',{exact:true}).inputValue(),'#3f6fa8');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({render:results,ui:{widths:[320,390,430],livePreview:true,realWriter:true,reload:true,characterIsolation:true,toggleRestore:true},errors},null,2));console.log('PASS both face resolutions, 10 expressions, correct sides, sleep/wake, isolation; real companion controls/save/reload');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
