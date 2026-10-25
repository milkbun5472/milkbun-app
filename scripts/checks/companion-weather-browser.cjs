const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946',out=process.env.COMPANION_EVIDENCE||'/tmp/companion-weather';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('js/companion.js','utf8'),engine=fs.readFileSync('js/engine.js','utf8'),components=fs.readFileSync('js/components.js','utf8');
function grab(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return s.slice(a,b);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const report={};for(const mode of ['full','float']){
  const page=await browser.newPage({viewport:{width:390,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-24T12:00:00')});
  await page.route('**/companion-weather-harness',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><div id="host"></div><script src="vendor/react.production.min.js"></script><script src="vendor/react-dom.production.min.js"></script>'}));
  await page.route('https://api.open-meteo.com/**',r=>r.fulfill({status:503,body:'offline fixture'}));await page.goto(base+'/companion-weather-harness');await page.addScriptTag({url:base+'/js/world-weather.js'});
  await page.addScriptTag({content:'window.h=React.createElement;for(const k of ["useState","useRef","useEffect"])window[k]=React[k];'+grab(engine,'function weatherCacheKey','function wxNowCode')+grab(engine,'function wxWetKind','function weatherLine')+grab(components,'function weatherPlaceList','function weatherRailLevels')+grab(components,'const weatherCurrentWatchers','function WeatherWidget(')+source.replace('window.CompanionFace =','window.CompanionHooks={usePetContext,PetFrame};window.CompanionFace =')});
  await page.evaluate(mode=>{
   const geo={lat:10,lng:20},characters=[{id:'c1',home:{city:'另一个地点',lat:30,lng:40}}],worlds=[{id:'w1',name:'测试世界',regions:[{name:'北岭',terrain:'山地'}]}];
   window.putWeather=(w,key='10.0,20.0')=>{const cache=JSON.parse(localStorage.getItem('wx_cache')||'{}');cache[key]={day:new Date().toDateString(),ts:Date.now(),t:20,code:0,isDay:false,windSpeed:0,...w};localStorage.setItem('wx_cache',JSON.stringify(cache));dispatchEvent(new CustomEvent('weather-place'));};
   putWeather({code:61});window.actions=[];addEventListener('message',e=>{if(e.data?.type==='pet-act')actions.push(e.data.kind);});
   function Host(){const [id,setId]=useState('c1'),[widget,setWidget]=useState(null),frame=useRef(null),ctx=CompanionHooks.usePetContext({geo,characters,worlds},'thread');window.resetCharacter=()=>setId('c'+Date.now());window.ctx=ctx;window.widget=widget;
    useEffect(()=>watchWeatherCurrent({key:'me',real:true,...geo},setWidget),[]);
    return h('div',{},h('button',{id:'active'},'在这里'),h('textarea',{id:'draft'}),h('output',{id:'weather'},widget?.weather?.code),h(CompanionHooks.PetFrame,{mode,frameRef:frame,msg:{type:'pet-look',characterId:id,ta:'TA',look:{outfit:'cardigan',hair:'bob',face:'cozy'}},ctx,style:{width:mode==='float'?180:390,height:mode==='float'?260:520}}));}
   ReactDOM.createRoot(document.getElementById('host')).render(h(Host));
  },mode);
  const frame=await(await page.waitForSelector('iframe')).contentFrame();await frame.waitForFunction(()=>window.petDebug,{},{timeout:60000,polling:100});await frame.evaluate(()=>petDebug.ready());
  const snap=()=>frame.evaluate(()=>petDebug.snapshot()),wait=()=>page.waitForTimeout(200),advance=async ms=>{await page.clock.fastForward(ms);await wait();};
  async function expectAction(kind){await frame.waitForFunction(k=>petDebug.snapshot().action===k,kind,{timeout:10000,polling:100});}
  await expectAction('emotion-catchrain');await advance(2300);assert.ok((await snap()).canopy>.9);assert.equal(await page.locator('#weather').textContent(),'61');
  await page.evaluate(()=>putWeather({code:0}));await expectAction('emotion-rainclose');await page.screenshot({path:out+'/'+mode+'-close.png'});await advance(4500);
  const cases=[['snow',{code:73},'catchsnow'],['cold',{code:3,t:2},'warmhands'],['hot',{code:3,t:33},'wipesweat'],['sun',{code:0,isDay:true},'shade'],['wind',{code:3,windSpeed:35},'wind'],['thunder',{code:95},'thunder']];
  for(const [name,weather,kind]of cases){await page.locator('#active').click();await page.evaluate(w=>{putWeather(w);resetCharacter();},weather);await expectAction('emotion-'+kind);await advance(2600);await page.screenshot({path:out+'/'+mode+'-'+name+'.png'});await advance(7000);}
  // A selected-city night remains night even though the device clock is noon.
  await page.evaluate(()=>{putWeather({code:0,isDay:false});resetCharacter();window.actions=[];});await advance(2000);assert.ok(!(await page.evaluate(()=>actions)).includes('emotion-shade'));
  // A fresh change waits behind chat, and keyboard focus blocks weather gestures.
  await frame.evaluate(()=>postMessage({type:'pet-act',kind:'emotion-heart'},'*'));await wait();await page.evaluate(()=>putWeather({code:73}));await wait();assert.equal((await snap()).action,'emotion-heart');await advance(6500);await expectAction('emotion-catchsnow');await advance(8500);
  await page.locator('#draft').focus();await page.evaluate(()=>putWeather({code:3,t:33}));await advance(100000);assert.equal((await snap()).context.typing,true);assert.notEqual((await snap()).action,'emotion-wipesweat');await page.locator('#active').focus();await expectAction('emotion-wipesweat');await advance(7000);
  // Failed refreshes never turn an expired rainy cache into a rain-stop cue.
  await page.evaluate(()=>{putWeather({code:61});resetCharacter();});await expectAction('emotion-catchrain');await advance(8500);
  await page.evaluate(()=>{putWeather({code:61,ts:Date.now()-1900000});window.actions=[];});await wait();assert.equal((await snap()).context.weather.known,false);await advance(3000);assert.ok(!(await page.evaluate(()=>actions)).some(k=>['emotion-rainclose','emotion-raindry'].includes(k)));
  // Changing station to a dry one is not rain stopping at the old station.
  await page.evaluate(()=>{putWeather({code:61});resetCharacter();});await expectAction('emotion-catchrain');await advance(8500);
  await page.evaluate(()=>{putWeather({code:0},'30.0,40.0');localStorage.setItem('x_weatherPlace','c:c1');window.actions=[];dispatchEvent(new CustomEvent('weather-place'));});await advance(3000);assert.equal((await snap()).context.weather.key,'c:c1');assert.ok(!(await page.evaluate(()=>actions)).some(k=>['emotion-rainclose','emotion-raindry'].includes(k)));
  assert.deepEqual(errors,[]);report[mode]={weather:cases.map(c=>c[0]),rainClose:true,sharedWidget:true,chatAndTyping:true,expiredAndStationChange:true};await page.close();
 }
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
