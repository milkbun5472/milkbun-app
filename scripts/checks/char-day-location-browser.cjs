// Exercise the actual App, original schedule writer, IndexedDB reload, and native scene.
const pw=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=process.env.DAY_ENGINE||'webkit',base=process.env.DAY_URL||'http://127.0.0.1:18931',out=process.env.DAY_EVIDENCE||'/tmp/char-day-location';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(process.cwd(),'js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),z=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&z>a);
(async()=>{
 const b=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:390,height:844}}),errors=[],report={engine,layouts:[]};
 try{
  p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await p.clock.setFixedTime(new Date('2026-10-09T03:00:00Z'));await p.goto(base);
  await p.waitForFunction(()=>window.CharDayKit&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await p.evaluate(async writer=>{
   const c={id:'location-test',name:'位置测试',gender:'male',tz:'0',persona:'按当天安排生活的虚构角色。'},other={id:'other-test',name:'另一位',tz:'0'};
   let plans={};const ref={current:plans},save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,saveJSON);
   const seqs=[{seq:1,time:'00:00',end:'04:00',title:'在面包房吃早饭',location:'面包房',type:'meal',world:{scene:'dayCafe',spot:'meal'},deviation:{plan:'回家',reason:'等她过来',actual:'在面包房吃早饭',world:{scene:'dayCafe',spot:'meal'}}},
    ...Array.from({length:7},(_,i)=>({seq:i+2,time:String(4+i*2).padStart(2,'0')+':00',end:i===6?'23:00':String(6+i*2).padStart(2,'0')+':00',title:'处理邮件 '+i,location:'公司办公室',type:'work'})),
    {seq:9,time:'23:00',end:'24:00',title:'歇下',location:'卧室',type:'sleep'}];
   save(c.id,'2026-10-09',{seqs,murmurs:[{time:'03:00',text:'留着这句'}],yesterdayMurmurs:[],generatedAt:123});save(c.id,'2026-10-10',{murmurs:[],yesterdayMurmurs:[],seqs:[{seq:1,time:'08:00',end:'10:00',title:'吃早饭',location:'家里',type:'meal'}]});
   save(other.id,'2026-10-09',{murmurs:[],yesterdayMurmurs:[],seqs:[{seq:1,time:'00:00',end:'24:00',title:'自己的事',location:'家里',type:'home'}]});
   const features=Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(id=>[id,{global:false,chars:{}}]));
   for(const [key,value]of Object.entries({x_characters:[c,other],x_schedules:ref.current,x_homeLayout:{'0':['fairyGarden']},x_homeFolders:[],x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features},x_companion:{charId:c.id,autoFace:true,float:false,looks:{[c.id]:{outfit:'academy',hair:'korean'}}}}))await saveJSONDurable(key,value);
  },app.slice(a,z));
  const enter=async()=>{
   if(await p.locator('#qiu-splash').isVisible()){await p.locator('#qiu-splash button').click();await p.locator('#qiu-splash').waitFor({state:'hidden'});}
   await p.evaluate(()=>{window.locationTestAI=0;window.callAI=()=>{locationTestAI++;throw Error('Unexpected AI');};});
   await p.locator('[data-appkey=fairyGarden]').click();await p.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await p.locator('[data-wk=cdaypick]').filter({hasText:'位置测试'}).click();
   await p.waitForFunction(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect().ready);
  };
  const scene=()=>p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.inspect());
  const waitAt=async(map,spot)=>p.waitForFunction(({map,spot})=>{const s=document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect();return s?.ready&&!s.changing&&s.map===map&&s.spot===spot;},{map,spot});
  const store=()=>p.evaluate(()=>JSON.parse(JSON.stringify(loadJSON('x_schedules',{}))));
  const choose=async(map,spot)=>{await p.locator('[data-wk=cdaypositionscene]').selectOption(map);await p.locator('[data-wk=cdaypositionspot][data-part="'+spot+'"]').click();await p.locator('[data-wk=cdaypositionsave]').click();await p.locator('[data-wk=cdaypositionpage]').waitFor({state:'hidden'});};
  await p.reload();await enter();const before=await store();await waitAt('dayCafe','meal');
  for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await p.setViewportSize(size);const initial=await p.locator('[data-wk=cdayscene] iframe').boundingBox();
   await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').click();
   const page=p.locator('[data-wk=cdaypositionpage]');await page.waitFor();
   const layout=await page.evaluate(el=>{const body=el.querySelector('[data-wk=cdaymenubody]'),head=el.querySelector('[data-wk=head]'),save=el.querySelector('[data-wk=cdaypositionsave]'),r=el.getBoundingClientRect(),hr=head.getBoundingClientRect(),br=body.getBoundingClientRect(),sr=save.getBoundingClientRect();return {width:r.width,height:r.height,headBottom:hr.bottom,bodyTop:br.top,bodyBottom:br.bottom,saveTop:sr.top,saveBottom:sr.bottom,overflow:el.scrollWidth>el.clientWidth,touch:Math.min(...[...el.querySelectorAll('button,select')].filter(q=>!q.closest('[data-wk=head]')).map(q=>q.getBoundingClientRect().height))};});
   assert.equal(layout.overflow,false);assert.ok(layout.bodyTop>=layout.headBottom-.5);assert.ok(layout.saveBottom<=size.height+1);assert.ok(layout.touch>=43.5);
   const paused=await scene();const nativePaused=await p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.pauseState());assert.ok(nativePaused);assert.equal(paused.error,'');
   assert.deepEqual(await p.locator('[data-wk=cdayscene] iframe').boundingBox(),initial);
   await page.locator('[data-wk=head] button').first().click();assert.deepEqual(await store(),before);report.layouts.push({...size,...layout});
  }
  await p.setViewportSize({width:390,height:844});await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').click();
  await p.locator('[data-wk=cdaypositionscene]').selectOption('dayLibrary');await p.locator('[data-wk=cdaypositionspot][data-part=window-reading]').click();
  await p.evaluate(()=>{window.scheduleSaveOriginal=saveJSON;window.saveJSON=(key,value)=>key==='x_schedules'?false:scheduleSaveOriginal(key,value);});
  await p.locator('[data-wk=cdaypositionsave]').click();await p.locator('[data-wk=cdaypositionpage] [role=status]').waitFor();assert.deepEqual(await store(),before);
  assert.equal(await p.locator('[data-wk=cdaypositionspot][data-part=window-reading]').getAttribute('aria-pressed'),'true');
  await p.evaluate(()=>{window.saveJSON=scheduleSaveOriginal;});await p.screenshot({path:path.join(out,'position-editor.png')});
  await p.locator('[data-wk=cdaypositionsave]').click();await p.locator('[data-wk=cdaypositionpage]').waitFor({state:'hidden'});await waitAt('dayLibrary','window-reading');
  let saved=await store();assert.deepEqual(saved['location-test']['2026-10-09'].seqs[0].world,{scene:'dayLibrary',spot:'window-reading',manual:true});
  for(const key of ['title','location','type','time','end','deviation'])assert.deepEqual(saved['location-test']['2026-10-09'].seqs[0][key],before['location-test']['2026-10-09'].seqs[0][key]);
  assert.deepEqual(saved['other-test'],before['other-test']);assert.deepEqual(saved['location-test']['2026-10-10'],before['location-test']['2026-10-10']);
  await p.screenshot({path:path.join(out,'manual-location.png')});
  await p.waitForFunction(async()=>await idbTxtGet("x_schedules")===JSON.stringify(loadJSON("x_schedules",{})));await p.reload();await enter();await waitAt('dayLibrary','window-reading');report.reload=await scene();
  await p.locator('[data-wk=cdayscheduleopen]').click();const body=p.locator('[data-wk=cdaybody]');await body.evaluate(el=>{el.scrollTop=260;el.dispatchEvent(new Event('scroll'));});const edit=p.locator('[data-wk=cdaypositionopen]').filter({hasText:'改位置'}).last();await edit.scrollIntoViewIfNeeded();const scroll=await body.evaluate(el=>el.scrollTop);
  await edit.click();await p.locator('[data-wk=cdaypositionpage]').waitFor();await choose('dayHome','rest');
  assert.equal(await body.evaluate(el=>el.scrollTop),scroll);await body.locator('[data-wk=cdayrow]').last().click();
  await waitAt('dayHome','rest');assert.match(await p.locator('[data-wk=cdaynow]').innerText(),/预览日程/);
  await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').click();await choose('dayHome','tea');await waitAt('dayHome','tea');
  await p.locator('[data-wk=cdayreturn]').click();await waitAt('dayLibrary','window-reading');
  await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').click();await p.locator('[data-wk=cdaypositionauto]').click();await p.locator('[data-wk=cdaypositionsave]').click();await waitAt('dayCafe','meal');
  saved=await store();assert.equal(saved['location-test']['2026-10-09'].seqs[0].world,undefined);assert.equal(saved['location-test']['2026-10-09'].seqs[0].deviation.world,undefined);
  await p.clock.setFixedTime(new Date('2026-10-09T04:10:00Z'));await p.waitForFunction(()=>document.querySelector('[data-wk=cdaynow]')?.textContent.includes('处理邮件 0'));
  await p.waitForFunction(()=>document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.inspect().map==='dayOffice');
  await p.clock.setFixedTime(new Date('2026-10-10T02:00:00Z'));await waitAt('dayHome','tea');
  await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').click();assert.match(await p.locator('[data-wk=cdaypositionpage]').innerText(),/2026-10-09/);await choose('dayHome','rest');await waitAt('dayHome','rest');
  await p.clock.setFixedTime(new Date('2026-10-10T08:20:00Z'));await waitAt('dayHome','meal');
  const beforeOuting=await store();await p.locator('[data-wk=cdaymoreopen]').click();await p.locator('[data-wk=cdayoutingsopen]').click();
  await p.locator('[data-wk=cdayoutingchoice][data-part=solo]').click();await p.locator('[data-wk=cdaydestination][data-part=dayGym]').click();
  await p.waitForFunction(()=>document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.inspect().map==='dayGym');
  assert.equal(await p.locator('[data-wk=cdaynow] [data-wk=cdaypositionopen]').count(),0);assert.deepEqual(await store(),beforeOuting);
  await p.locator('[data-wk=cdayoutingreturn]').click();await waitAt('dayHome','meal');assert.deepEqual(await store(),beforeOuting);
  assert.equal(await p.evaluate(()=>locationTestAI),0);assert.deepEqual(errors,[]);report.ok=true;report.schedules=await store();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,engine,layouts:report.layouts.length,reload:report.reload.map,errors}));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
