const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'chromium',out=process.env.DAY_EVIDENCE||'/tmp/char-day-workflows';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=app.slice(a,b);
(async()=>{
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],requests=[],worldUrls=new Map(),travelerUrls=new Map(),result={engine,steps:[],widths:[]};let frame;
 try{
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(/\/world\.mjs\?/.test(r.url()))worldUrls.set(r.frame(),r.url());if(/\/traveler\.mjs\?/.test(r.url()))travelerUrls.set(r.frame(),r.url());});await page.clock.setFixedTime(new Date('2026-10-09T10:02:00Z'));await page.goto(base);
  await page.waitForFunction(()=>window.CharDayApp&&window.ReactDOM&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await page.evaluate(writer=>{
   let plans={};window.workRef={current:plans};window.workSave=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},workRef,saveJSON);
   window.workPlan=(scene,spot)=>workSave('work-a','2026-10-09',{seqs:[{seq:1,time:'10:00',end:'11:00',title:scene==='dayLibrary'?'看书与整理笔记':'观察样品与记录实验',location:scene==='dayLibrary'?'图书馆':'实验室',type:'work',world:{scene,spot}}]});
   workPlan('dayLaboratory','bench');window.workWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{workWrites.push(key);return original(key,...args);};window.workModels=0;window.callAI=()=>{workModels++;throw Error('Unexpected model request');};
   const el=document.createElement('div');el.id='work-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.workRoot=ReactDOM.createRoot(el);
   workRoot.render(React.createElement(CharDayApp,{initialCharId:'work-a',characters:[{id:'work-a',name:'测试研究员',gender:'male',tz:'0'}],plansFor:c=>workRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',hairColor:'#43352e',wardrobe:{academy:{cloth:'#a8be83',trim:'#ebcedf',bottom:'#766956',boots:'#163541'}}}),taFor:()=> '他',onBack:()=>{},build:'workflow-browser'}));
  },writer);
  const root=page.locator('#work-root');await page.waitForFunction(()=>document.querySelector('#work-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')}),state=()=>frame.evaluate(()=>CharDayScene.inspect());
  async function observe(scene,primary,time,phase,spot,kind){
   await page.clock.setFixedTime(new Date('2026-10-09T'+time+'Z'));await page.evaluate(({scene,primary})=>workPlan(scene,primary),{scene,primary});
   await frame.waitForFunction(({scene,phase,spot})=>{const s=CharDayScene.inspect();return s.map===scene&&s.activity?.phase===phase&&s.activity.spot===spot&&!s.changing;},{scene,phase,spot});
   const pathReport=await frame.evaluate(async url=>{
    const {walkable,segmentClear}=await import(url),map=CharDayScene.inspect().map;
    return new Promise((resolve,reject)=>{const start=performance.now();let last=null,n=0,moved=false,carryFrames=0;function sample(){const s=CharDayScene.inspect();n++;if(!walkable(s.position.x,s.position.z,map))return reject(Error('Walk entered obstacle'));if(last){if(!segmentClear(last,s.position,map))return reject(Error('Walk crossed furniture'));moved||=Math.hypot(last.x-s.position.x,last.z-s.position.z)>.001;}if(s.route.length){if(last&&s.task?.kind==='carry'&&(s.workAction?.pen||s.workAction?.pipette))return reject(Error('Working tools persisted during walking'));if(s.workAction?.carry)carryFrames++;}last=s.position;if(!s.route.length&&!s.changing)return resolve({frames:n,moved,carryFrames});if(performance.now()-start>30000)return reject(Error('Route did not finish'));requestAnimationFrame(sample);}sample();});
   },worldUrls.get(frame));
   if(kind)await frame.waitForFunction(kind=>CharDayScene.inspect().workAction?.kind===kind,kind);
   await page.waitForTimeout(kind==='select'?3000:500);const s=await state(),probe=await frame.evaluate(()=>CharDayScene.probeAction());
   fs.writeFileSync(path.join(out,'last-probe.json'),JSON.stringify({s,probe},null,2));
   assert.equal(s.activity.phase,phase);assert.equal(s.activity.spot,spot);assert.equal(s.workAction?.kind||null,kind||null);
   if(scene==='dayLibrary'&&kind==='select')assert.equal(s.workAction.carry,true);
   if(scene==='dayLibrary'&&['read','write','return'].includes(kind)&&pathReport.moved)assert.ok(pathReport.carryFrames>0,'Carried book follows actual walking');
   if(kind==='write')assert.equal(s.workAction.pen,true);if(kind==='experiment')assert.equal(s.workAction.pipette,true);
   if(kind==='write'||kind==='experiment'){assert.ok(probe.tool);const distance=Math.hypot(...probe.tool.map((x,i)=>x-probe.hand[i]));assert.ok(distance<.035,'Actual hand holds tool');}
   if(probe.headHand&&['experiment','write','type','observe'].includes(kind))assert.ok(Math.hypot(...probe.headHand)>1.15,'Working hand outside face');
   const before=probe.hand;await page.waitForTimeout(500);const after=await frame.evaluate(()=>CharDayScene.probeAction());if(['write','type','experiment'].includes(kind))assert.ok(before.some((n,i)=>Math.abs(n-after.hand[i])>.00001),'Continuous task movement');
   await root.getByRole('button',{name:'跟着TA',exact:true}).click();await page.waitForTimeout(250);await shot(scene+'-'+phase+'-'+spot);
   result.steps.push({scene,primary,time,phase,spot,kind,pathReport,state:s,probe});
  }
  if(!process.env.DAY_RIG_ONLY){
  for(const step of [
   ['dayLaboratory','bench','10:00:10','enter','entrance',null],['dayLaboratory','bench','10:00:45','prepare','materials','select'],
   ['dayLaboratory','bench','10:02:00','work','bench','experiment'],['dayLaboratory','bench','10:08:00','work','observation','observe'],
   ['dayLaboratory','bench','10:10:00','work','records','write'],['dayLaboratory','bench','10:12:00','break','break',null],
   ['dayLaboratory','bench','10:58:45','tidy','bench','tidy'],['dayLaboratory','bench','10:59:45','exit','entrance',null],
   ['dayLaboratory','computer','10:05:00','work','computer','type'],
   ['dayLibrary','desk-reading','10:00:10','enter','exit',null],['dayLibrary','desk-reading','10:00:45','prepare','choose-book','select'],
   ['dayLibrary','desk-reading','10:02:00','work','desk-reading','read'],['dayLibrary','desk-reading','10:14:10','work','study-notes','write'],
   ['dayLibrary','desk-reading','10:15:40','break','desk-reading','carry'],['dayLibrary','desk-reading','10:58:45','tidy','return-book','return'],['dayLibrary','desk-reading','10:59:45','exit','exit',null]
  ])await observe(...step);
  await observe('dayLibrary','window-reading','10:05:00','work','window-reading','read');
  for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
   await page.setViewportSize({width:w,height:h});const boxes=await root.evaluate(el=>{const p=el.querySelector('[data-wk=cdaypage]'),get=k=>p.querySelector('[data-wk='+k+']').getBoundingClientRect().toJSON();return {overflow:p.scrollWidth>p.clientWidth,head:get('head'),now:get('cdaynow'),scene:get('cdayscene'),tools:get('cdaytools')};});
   assert.equal(boxes.overflow,false);assert.ok(boxes.now.right<=w+1&&boxes.now.bottom<boxes.tools.top);assert.ok(Math.abs(boxes.tools.bottom-h)<2&&boxes.tools.height>=54&&boxes.tools.height<=65);await shot('layout-'+w+'x'+h);result.widths.push({w,h,boxes});
  }
  await page.setViewportSize({width:390,height:844});
  }
  result.rigChecks=await frame.evaluate(async({url})=>{
   const {createTraveler,loadTravelerSource}=await import(url),{OUTFITS}=await import(new URL('./wardrobe.mjs',url).href),{taskAt,activityPhase}=await import(new URL('./day/workflow.mjs',url).href),{DAY_PLACES}=await import(new URL('./day/places/index.mjs',url).href),T=await import('three');
   const doll=createTraveler(await loadTravelerSource(),true);await doll.ready();const reports=[];let clock=100;
   try{for(const outfit of Object.keys(OUTFITS))for(const dims of [{height:.88,build:.82,head:1.12},{height:1,build:1,head:1},{height:1.12,build:1.18,head:.9}]){
    doll.setLook({outfit,dims},true);await doll.ready();
    for(const [id,key]of [['dayLaboratory','bench'],['dayLaboratory','observation'],['dayLaboratory','computer'],['dayLaboratory','records'],['dayLibrary','choose-book'],['dayLibrary','study-notes'],['dayLibrary','return-book']]){
     const map=DAY_PLACES[id],spot=map.spots.find(s=>s.id===key),stage=activityPhase({map:id,spot:key},null,null),task=taskAt(stage,spot,map,3),position=spot.seat||spot.target;
     doll.root.position.set(position.x,0,position.z);doll.root.rotation.y=spot.heading||0;let samples=0,maxTipError=0,minHeadDistance=Infinity,maxKeyboardError=0,maxMeshGripError=0;
     for(let i=0;i<36;i++){
      clock+=.05;task.progress=i/35;doll.animate(clock,{task,gesture:'rest',seated:!!spot.seat,height:.08+(spot.seat?.rise||0)+(spot.seat?.rise ? .05 : 0)});doll.root.updateMatrixWorld(true);
      const hand=doll.root.getObjectByName('Right_hand'),head=doll.root.getObjectByName('HeadAnchor'),v=head.worldToLocal(hand.getWorldPosition(new T.Vector3()));minHeadDistance=Math.min(minHeadDistance,v.length());
      const tool=doll.root.getObjectByName(task.kind==='write'?'WorkPencil':'WorkPipette');if(tool?.visible&&task.contact){const tip=tool.localToWorld(new T.Vector3(0,task.kind==='write'?-.21:-.23,0));maxTipError=Math.max(maxTipError,tip.distanceTo(new T.Vector3(task.contact.x,task.contact.y,task.contact.z)));}
      if(i>25){
       let bind;doll.root.traverse(o=>{if(o.userData.elbowRig)bind=o.userData.elbowRig;});
       const rest=new T.Vector3(...bind.hands.right),points=[];doll.root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.skinBase){const pos=o.geometry.getAttribute('position');for(let n=0;n<pos.count;n++){const v=new T.Vector3().fromBufferAttribute(pos,n);if(v.distanceTo(rest)<.035){o.getVertexPosition(n,v);points.push(o.localToWorld(v));}}}});
       if(points.length){const center=points.reduce((a,p)=>a.add(p),new T.Vector3()).divideScalar(points.length);maxMeshGripError=Math.max(maxMeshGripError,center.distanceTo(hand.getWorldPosition(new T.Vector3())));}
      }
      if(task.kind==='type'&&i>25)maxKeyboardError=Math.max(maxKeyboardError,hand.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(task.target.x,task.target.y,task.target.z)));
      if(!hand.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite))throw Error('Non-finite hand pose');samples++;
     }
     if(maxMeshGripError>.07)throw Error('Visible hand differs from grip: '+outfit+'/'+key+' '+maxMeshGripError);
     if(maxKeyboardError>.075)throw Error('Keyboard outside hand reach: '+JSON.stringify({outfit,dims,maxKeyboardError,hand:doll.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()).toArray(),target:task.target,headHand:doll.root.getObjectByName('HeadAnchor').worldToLocal(doll.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3())).toArray(),work:doll.root.userData.workAction}));
     if(maxTipError>.004)throw Error('Tool lost its work surface: '+outfit+'/'+key);
     // HeadAnchor is the authored unit head ellipsoid; test working reach separately from pick/release.
     if(['experiment','write','type','observe'].includes(task.kind)&&minHeadDistance<1.08)throw Error('Hand entered head: '+outfit+'/'+key+' '+minHeadDistance);
     reports.push({outfit,dims,id,key,samples,maxTipError,minHeadDistance,maxKeyboardError,maxMeshGripError});
    }
   }}finally{doll.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
   return reports;
  },{url:travelerUrls.get(frame)});
  if(process.env.DAY_RIG_ONLY){result.ok=true;result.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,engine,rigChecks:result.rigChecks.length,frames:result.rigChecks.reduce((n,x)=>n+x.samples,0)}));return;}
  // A changed schedule follows its actual world immediately and discards work tools.
  await page.evaluate(()=>{const plan=workRef.current['work-a']['2026-10-09'];workSave('work-a','2026-10-09',{...plan,seqs:plan.seqs.map(s=>({...s,deviation:{actual:'在家睡觉',type:'sleep',world:{scene:'dayHome',spot:'sleep'}}}))});});
  await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.map==='dayHome'&&s.bed&&!s.changing&&s.gesture==='sleep';});assert.equal((await state()).workAction?.carry,false);assert.equal((await state()).workAction?.pen,false);result.revisionAndSleep=true;
  await page.clock.setFixedTime(new Date('2026-10-09T11:01:00Z'));await root.getByText('这会儿没排事情',{exact:true}).waitFor();assert.equal((await state()).task,null);result.gap=true;
  const sceneWrites=await page.evaluate(()=>workWrites.filter(k=>/^x_(?:charDay|fairyGardenSaves|chat(?::|$))/.test(k)));assert.deepEqual(sceneWrites,[]);assert.equal(await page.evaluate(()=>workModels),0);
  assert.deepEqual(errors,[]);result.errors=errors;result.zeroModelCalls=true;result.zeroSceneWrites=true;result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,steps:result.steps.length,widths:result.widths.length,engine}));
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:frame?await frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null):null},null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
