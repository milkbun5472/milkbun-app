// 衣服按需加载（她 2026-09-26）：doll.glb 不带衣服，穿哪套才下 outfits/<id>.glb。
// 查三件事：第一套到之前人不露面、到了就穿上；换装途中照旧穿着上一套；只下穿过的那几套。
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage(),errors=[],fetched=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{const m=/\/outfits\/(\w+)\.glb/.exec(r.url());if(m)fetched.push(m[1]);});
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.goto(base+'/apps/companion/');
 const out=await page.evaluate(async()=>{
  const {GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler}=await import('../fairy-garden/traveler.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;
  const outfitsIn=o=>{const s=new Set();o.traverse(m=>{if(m.userData.outfit)s.add(m.userData.outfit);});return [...s];};
  const shown=d=>{const s=new Set();d.root.traverse(m=>{if(m.isMesh&&m.userData.outfit&&m.visible)s.add(m.userData.outfit);});return [...s];};
  const model=d=>d.root.getObjectByName('TravelerVisual');
  const r={baseOutfits:outfitsIn(source)};
  const a=createTraveler(source,false,{outfit:'jacket'});
  r.hiddenBeforeFirst=!model(a).visible;
  await a.ready();r.visibleAfterFirst=model(a).visible;r.shownFirst=shown(a);
  a.setLook({outfit:'garden'});r.shownWhileSwitching=shown(a);
  await a.ready();r.shownAfterSwitch=shown(a);
  // 同一套第二个人：已经下过，当场就穿上
  const b=createTraveler(source,true,{outfit:'garden'});r.secondInstant=shown(b);r.secondVisible=model(b).visible;
  // 两人各自一份材质：改一个人的颜色，另一个不变
  b.setLook({outfitColors:{cloth:'#aa3344'}});
  const tint=d=>{let t=null;d.root.traverse(m=>{if(!t&&m.isMesh&&m.visible&&m.userData.slotDye)t=m.userData.slotDye.u.uTint.value[0].toArray();});return t;};
  r.tints=[tint(a),tint(b)];
  return r;
 });
 assert.deepEqual(out.baseOutfits,[],'doll.glb carries no clothes');
 assert.equal(out.hiddenBeforeFirst,true);assert.equal(out.visibleAfterFirst,true);
 assert.deepEqual(out.shownFirst,['jacket']);
 assert.deepEqual(out.shownWhileSwitching,['jacket'],'old outfit stays on until the new one arrives');
 assert.deepEqual(out.shownAfterSwitch,['garden']);
 assert.deepEqual(out.secondInstant,['garden']);assert.equal(out.secondVisible,true);
 assert.notDeepEqual(out.tints[0],out.tints[1]);
 assert.deepEqual([...new Set(fetched)].sort(),['garden','jacket'],'only worn outfits are downloaded');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,fetched}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
