// Real writer -> host page -> actual WebGL scene, with current schedule time.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const engine=(process.env.DAY_ENGINE==='chrome'?'chromium':process.env.DAY_ENGINE)||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-activity-groups';fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=source.indexOf('  const saveSchedDay ='),b=source.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=source.slice(a,b);
const cases=[
 ['dayHome','read',[[2,'read'],[7.5,'tea'],[9.2,'rest'],[9.8,'read']]],
 ['dayWork','work',[[2,'work'],[11,'read'],[12.3,'rest'],[13.3,'work']]],
 ['dayCafe','meal',[[2,'meal'],[5.3,'tea'],[5.8,'rest']]],
 ['dayStreet','walk',[[2,'walk'],[4.5,'rest'],[5.8,'walk']]],
 ['dayLaboratory','bench',[[2,'bench'],[8.2,'observation'],[10.2,'records'],[12,'break']]],
 ['dayLibrary','window-reading',[[2,'window-reading'],[14,'choose-book'],[15.8,'window-reading']]],
 ['dayClinic','casework',[[2,'casework'],[11,'handoff'],[16,'rest']]],
 ['dayStudio','easel',[[2,'easel'],[10,'gallery'],[14,'rest']]],
 ['dayRehearsal','piano',[[2,'piano'],[14,'score'],[16,'rest']]],
 ['dayStation','waiting',[[2,'waiting'],[14,'reading'],[16,'information']]],
 ['dayGym','weights',[[2,'weights'],[9.75,'stretch'],[11.75,'rest']]],
 ['dayMarket','produce',[[2,'produce'],[5,'groceries'],[8,'cold'],[9.75,'rest']]],
 ['dayOffice','computer',[[2,'computer'],[14,'notes'],[16,'tea']]],
 ['dayCampus','listen',[[2,'listen'],[12,'notes'],[15,'rest']]],
 ['dayInvestigation','clues',[[2,'clues'],[10,'notes'],[12,'rest']]],
 ['dayService','cook',[[2,'cook'],[12,'prep'],[14,'wash'],[15,'rest']]],
 ['dayFilm','perform',[[2,'perform'],[12,'script'],[14,'rest']]],
 ['dayBroadcast','voice',[[2,'voice'],[12,'script'],[14,'rest']]],
 ['dayLegal','draft',[[2,'draft'],[14,'rest']]],
 ['dayTraining','patrol',[[2,'patrol'],[4,'checkpoint'],[6,'patrol'],[8,'rest']]],
 ['dayWorkshop','repair',[[2,'repair'],[12,'test'],[14,'rest']]],
 ['dayFarm','records',[[2,'records'],[14,'rest']]],
 ['dayFleaMarket','fabric',[[2,'fabric'],[7,'antiques'],[10,'rest']]],
 ['dayStudy','read',[[2,'read'],[14,'rest']]]
];
const bathroomCases=[
 ['dayHome','read',[[5.9,'read'],[6.1,'toilet'],[6.6,'wash-hands'],[7.1,'tea'],[51.1,'toilet'],[51.6,'wash-hands'],[52.1,'read']]],
 ['dayHome','rest',[[14.1,'shower'],[14.8,'rest'],[59.1,'rest']]],
 ['dayHome','meal',[[.1,'wash-hands'],[.6,'meal']]],
 ['dayHome','cook',[[.1,'wash-hands'],[.6,'cook']]],
 ['dayHome','toilet',[[.1,'toilet'],[.6,'wash-hands'],[1.1,'rest'],[180,'rest']]],
 ['dayHome','shower',[[.1,'shower'],[.8,'rest'],[180,'rest']]],
 ['dayHome','wash-hands',[[.1,'wash-hands'],[.6,'rest'],[180,'rest']]]
];
(async()=>{
 const repo=process.cwd(),server=process.env.DAY_URL?null:http.createServer((req,res)=>{const file=path.resolve(repo,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}}).listen(0,'127.0.0.1');
 if(server)await new Promise(r=>server.on('listening',r));const base=process.env.DAY_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],report={engine,cases:[],layouts:[]},worldUrls=new Map();let frame;
try{
 p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/\/world\.mjs\?/.test(r.url()))worldUrls.set(r.frame(),r.url());});await p.clock.setFixedTime(new Date('2026-10-10T10:02:00Z'));await p.goto(base);await p.waitForFunction(()=>window.CharDayApp&&typeof txtVaultState==='function'&&txtVaultState().ok);
 await p.evaluate(writer=>{
  let plans={};window.groupsRef={current:plans};window.groupsWrites=[];window.groupsBootWrites=[];window.groupsCalls=0;
  const save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>plans=fn(plans),groupsRef,(key,...args)=>saveJSON(key,...args));
  window.groupsPlan=(scene,spot,manual=false)=>save('groups-a','2026-10-10',{seqs:[{seq:1,time:'10:00',end:'14:00',title:'按原安排做事',location:'测试地点',type:'work',world:{scene,spot,...(manual?{manual:true}:{})}}]});groupsPlan('dayHome','read');
  const original=saveJSON;window.saveJSON=(key,...args)=>{(/^x_charDayHomes$|^x_schedules$|^x_chat:|calendar/i.test(key)?groupsWrites:groupsBootWrites).push(key);return original(key,...args);};window.callAI=()=>{groupsCalls++;throw Error('Unexpected model call');};
  // Prevent unrelated automatic pair gestures from obscuring the host anchor.
  const load=loadJSON;window.loadJSON=(key,fallback)=>key==='x_charDayHomes'?{socialPreferences:{'groups-a':{autoInteractions:false}}}:load(key,fallback);
  const el=document.createElement('div');el.id='activity-groups-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);
  window.groupsMount=()=>{window.groupsRoot=ReactDOM.createRoot(el);groupsRoot.render(React.createElement(CharDayApp,{initialCharId:'groups-a',characters:[{id:'groups-a',name:'活动组验收',gender:'male',tz:'0'}],plansFor:c=>groupsRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',hairColor:'#43352e'}),visitorFor:()=>({id:'fixture-me',look:{outfit:'ranger',hair:'long'}}),taFor:()=> '他',onBack:()=>{groupsRoot.unmount();el.innerHTML='<button id="groups-return">重新进入</button>';el.querySelector('button').onclick=()=>{el.innerHTML='';groupsMount();};},build:'activity-groups-browser'}));};groupsMount();
 },writer);
 const root=p.locator('#activity-groups-root');
 async function ready(){await p.waitForFunction(()=>document.querySelector('#activity-groups-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/'));await frame.waitForFunction(()=>!CharDayScene.inspect().changing&&CharDayScene.inspect().visible);}
 const state=()=>frame.evaluate(()=>CharDayScene.inspect());await ready();
 async function sampleRoute(){return frame.evaluate(async url=>{
  const {walkable,segmentClear,MAPS}=await import(url),map=CharDayScene.inspect().map;
  return new Promise((resolve,reject)=>{let last=null,n=0,moved=false;const start=performance.now();function sample(){const s=CharDayScene.inspect();n++;if(!walkable(s.position.x,s.position.z,map))return reject(Error('Entered furniture '+map));if(last){if(!segmentClear(last,s.position,map))return reject(Error('Crossed furniture '+map));moved||=Math.hypot(last.x-s.position.x,last.z-s.position.z)>.001;}last=s.position;
   if(!s.route.length&&!s.changing)return resolve({frames:n,moved});if(s.activity.stroll||s.activity.action==='walk'){if(n>=120)return resolve({frames:n,moved,walking:true});}
   if(performance.now()-start>30000)return reject(Error('Unfinished route '+map));requestAnimationFrame(sample);}sample();});
 },worldUrls.get(frame));}
 for(const [scene,primary,steps]of (process.env.DAY_BATH_GROUPS==='1'?bathroomCases:cases).filter(c=>(!process.env.DAY_SCENES||process.env.DAY_SCENES.split(',').includes(c[0]))&&(!process.env.DAY_PRIMARY||process.env.DAY_PRIMARY.split(',').includes(c[1])))){
  await p.clock.setFixedTime(new Date('2026-10-10T10:02:00Z'));await p.evaluate(({scene,primary})=>groupsPlan(scene,primary),{scene,primary});await frame.waitForFunction(scene=>{const s=CharDayScene.inspect();return s.map===scene&&!s.changing;},scene);
  const before=await p.evaluate(()=>({plans:JSON.stringify(groupsRef.current),writes:groupsWrites.length}));
  for(const [minute,spot]of steps){
   await p.clock.setFixedTime(new Date(Date.parse('2026-10-10T10:00:00Z')+minute*60000));await frame.waitForFunction(({scene,spot})=>{const s=CharDayScene.inspect();return s.map===scene&&s.activity.spot===spot&&!!s.activity.group&&!s.changing;},{scene,spot});
   const route=await sampleRoute();
   if(['toilet','wash-hands','shower'].includes(spot))await frame.waitForFunction(spot=>{const s=CharDayScene.inspect();return s.hostChore?.kind===spot&&s.hostChore.contact?.kind===spot&&s.hostChore.contact.elapsed>1;},spot);
   await p.waitForTimeout(300);const s=await state();
   if(['toilet','wash-hands','shower'].includes(spot)){assert.equal(s.hostChore.manual,false);assert.equal(s.hostChore.contact.kind,spot);assert.equal(s.task,null);if(spot==='toilet')assert.ok(s.hostChore.contact.seated&&Math.abs(s.hostChore.contact.leg)>1.2);if(spot==='wash-hands'){assert.ok(s.hostChore.contact.water);assert.ok(s.hostChore.contact.contact<.20&&s.hostChore.contact.leftContact<.20);}if(spot==='shower')assert.ok(s.hostChore.contact.water&&s.hostChore.contact.curtain);assert.ok((await root.locator('[data-wk=cdaynow]').innerText()).includes(s.activity.phaseLabel));}
   else assert.equal(s.hostChore,null);assert.equal(s.activity.spot,spot);assert.equal(s.render.activeMaps.length,1);assert.equal(s.markersVisible,false);if(s.activity.phase==='break')assert.equal(s.task,null);
   if(s.activity.standing||s.activity.stroll)assert.equal(s.seat,null);assert.ok(s.avatarPosition.every(Number.isFinite));assert.equal(await p.evaluate(()=>JSON.stringify(groupsRef.current)),before.plans);assert.equal(await p.evaluate(()=>groupsWrites.length),before.writes);
   if(process.env.DAY_SHOTS==='1')await p.screenshot({path:path.join(out,scene+'-'+primary+'-'+spot+'-'+String(minute).replace('.','_')+'.png')});
   report.cases.push({scene,primary,minute,spot,route,state:s});
  }
  await p.screenshot({path:path.join(out,scene+'-'+primary+'.png')});console.log(scene+'/'+primary+' '+steps.length+' phases passed');
 }
 if(process.env.DAY_BATH_GROUPS==='1'){
  await p.clock.setFixedTime(new Date('2026-10-10T10:05:00Z'));await p.evaluate(()=>groupsPlan('dayHome','read'));
  await frame.waitForFunction(()=>CharDayScene.inspect().activity.spot==='read'&&!CharDayScene.inspect().route.length);
  await frame.evaluate(async()=>{if(!CharDayScene.inspect().visitor.present)await CharDayScene.joinVisit();CharDayScene.visitAction('manual');});
  assert.equal(await frame.evaluate(()=>CharDayScene.visitAction('chore:ta:shower')),true);
  await frame.waitForFunction(()=>CharDayScene.inspect().hostChore?.contact?.kind==='shower'&&CharDayScene.inspect().hostChore.contact.elapsed>1&&CharDayScene.inspect().hostChore.contact.elapsed<7);
  const before=await state();await p.clock.setFixedTime(new Date('2026-10-10T10:06:06Z'));
  await frame.waitForFunction(()=>CharDayScene.inspect().activity.spot==='toilet');
  assert.equal((await state()).hostChore.manual,true);assert.equal((await state()).hostChore.kind,'shower');
  await root.locator('[data-wk=cdaymoreopen]').click();await p.waitForTimeout(500);await root.locator('[data-wk=cdaymore]').getByRole('button',{name:'回到小世界',exact:true}).click();await ready();
  const after=await state();assert.equal(after.hostChore.kind,'shower');assert.equal(after.hostChore.manual,true);assert.ok(after.hostChore.elapsed>=before.hostChore.elapsed);report.manualOverride=true;report.menuRetainsCare=true;
  await frame.evaluate(()=>CharDayScene.visitAction('end'));await frame.waitForFunction(()=>CharDayScene.inspect().hostChore?.kind==='toilet'&&!CharDayScene.inspect().hostChore.manual);report.resumesLatestGroup=true;
 }
 // Manual location and sleep keep their direct poses across long slots.
 for(const [scene,spot,manual]of [['dayLibrary','window-reading',true],['dayHome','sleep',false]]){
  await p.evaluate(({scene,spot,manual})=>groupsPlan(scene,spot,manual),{scene,spot,manual});for(const minute of [30,80,180]){await p.clock.setFixedTime(new Date(Date.parse('2026-10-10T10:00:00Z')+minute*60000));await frame.waitForFunction(({scene,spot})=>{const s=CharDayScene.inspect();return s.map===scene&&s.activity.spot===spot&&!s.changing&&!s.route.length;},{scene,spot});const s=await state();assert.equal(s.activity.group,undefined);if(spot==='sleep')assert.ok(s.bed);report.cases.push({scene,spot,minute,manual,state:s});}
 }
 await p.clock.setFixedTime(new Date('2026-10-10T10:08:00Z'));await p.evaluate(()=>groupsPlan('dayWork','work'));await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.map==='dayWork'&&!s.route.length&&!s.changing;});
 for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){await p.setViewportSize({width:w,height:h});const q=await root.evaluate(el=>{const get=k=>el.querySelector('[data-wk='+k+']').getBoundingClientRect().toJSON(),page=el.querySelector('[data-wk=cdaypage]');return {overflow:page.scrollWidth-page.clientWidth,head:get('head'),now:get('cdaynow'),tools:get('cdaytools')};});assert.ok(q.overflow<=1&&q.now.right<=w+.5&&q.now.bottom<q.tools.top&&Math.abs(q.tools.bottom-h)<1);await p.screenshot({path:path.join(out,'layout-'+w+'x'+h+'.png')});report.layouts.push({w,h,q});}
 assert.equal(await p.evaluate(()=>groupsCalls),0);assert.deepEqual(errors,[]);report.errors=errors;report.backgroundBootWrites=await p.evaluate(()=>groupsBootWrites);report.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,engine,cases:report.cases.length,layouts:report.layouts.length}));
}catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.message,errors,state:frame?await stateSafe(frame):null,cases:report.cases},null,2));throw e;}finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function stateSafe(frame){return frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null);}
