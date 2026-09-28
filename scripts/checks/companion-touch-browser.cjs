const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18938';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/apps/companion/');await page.waitForFunction(()=>window.petDebug);
 const look=async(look,id='one')=>{await page.evaluate(({look,id})=>postMessage({type:'pet-look',ta:'TA',characterId:id,look},'*'),{look,id});await page.waitForTimeout(550);};
 await look({outfit:'cardigan',face:'happy'});assert.notEqual(await page.evaluate(()=>petDebug.snapshot().action),'emotion-show');
 await page.evaluate(()=>petDebug.play('emotion-happy',1));await page.waitForTimeout(120);
 const target=async(kind,side)=>page.evaluate(({kind,side})=>petDebug.snapshot().targets.find(t=>t.kind===kind&&(!side||t.side===side)),{kind,side});
 for(const side of ['left','right']){
  await page.evaluate(()=>petDebug.play('emotion-happy',1));await page.waitForTimeout(120);
  let hand=await target('hand',side);await page.mouse.click(hand.x,hand.y);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-five-'+side);
  await page.waitForTimeout(1200);hand=await target('hand',side);
  await page.screenshot({path:'/tmp/companion-five-'+side+'.png'});
  await page.mouse.click(hand.x,hand.y);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-clap-'+side);
 }
 await page.evaluate(()=>petDebug.play('emotion-happy',1));await page.waitForTimeout(200);
 let face=await target('face');await page.mouse.click(face.x-face.rx*.45,face.y);await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-dodge-left');await page.screenshot({path:'/tmp/companion-dodge.png'});
 await look({outfit:'ranger',face:'happy'});await page.waitForFunction(()=>petDebug.snapshot().action==='emotion-show');await page.waitForTimeout(1600);await page.screenshot({path:'/tmp/companion-show.png'});
 await page.evaluate(()=>petDebug.play('emotion-happy',1));await look({outfit:'ranger',face:'sad'});assert.notEqual(await page.evaluate(()=>petDebug.snapshot().action),'emotion-show');
 await look({outfit:'academy',face:'sad'},'two');assert.notEqual(await page.evaluate(()=>petDebug.snapshot().action),'emotion-show');
 // 纵向拖动不能被当作戳脸；原来只算横向距离。
 face=await target('face');await page.mouse.move(face.x,face.y);await page.mouse.down();await page.mouse.move(face.x,face.y+35,{steps:5});await page.mouse.up();assert.ok(!String(await page.evaluate(()=>petDebug.snapshot().action)).startsWith('emotion-dodge'));
 // 改体型、旋转后目标位置随实际小人更新，背对时不把后脑当脸。
 await look({outfit:'cardigan',dims:{head:1.2,height:1.1},face:'happy'});await page.waitForTimeout(150);
 await page.mouse.move(190,350);await page.mouse.down();await page.mouse.move(504,350,{steps:12});await page.mouse.up();await page.waitForTimeout(120);assert.equal((await target('face')).visible,false);
 await page.goto(base+'/apps/companion/?mode=float');await page.waitForFunction(()=>window.petDebug);await page.waitForTimeout(300);const h=await target('hand','right');await page.mouse.click(h.x,h.y);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),'emotion-five-right');
 assert.deepEqual(errors,[]);console.log('PASS: both hands invite/confirm, face dodge, outfit-only showcase, identity/mood exclusion, vertical drag, turned face, floating touch');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
