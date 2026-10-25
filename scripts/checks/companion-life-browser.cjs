const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946',out=process.env.COMPANION_EVIDENCE||'/tmp/companion-life';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const report=[];
 for(const mode of ['full','float']){
 const page=await browser.newPage({viewport:{width:390,height:740}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/life-harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="host"></div><script src="vendor/react.production.min.js"></script><script src="vendor/react-dom.production.min.js"></script>'}));
 await page.goto(base+'/life-harness');await page.clock.setFixedTime(new Date('2026-10-24T22:00:00'));
 const source=fs.readFileSync('js/companion.js','utf8');
 await page.addScriptTag({content:'window.h=React.createElement;for(const k of ["useState","useRef","useEffect"])window[k]=React[k];window.store={};window.loadJSON=(k,d)=>store[k]??d;window.saveJSON=(k,v)=>{store[k]=v;return true;};'+source.replace('window.CompanionFace =','window.CompanionHooks={usePetContext,useChatAct,PetFrame};window.CompanionFace =')});
 await page.evaluate(mode=>{
 function Host(){const [state,setState]=useState({id:'c1',mood:'生气',phase:'awake',minute:1320,day:'2026-10-24',clock:true,key:0}),frame=useRef(null);window.setHarness=p=>setState(s=>({...s,...p}));window.harness=state;
 const char={id:state.id},props={characters:[char],companionRoutineFor:()=>({phase:state.phase,minute:state.minute,day:state.day,clock:state.clock,sleepUntil:Date.now()+8*3600000})};
 const ctx=CompanionHooks.usePetContext(props,'thread',char);CompanionHooks.useChatAct(char.id,frame);
 const msg=CompanionFace.petMessage(char,{[char.id]:{label:state.mood,ts:Date.now()}},{autoFace:false,looks:{[char.id]:{face:'happy',outfit:'cardigan',hair:'bob'}}});
 return h(CompanionHooks.PetFrame,{mode,frameRef:frame,msg,ctx,reloadKey:state.key,style:{width:mode==='full'?370:180,height:mode==='full'?620:260}});}
 ReactDOM.createRoot(document.getElementById('host')).render(h(Host));},mode);
 let frame;const ready=async()=>{frame=await(await page.waitForSelector('iframe')).contentFrame();await frame.waitForFunction(()=>window.petDebug,{},{timeout:60000});await frame.evaluate(()=>petDebug.ready());await page.waitForTimeout(150);};await ready();
 const snap=()=>frame.evaluate(()=>petDebug.snapshot()),change=async p=>{await page.evaluate(p=>setHarness(p),p);await page.waitForTimeout(70);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(150);};
 const chat=async said=>{await page.evaluate(said=>dispatchEvent(new CustomEvent('companion-chat',{detail:{charId:harness.id,act:'',said}})),said);await page.waitForTimeout(180);};
 const tap=async kind=>{await frame.evaluate(()=>petDebug.play('emotion-default',0));await page.waitForTimeout(80);const targets=(await snap()).targets;const target=targets.find(t=>t.kind===kind&&t.visible);assert.ok(target,kind+' visible');await frame.locator('canvas').click({position:{x:target.x,y:target.y}});await page.waitForTimeout(100);return (await snap()).action;};
 assert.equal((await snap()).look.face,'happy');assert.equal((await snap()).mood,'irritated');
 for(const kind of ['head','hand','face']){const action=await tap(kind);assert.ok(kind==='face'?action.startsWith('emotion-dodge-'):action==='emotion-irritated',mode+' '+kind+': '+action);}
 await change({mood:'难过'});for(const kind of ['head','hand','face'])assert.equal(await tap(kind),'emotion-sad',mode+' sad '+kind);
 const sad=await snap();assert.ok(sad.idleEvery>9&&sad.tempo<1);
 await change({mood:'开心'});assert.equal((await snap()).idleEvery,6);assert.equal(await tap('head'),'emotion-headpat');
 const lift=async mood=>{await change({mood});const box=await frame.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.6);await page.mouse.down();await page.waitForTimeout(520);assert.equal((await snap()).action,undefined);await page.mouse.up();await page.waitForTimeout(1300);return (await snap()).action;};
 assert.equal(await lift('生气'),'emotion-irritated');assert.equal(await lift('开心'),'emotion-happy');
 await chat('晚安');assert.equal((await snap()).sleeping,true);assert.equal(await page.evaluate(()=>store.x_companionLife.c1.sleeping),true);
 await change({key:1});await ready();assert.equal((await snap()).sleeping,true,'recreated iframe retains bedtime');
 // Another character must not inherit the sleeper, even for the first frame.
 await change({id:'c2'});assert.equal((await snap()).sleeping,false);await change({id:'c1'});assert.equal((await snap()).sleeping,true);
 await page.clock.setFixedTime(new Date('2026-10-25T08:00:00'));await change({day:'2026-10-25',minute:480});assert.equal((await snap()).sleeping,false);assert.equal((await snap()).action,'emotion-rubeyes');
 await change({phase:'asleep'});assert.equal((await snap()).sleeping,true);const box=await frame.locator('canvas').boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);await page.waitForTimeout(200);assert.equal((await snap()).sleeping,false);assert.equal(await page.evaluate(()=>store.x_companionLife.c1.sleeping),false);await change({minute:481});assert.equal((await snap()).sleeping,false,'poke override survives routine refresh');
 await change({phase:'awake'});await change({phase:'asleep'});assert.equal((await snap()).sleeping,true);await change({phase:'waking'});assert.equal((await snap()).action,'emotion-rubeyes');
 await page.screenshot({path:out+'/'+mode+'.png'});assert.deepEqual(errors,[]);report.push({mode,touch:'head/hand/face follow real mood',lift:'irritated/happy after landing',life:'bedtime/reload/character isolation/morning/schedule/poke override',errors});await page.close();
 }fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
