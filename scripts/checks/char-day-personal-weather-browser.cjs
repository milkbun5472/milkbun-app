const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),base=process.env.DAY_URL||'http://127.0.0.1:18991';
const out=process.env.DAY_EVIDENCE||'/tmp/char-day-personal-weather/'+(process.env.DAY_ENGINE||'webkit');fs.mkdirSync(out,{recursive:true});
const {moreItem,closeMore,cameraView}=require(path.join(repo,'scripts/checks/char-day-ui-helpers.cjs'));
const app=fs.readFileSync(path.join(repo,'js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=app.slice(a,b);
const engine=process.env.DAY_ENGINE||'webkit',result={engine,scenes:[],widths:[],requests:[]};
(async()=>{
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 try{
  await page.clock.setFixedTime(new Date('2026-10-10T14:05:00Z'));await page.goto(base);await page.waitForFunction(()=>window.CharDayApp&&window.ReactDOM&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await page.evaluate(writer=>{
   window.personalChars=[{id:'personal-a',name:'木作师',persona:'木作手艺人，偏好暖木配色。',tz:'0',home:{lat:49,lng:-97}},{id:'personal-b',name:'另一位角色',persona:'机械维修师，喜欢清爽浅色。',tz:'0',home:{lat:49,lng:-97}}];
   let plans={};window.personalPlans={current:plans};const save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;');window.personalSave=save(fn=>{plans=fn(plans);},personalPlans,saveJSON);
   for(const c of personalChars)personalSave(c.id,'2026-10-10',{seqs:[{seq:1,time:'14:00',end:'16:00',title:'台前检修设备',location:'维修工坊',type:'work',world:{scene:'dayWorkshop',spot:'repair'}}]});
   window.personalWeatherCode=63;window.weatherCached=()=>({code:personalWeatherCode,dayCode:65,ts:Date.now()});
   window.personalWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{personalWrites.push(key);return original(key,...args);};window.personalModelCalls=0;window.callAI=()=>{personalModelCalls++;throw Error('Unexpected model call');};
   const el=document.createElement('div');el.id='personal-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.personalRoot=ReactDOM.createRoot(el);
   window.personalRender=id=>personalRoot.render(React.createElement(CharDayApp,{initialCharId:id||'personal-a',characters:personalChars,plansFor:c=>personalPlans.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean'}),taFor:()=> '他',onBack:()=>{},build:'personal-browser'}));personalRender();
  },writer);
  await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().map==='dayWorkshop');
  let frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));const state=()=>frame.evaluate(()=>CharDayScene.inspect());
  const first=await state();assert.equal(first.professional.display,'woodwork');assert.equal(first.professional.style,'warm');assert.equal(first.environment.kind,'rain');
  const builderNames=['laboratory','library','clinic','studio','rehearsal','station','gym','market','office','campus','investigation','service','film','broadcast','legal','training','workshop','study','farm','flea-market'];
  const builders=()=>[...new Set(requests.map(u=>new URL(u).pathname).filter(p=>builderNames.some(n=>p.endsWith('/day/places/'+n+'.mjs'))))];assert.equal(builders().length,1);assert.ok(builders()[0].endsWith('/workshop.mjs'));result.initialBuilders=builders();
  await moreItem(page,'cdayprofessionalopen');await page.getByLabel('职业场景陈设').selectOption('craft');await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().professional?.display==='craft');
  await page.getByLabel('职业场景配色').selectOption('ink');await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().professional?.style==='ink');
  for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
   await page.setViewportSize({width:w,height:h});const panel=page.locator('[data-wk=cdayprofessional]');
   assert.equal(await panel.locator('select').count(),3);const layout=await panel.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,bottom:el.getBoundingClientRect().bottom,viewport:innerHeight}));assert.ok(layout.scroll<=layout.width+1);assert.ok(layout.bottom<=layout.viewport+1);result.widths.push({w,h,...layout});await page.screenshot({path:path.join(out,'settings-'+w+'x'+h+'.png')});
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-wk=cdayprofessional] button').first().click();await closeMore(page);await cameraView(page,true);
  await page.screenshot({path:path.join(out,'workshop-handpicked.png')});
  await page.evaluate(()=>{personalRoot.unmount();personalRoot=ReactDOM.createRoot(document.getElementById('personal-root'));personalRender('personal-b');});
  await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().charId==='personal-b'&&document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().map==='dayWorkshop');frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));
  assert.equal((await state()).professional.display,'repair');assert.equal((await state()).professional.style,'clean');
  await page.evaluate(()=>{personalRoot.unmount();personalRoot=ReactDOM.createRoot(document.getElementById('personal-root'));personalRender('personal-a');});
  await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().charId==='personal-a'&&document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().map==='dayWorkshop');frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));assert.equal((await state()).professional.display,'craft');assert.equal((await state()).professional.style,'ink');result.manualPersistence=true;
  await moreItem(page,'cdayprofessionalopen');await page.getByLabel('职业场景陈设').selectOption('auto');await page.getByLabel('职业场景配色').selectOption('auto');await page.locator('[data-wk=cdayprofessional] button').first().click();await closeMore(page);await page.waitForFunction(()=>document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect().professional?.display==='woodwork');
  const before=await page.evaluate(()=>JSON.stringify(personalPlans.current));
  const choose=async(scene,spot,minute=845,code=63)=>{
   await page.clock.setFixedTime(new Date(Date.parse('2026-10-10T00:00:00Z')+minute*60000));
   await page.evaluate(({scene,spot,minute,code})=>{personalWeatherCode=code;personalSave('personal-a','2026-10-10',{seqs:[{seq:1,time:'00:00',end:'24:00',title:'核对当前工作',location:'当前地点',type:'work',world:{scene,spot}}]});}, {scene,spot,minute,code});
   await page.waitForFunction(scene=>{const s=document.querySelector('#personal-root iframe')?.contentWindow.CharDayScene?.inspect();return s?.map===scene&&!s.changing;},scene);
   frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));await page.waitForTimeout(1200);
  };
  for(const [scene,spot]of [['dayStudy','write'],['dayTraining','report'],['dayLegal','research'],['dayHome','read'],['dayStreet','walk'],['dayWorkshop','repair'],['dayFarm','records'],['dayFleaMarket','antiques']]){
   await choose(scene,spot);const s=await state();assert.deepEqual(s.render.activeMaps,[scene]);result.scenes.push({scene,environment:s.environment,quality:s.render.quality,load:s.render.load});
   if(scene==='dayStudy'||scene==='dayHome'){assert.ok(s.environment.windows>0);assert.equal(s.environment.kind,'rain');}
   if(scene==='dayTraining'||scene==='dayStreet')assert.equal(s.environment.outsideRain,true);
   await cameraView(page,true);await page.screenshot({path:path.join(out,scene+'-rain.png')});
  }
  result.daylight=[];for(const minute of [360,720,1110,1320]){await choose('dayHome','read',minute,63);const s=await state();result.daylight.push({minute,...s.environment});await cameraView(page,true);await page.screenshot({path:path.join(out,'home-'+minute+'.png')});}
  assert.ok(result.daylight.at(-1).lamps>0);assert.equal(result.daylight.at(-1).night,true);
  await page.evaluate(()=>{personalWeatherCode=0;});await page.waitForTimeout(1200);assert.equal((await state()).environment.kind,'clear');
  // Repeated real schedule changes preserve one active resource set.
  for(let i=0;i<8;i++)await choose(i%2?'dayLegal':'dayWorkshop',i%2?'research':'repair',845,0);
  const final=await state();assert.equal(final.render.activeMaps.length,1);result.final=final.render;
  result.readOnly=await page.evaluate(()=>({modelCalls:personalModelCalls,unexpectedWrites:personalWrites.filter(k=>k!=='x_schedules'&&k!=='x_charDayHomes')}));assert.equal(result.readOnly.modelCalls,0);assert.deepEqual(result.readOnly.unexpectedWrites,[]);
  result.errors=errors;assert.deepEqual(errors,[]);result.builders=builders();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(e){result.failure=e.stack;result.errors=errors;fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
