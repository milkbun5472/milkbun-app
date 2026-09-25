const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto((process.env.TRAIN_BASE||'http://127.0.0.1:18924')+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp);
await p.evaluate(async()=>{const {freshState}=await import('./apps/fairy-garden/world.mjs');const g=freshState();const train={version:1,map:'carriage',day:4,startDay:4,minute:600,epoch:'t',distance:0,routeStart:0,photos:[],artworks:[]};
 saveJSON('x_fairyGarden:voice-test',{version:1,id:'voice-save',partnerId:'p1',activeWorld:'train',world:g,worlds:{garden:g,train},journey:{},dialogs:{}});localStorage.removeItem('x_trainAutoTalk');localStorage.removeItem('x_fairyGardenVoice');
 window.said=[];window.ttsSpeak=async(line)=>{said.push(line);const c=new AudioContext();const buf=new Uint8Array(44+800);const v=new DataView(buf.buffer);const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};w(0,'RIFF');v.setUint32(4,36+800,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,800,true);return new Blob([buf],{type:'audio/wav'});};window.ttsWarm=()=>{};
 window.calls=[];callAI=async(a,sys)=>{calls.push(sys);return '{"reply":["第一句。","第二句。"],"action":{"kind":"none"}}';};
 const el=document.createElement('div');el.id='v-root';el.style.cssText='position:fixed;inset:0;z-index:999990;height:100dvh';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:voice-test',entryWorld:'train',characters:[{id:'p1',name:'同行测试',voiceId:'v1'}],active:{test:true},profile:{name:'测试'},toast:()=>{},onBack:()=>{}}));});
const root=p.locator('#v-root');await p.waitForFunction(()=>document.querySelector('#v-root iframe')?.contentWindow.TrainGame?.ready,null,{timeout:120000});const f=p.frames().find(f=>f.url().includes('/apps/train/'));
await root.getByRole('button',{name:'设置',exact:true}).click();
const auto=root.getByRole('switch',{name:'拼图时 TA 自己开口'}),voice=root.getByRole('switch',{name:'念出来'});
assert.equal(await auto.getAttribute('aria-checked'),'true');assert.equal(await voice.getAttribute('aria-checked'),'false');
await auto.click();await voice.click();assert.equal(await p.evaluate(()=>localStorage.getItem('x_trainAutoTalk')),'0');assert.equal(await p.evaluate(()=>localStorage.getItem('x_fairyGardenVoice')),'1');
const box=await auto.boundingBox();assert.ok(box.height>=40&&box.width>=40,'40px touch target');
await root.locator('[data-watch=back]').last().click();
// 念出来：TA 回的两句都念了
await f.locator('#open-chat').click();await f.locator('#desk-message').fill('你好');await f.locator('#desk-send').click();await f.waitForFunction(()=>!document.querySelector('#desk-send').disabled);
await p.waitForFunction(()=>said.length>=2,null,{timeout:20000});assert.deepEqual(await p.evaluate(()=>said.slice(0,2)),['第一句。','第二句。']);
assert.deepEqual(errors,[]);console.log('PASS train settings switches (auto talk default on, voice off, persisted, 40px), both reply lines read aloud in order');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
