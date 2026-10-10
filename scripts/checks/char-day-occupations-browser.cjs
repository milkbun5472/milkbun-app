// Physical tools on the original Draco doll, followed by the actual App and writer.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=process.env.DAY_ENGINE||'webkit',base=process.env.DAY_URL||'http://127.0.0.1:18989',out=process.env.DAY_EVIDENCE||'/tmp/char-day-occupations';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1000,height:800}}),errors=[];try{
 p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base+'/apps/companion/');
 const report=await p.evaluate(async()=>{
  const T=await import('three'),{loadTravelerSource,createTraveler}=await import('../fairy-garden/traveler.mjs'),{OUTFITS}=await import('../fairy-garden/wardrobe.mjs'),{DAY_PLACES,DAY_FACTORIES}=await import('../fairy-garden/day/places/index.mjs'),{activityPhase,taskAt}=await import('../fairy-garden/day/workflow.mjs'),{dailyTaskPose}=await import('../fairy-garden/daily-motion.mjs');
  const source=await loadTravelerSource(),catalog=await(await fetch('../fairy-garden/doll.json')).json(),avatar=createTraveler(source,true,{hair:'korean'});await avatar.ready();const variants=[{},Object.fromEntries(catalog.dims.map(x=>[x.key,x.min])),Object.fromEntries(catalog.dims.map(x=>[x.key,x.max]))],contacts=[],controls=[];let clock=0;
  for(const outfit of Object.keys(OUTFITS))for(const dims of variants){avatar.setLook({outfit,dims},true);await avatar.ready();
   for(const [id,key,toolName,len]of [['dayInvestigation','notes','WorkPencil',.21],['dayInvestigation','clues','WorkMarker',.17],['dayFilm','makeup','MakeupBrush',.18],['dayService','cook','CookingLadle',.24],['dayService','prep','PreparationKnife',.21]]){
    const map=DAY_PLACES[id],spot=map.spots.find(s=>s.id===key),origin=spot.seat||spot.target,stage=activityPhase({map:id,spot:key,action:spot.action},null,null,{preview:true});avatar.root.rotation.y=spot.heading;let task;
    for(let i=0;i<90;i++){avatar.root.position.set(origin.x,0,origin.z);task=taskAt(stage,spot,map,i*.025);avatar.animate(clock+=.04,{gesture:'rest',task,seated:!!spot.seat,seatPose:spot.seat?.pose,height:map.floor+(spot.seat?.rise||0)+(spot.seat?.rise?.05:0)});}
    avatar.root.updateMatrixWorld(true);const tool=avatar.root.getObjectByName(toolName),tip=tool.localToWorld(new T.Vector3(0,-len,0)),contact=new T.Vector3(task.contact.x,task.contact.y,task.contact.z),pose=task.daily?dailyTaskPose(task):{};
    if(key==='cook'){contact.x+=pose.dx||0;contact.z+=pose.dz||0;}if(key==='prep')contact.y+=pose.dy||0;
    const hand=new T.Box3().setFromObject(avatar.root.getObjectByName('Right_hand'),true).getCenter(new T.Vector3()),error=tip.distanceTo(contact),distance=hand.distanceTo(contact);
    if(!tool.visible||error>.018||distance>.42)throw Error(JSON.stringify({outfit,dims,id,key,visible:tool.visible,error,distance,hand:hand.toArray(),contact:contact.toArray()}));
    contacts.push({outfit,dims,id,key,error,distance});
   }
   for(const [id,key]of [['dayService','coffee'],['dayFilm','camera'],['dayBroadcast','mix']]){
    const map=DAY_PLACES[id],spot=map.spots.find(s=>s.id===key),origin=spot.seat||spot.target,stage=activityPhase({map:id,spot:key,action:spot.action},null,null,{preview:true});avatar.root.rotation.y=spot.heading;let task;
    for(let i=0;i<90;i++){avatar.root.position.set(origin.x,0,origin.z);task=taskAt(stage,spot,map,i*.025);avatar.animate(clock+=.04,{gesture:'rest',task,seated:!!spot.seat,seatPose:spot.seat?.pose,height:map.floor+(spot.seat?.rise||0)+(spot.seat?.rise?.05:0)});}
    avatar.root.updateMatrixWorld(true);const hand=new T.Box3().setFromObject(avatar.root.getObjectByName('Right_hand'),true).getCenter(new T.Vector3()),contact=new T.Vector3(task.contact.x,task.contact.y,task.contact.z),distance=hand.distanceTo(contact);
    if(distance>.17)throw Error(JSON.stringify({id,key,outfit,dims,distance,hand:hand.toArray(),contact:contact.toArray()}));controls.push({id,key,outfit,dims,distance});
   }
  }
  const fixtures=[];for(const id of ['dayInvestigation','dayService','dayFilm','dayBroadcast']){const map=DAY_PLACES[id],root=DAY_FACTORIES[id]().root;root.updateMatrixWorld(true);for(const s of map.spots.filter(s=>s.seat)){const piece=map.furniture.find(p=>p.id===s.seat.piece);if(s.seat.pose!=='chair')throw Error('Missing natural chair pose '+s.id);const ray=new T.Raycaster(new T.Vector3(piece.x,2,piece.z),new T.Vector3(0,-1,0)),hit=ray.intersectObject(root,true).find(h=>h.point.y<=.533);if(Math.abs(hit.point.y-.53)>.003)throw Error('Seat surface '+s.id);fixtures.push({id,key:s.id,y:hit.point.y});}}
  return {contacts,controls,fixtures};
 });
 if(process.env.DAY_RIG_ONLY){assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,errors,...report},null,2));console.log(JSON.stringify({ok:true,engine,contacts:report.contacts.length,controls:report.controls.length,seats:report.fixtures.length}));return;}
 const app=fs.readFileSync(path.join(process.cwd(),'js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),z=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&z>a);
 const cases=[
  ['梳理调查线索','刑侦办案室','dayInvestigation','clues','investigate'],['整理当日案卷','警局','dayInvestigation','notes','write'],
  ['切配备菜','餐厅后厨','dayService','prep','prep'],['灶台炒菜','餐厅后厨','dayService','cook','cook'],['制作咖啡','咖啡馆吧台','dayService','coffee','barista'],['调制饮品','酒吧吧台','dayService','mix','shake'],['出餐','餐厅','dayService','serve','serve'],
  ['补妆','化妆间','dayFilm','makeup','makeup'],['候场看台本','片场','dayFilm','script','read'],['拍戏表演','摄影棚','dayFilm','perform','act'],['模特棚拍','影棚','dayFilm','pose','pose'],['机后掌镜','摄影棚','dayFilm','camera','camera'],['摄影师棚拍','摄影棚','dayFilm','camera','camera'],['制作早餐','后厨','dayService','cook','cook'],['准备午餐','餐厅后厨','dayService','cook','cook'],
  ['配音录制','配音棚','dayBroadcast','voice','voice'],['录歌','录音室','dayBroadcast','sing','sing'],['监听混音','录音棚','dayBroadcast','mix','console'],['开播聊天','直播间','dayBroadcast','stream','stream'],['游戏实况直播','直播间','dayBroadcast','stream','type'],['剪辑素材','直播工作室','dayBroadcast','edit','type'],
  ['在家直播','家里','dayHome',null,null],['喝咖啡','街角咖啡馆','dayCafe','tea','drink'],['处理邮件','公司办公室','dayOffice','computer','type'],['上课听讲','教学楼教室','dayCampus','listen','listen']
 ];
 await p.setViewportSize({width:390,height:844});await p.unroute('**/pet.mjs*');await p.clock.setFixedTime(new Date('2026-10-09T00:04:00Z'));await p.goto(base);await p.waitForFunction(()=>window.CharDayLink&&typeof txtVaultState==='function'&&txtVaultState().ok);
 await p.evaluate(async({writer,cases})=>{
  const chars=[{id:'occupation-a',name:'职业日程测试角色',gender:'male',tz:'0',persona:'虚构角色，按当天的具体安排做事。'}];let plans={};const ref={current:plans},save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,saveJSON);
  const timeAt=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  save(chars[0].id,'2026-10-09',{seqs:cases.map(([title,location],index)=>({time:timeAt(index*30),end:timeAt((index+1)*30),title,location,type:title==='喝咖啡'?'coffee':'work'}))});
  const features=Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(id=>[id,{global:false,chars:{}}]));
  for(const [k,v]of Object.entries({x_characters:chars,x_schedules:ref.current,x_homeLayout:{'0':['fairyGarden']},x_homeFolders:[],x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features},x_companion:{charId:chars[0].id,autoFace:true,float:false,looks:{[chars[0].id]:{outfit:'academy',hair:'korean'}}}}))await saveJSONDurable(k,v);
 },{writer:app.slice(a,z),cases});
 await p.reload();await p.locator('#qiu-splash button').click();await p.locator('#qiu-splash').waitFor({state:'hidden'});await p.evaluate(()=>{window.sceneModels=0;window.callAI=()=>{sceneModels++;throw Error('Unexpected AI');};window.sceneWrites=[];const original=saveJSON;window.saveJSON=(k,...args)=>{sceneWrites.push(k);return original(k,...args);};});
 await p.locator('[data-appkey=fairyGarden]').click();await p.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await p.locator('[data-wk=cdaypick]').filter({hasText:'职业日程测试角色'}).click();await p.waitForFunction(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect().ready);
 const frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/')),before=await p.evaluate(()=>JSON.stringify(loadJSON('x_schedules',{})));report.schedules=[];
 for(const [hour,[title,location,map,spot,kind]]of cases.entries()){
  const now=new Date('2026-10-09T00:00:00Z');now.setUTCMinutes(hour*30+4);await p.clock.setFixedTime(now);
  await p.waitForFunction(({title,location})=>{const text=document.querySelector('[data-wk=cdaynow]')?.textContent||'';return text.includes(title)&&text.includes(location);},{title,location});
  await frame.waitForFunction(({map,spot,kind})=>{const s=CharDayScene.inspect();return s.map===map&&!s.changing&&!s.route.length&&(!spot||s.activity?.spot===spot)&&(!kind||s.workAction?.kind===kind);},{map,spot,kind});
  if(['makeup','investigate','shake','serve'].includes(kind))await frame.waitForFunction(flag=>CharDayScene.inspect().workAction?.[flag],{makeup:'makeup',investigate:'marker',shake:'shaker',serve:'tray'}[kind]);
  if(kind==='cook')await frame.waitForFunction(()=>CharDayScene.inspect().dailyAction?.ladle);
  const state=await frame.evaluate(()=>CharDayScene.inspect());assert.match(await p.locator('[data-wk=cdaynow]').innerText(),new RegExp(title));assert.match(await p.locator('[data-wk=cdaynow]').innerText(),new RegExp(location));if(['dayInvestigation','dayService','dayFilm','dayBroadcast'].includes(map))assert.equal(state.visitor.present,false);
  await p.screenshot({path:path.join(out,'schedule-'+hour+'-'+map+'.png')});report.schedules.push({hour,title,location,map,spot,kind,actual:state.activity,workAction:state.workAction,dailyAction:state.dailyAction,sceneAction:state.sceneAction});
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_schedules',{}))),before);assert.equal(await p.evaluate(()=>sceneModels),0);assert.deepEqual(await p.evaluate(()=>sceneWrites.filter(k=>/^x_(?:schedules|chat(?::|$)|fairyGardenSaves)/.test(k))),[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,errors,...report},null,2));console.log(JSON.stringify({ok:true,engine,contacts:report.contacts.length,controls:report.controls.length,seats:report.fixtures.length,schedules:report.schedules.length}));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:await p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect()).catch(()=>null)},null,2));throw e;}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
