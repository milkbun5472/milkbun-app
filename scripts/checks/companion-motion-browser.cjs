const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.COMPANION_TEST_URL||'http://127.0.0.1:18938')+'/apps/companion/');await page.waitForFunction(()=>window.petDebug);
 const moods=['default','happy','amazed','cozy','relax','surprise','proud','gloomy','sad','irritated'];
 for(const face of moods){await page.evaluate(face=>postMessage({type:'pet-look',look:{face},ta:'Test'},'*'),face);await page.waitForTimeout(180);}
 for(const kind of ['wave','stretch','hop','jolt','nod','sigh','stomp','turn','look','shy','yawn','wake','land','tea','read','sit']){
  await page.evaluate(kind=>petDebug.play(kind,.4),kind);await page.waitForTimeout(100);
 }
 await page.evaluate(()=>{postMessage({type:'pet-ctx',screen:'study',music:true,idle:false},'*');petDebug.play('nod',.4);});
 await page.waitForTimeout(400);await page.screenshot({path:'/tmp/companion-natural.png'});
 await page.evaluate(()=>postMessage({type:'pet-ctx',idle:true},'*'));await page.waitForTimeout(150);await page.mouse.click(190,350);
 await page.goto((process.env.COMPANION_TEST_URL||'http://127.0.0.1:18938')+'/apps/companion/?mode=float');await page.waitForFunction(()=>window.petDebug);await page.mouse.click(190,350);
 assert.deepEqual(errors,[]);console.log('10 moods, 16 actions, context, wake/tap and floating renderer: passed');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
