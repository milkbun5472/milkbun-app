const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18939',out=process.env.COMPANION_EVIDENCE||'/tmp/companion-gentle';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:700}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/apps/companion/');await page.waitForFunction(()=>window.petDebug);await page.evaluate(()=>petDebug.ready());
 await page.evaluate(()=>addEventListener('message',e=>{if(e.data?.type==='pet-poke')(window.pokes??=[]).push(e.data);}));
 const target=kind=>page.evaluate(kind=>petDebug.snapshot().targets.find(t=>t.kind===kind),kind);
 for(const mode of ['full','float']){
  if(mode==='float'){await page.goto(base+'/apps/companion/?mode=float');await page.waitForFunction(()=>window.petDebug);await page.evaluate(()=>petDebug.ready());}
  await page.waitForTimeout(300);await page.evaluate(()=>petDebug.play('emotion-default',1));await page.waitForTimeout(100);
  let head=await target('head');assert.ok(head.visible);await page.mouse.click(head.x,head.y);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-headpat');if(mode==='full')assert.equal(await page.evaluate(()=>window.pokes?.length),1);
  await page.waitForTimeout(1000);await page.screenshot({path:out+'/headpat-'+mode+'.png'});
  await page.evaluate(()=>petDebug.play('emotion-chin',.4));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>petDebug.snapshot().emotion),'chin');await page.screenshot({path:out+'/chin-'+mode+'.png'});
  await page.evaluate(()=>petDebug.play('emotion-default',1));await page.waitForTimeout(150);let face=await target('face');await page.mouse.click(face.x-face.rx*.45,face.y);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-dodge-left');
  await page.evaluate(()=>petDebug.play('emotion-default',1));await page.waitForTimeout(150);head=await target('head');await page.mouse.move(head.x,head.y);await page.mouse.down();await page.mouse.move(head.x,head.y+30,{steps:5});await page.mouse.up();assert.notEqual(await page.evaluate(()=>petDebug.snapshot().action),'emotion-headpat');
  await page.mouse.move(head.x,head.y);await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'land');
  await page.evaluate(()=>postMessage({type:'pet-ctx',idle:true},'*'));await page.waitForTimeout(150);await page.evaluate(()=>postMessage({type:'pet-ctx',idle:false},'*'));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'wake');
 }
 await page.goto(base+'/apps/companion/');await page.waitForFunction(()=>window.petDebug);await page.evaluate(()=>petDebug.ready());await page.waitForTimeout(250);
 await page.mouse.move(190,350);await page.mouse.down();await page.mouse.move(504,350,{steps:12});await page.mouse.up();await page.waitForTimeout(150);assert.equal((await target('head')).visible,false);
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/touch.json',JSON.stringify({passed:true,modes:['full','float'],checks:['headpat','chin','face','drag','lift','wake','turned head']},null,2));console.log('PASS: gentle actions and touch regressions in full/floating modes');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
