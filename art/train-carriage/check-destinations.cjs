const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:18924/art/train-carriage/preview.html?destination=lake');await p.waitForFunction(()=>window.carriageReview?.visitDestination);
 assert.equal(await p.evaluate(()=>carriageReview.scenery.destination.id),'lake');
 const result=await p.evaluate(()=>{const r=carriageReview,s=r.scenery,hashes=[],objects=r.scene.children.length,textures=r.renderer.info.memory.textures;
 for(const id of ['lake','town'])for(const season of ['spring','summer','autumn','winter'])for(const hour of [12,22]){r.setEnvironment({season,hour,weather:'clear',playing:false});r.visitDestination(id);const d=s.canvas.getContext('2d').getImageData(0,0,s.canvas.width,s.canvas.height).data;let h=0;for(let i=0;i<d.length;i+=124)h=Math.imul(h^d[i],16777619);hashes.push(h>>>0);if(s.state.hour!==hour||s.state.season!==season)throw Error('visit changed environment');}
 r.visitDestination('lake');s.set({speed:2,playing:true});s.seekJourney(99);s.step(.1);const slow=s.state.distance-99;s.seekJourney(108);s.step(.1);const normal=s.state.distance-108;s.set({playing:false});const frozen=s.state.distance;s.step(.1);
 return {distinct:new Set(hashes).size,slow,normal,paused:s.state.distance===frozen,objectsStable:objects===r.scene.children.length,texturesStable:textures===r.renderer.info.memory.textures};});
 assert.equal(result.distinct,16);assert.ok(Math.abs(result.slow/.072-1)<1e-8);assert.ok(Math.abs(result.normal/.2-1)<1e-8);assert.ok(result.paused&&result.objectsStable&&result.texturesStable);
 const out='/Users/lisa/.codex/visualizations/2026/09/24/train-destinations';fs.mkdirSync(out,{recursive:true});
 for(const id of ['lake','town'])for(const season of ['spring','summer','autumn','winter']){await p.evaluate(({id,season})=>{carriageReview.setEnvironment({season,hour:12,weather:'clear',playing:false});carriageReview.visitDestination(id);},{id,season});await p.screenshot({path:path.join(out,id+'-'+season+'.png')});}
 await p.setViewportSize({width:390,height:844});for(const id of ['lake','town']){await p.locator(`[data-destination=${id}]`).click();assert.equal(await p.evaluate(()=>carriageReview.scenery.destination.id),id);}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:path.join(out,'mobile.png')});assert.deepEqual(errors,[]);
 const modelHash=createHash('sha256').update(fs.readFileSync(path.join(__dirname,'carriage.glb'))).digest('hex');assert.equal(modelHash,'e87085ce31a2f0d16fe34badfbc267387b3b2a664d79ff71167a9ce1f52c4811');
 fs.writeFileSync(path.join(__dirname,'destination-validation.json'),JSON.stringify({...result,modelHash,mobileControls:true,errors},null,2)+'\n');console.log(result);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
