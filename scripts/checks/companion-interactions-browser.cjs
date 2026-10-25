const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946',out=process.env.COMPANION_EVIDENCE||'/tmp/companion-interactions';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const report=[];
 const build=/BUILD = "(fg-[a-f0-9]+)"/.exec(fs.readFileSync('js/companion.js','utf8'))[1];
 for(const mode of ['full','float']){
  const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const width=mode==='full'?370:96,height=mode==='full'?620:114;
  await page.route('**/interactions-harness',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><iframe style="width:${width}px;height:${height}px;border:0" src="apps/companion/index.html?mode=${mode}&v=${build}"></iframe>`}));
  await page.goto(base+'/interactions-harness');const frame=await(await page.waitForSelector('iframe')).contentFrame();await frame.waitForFunction(()=>window.petDebug,{},{timeout:60000,polling:100});await frame.evaluate(()=>petDebug.ready());
  const snap=()=>frame.evaluate(()=>petDebug.snapshot());
  const who=async(id,mood='happy')=>{await frame.evaluate(({id,mood})=>{postMessage({type:'pet-look',characterId:id,mood,ta:'TA',look:{outfit:'cardigan',hair:'bob',face:'happy'}},'*');postMessage({type:'pet-ctx',screen:'companion',idle:false},'*');},{id,mood});await frame.evaluate(()=>petDebug.ready());await page.waitForTimeout(120);};
  const tap=async(kind,side)=>{const t=(await snap()).targets.find(t=>t.kind===kind&&(!side||t.side===side)&&t.visible);assert.ok(t,mode+' visible '+kind+' '+side);await frame.locator('canvas').click({position:{x:t.x,y:t.y},force:true});await page.waitForTimeout(100);return snap();};
  const waitAction=async kind=>{await frame.waitForFunction(k=>petDebug.snapshot().action===k,kind,{polling:60,timeout:10000});return snap();};
  const rest=async()=>{await frame.evaluate(()=>petDebug.play('emotion-default',0));await page.waitForTimeout(120);};
  await who('clap');await rest();assert.equal((await tap('hand','left')).action,'emotion-five-left');
  assert.equal((await tap('hand','right')).action,'emotion-five-left','wrong hand keeps invitation');await page.waitForTimeout(1100);assert.equal((await tap('hand','left')).action,'emotion-clap-left');await page.screenshot({path:out+'/'+mode+'-clap.png'});
  await who('miss');await rest();assert.equal((await tap('hand','right')).action,'emotion-five-right');await waitAction('emotion-peek');
  await who('head');await rest();assert.equal((await tap('head')).action,'emotion-headlook');await page.waitForTimeout(250);assert.equal((await tap('head')).action,'emotion-headpat');await page.waitForTimeout(250);assert.equal((await tap('head')).action,'emotion-headnest');await page.waitForTimeout(1100);const before=(await snap()).actionProgress;const continuing=await tap('head');assert.ok(continuing.actionProgress>=Math.min(.42,before)-.02,'continuous touch keeps pose progress');await page.screenshot({path:out+'/'+mode+'-headnest.png'});
  await who('other');await rest();assert.equal((await tap('head')).action,'emotion-headlook','character switch clears touch memory');
  await who('cross','irritated');await rest();assert.equal((await tap('head')).action,'emotion-dodge-left');await page.waitForTimeout(450);assert.equal((await tap('head')).action,'emotion-irritated');
  const lift=async()=>{const b=await frame.locator('canvas').boundingBox();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.65);await page.mouse.down();await page.waitForTimeout(520);assert.equal((await snap()).held,true);await page.mouse.up();await page.waitForTimeout(80);assert.equal((await snap()).action,'land');};
  await who('lift');await lift();await waitAction('emotion-tidy');await page.waitForTimeout(1500);await page.screenshot({path:out+'/'+mode+'-tidy.png'});await waitAction('emotion-happy');await lift();await waitAction('emotion-crossarms');
  await who('cancel');await lift();await frame.evaluate(()=>postMessage({type:'pet-act',kind:'sleep'},'*'));await page.waitForTimeout(5000);assert.equal((await snap()).sleeping,true,'sleep cancels tidy follow-up');
  // Backgrounding clears short interaction memory and the pending landing sequence.
  await who('visibility');await rest();await tap('head');await frame.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const stopped=await frame.evaluate(()=>petDebug.frames);await page.waitForTimeout(180);assert.equal(await frame.evaluate(()=>petDebug.frames),stopped);await frame.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(150);await rest();assert.equal((await tap('head')).action,'emotion-headlook');
  // A second pointer cannot release the first; hiding/switching cancels a pending hold.
  const pointer=async(type,id=31,primary=true)=>frame.evaluate(({type,id,primary})=>dispatchEvent(new PointerEvent(type,{pointerId:id,isPrimary:primary,clientX:30,clientY:65})),{type,id,primary});
  await pointer('pointerdown');await page.waitForTimeout(520);assert.equal((await snap()).held,true);await pointer('pointerup',32,false);assert.equal((await snap()).held,true,'secondary pointer cannot release hold');await pointer('pointercancel');assert.equal((await snap()).held,false);
  await pointer('pointerdown');await who('cancel-pending');await page.waitForTimeout(520);assert.equal((await snap()).held,false,'character switch cancels long-press timer');await pointer('pointerup');
  await pointer('pointerdown');await frame.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(520);assert.equal((await snap()).held,false,'background cancels long-press timer');await frame.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await pointer('pointerup');
  assert.deepEqual(errors,[]);report.push({mode,width,height,highFive:'same hand / miss / wrong hand',head:'3 steps / continuity / mood / character+background reset',lift:'land / tidy / mood / repeat / sleep interruption',errors});await page.close();
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
