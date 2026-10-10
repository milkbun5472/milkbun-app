const {cameraView}=require('./char-day-ui-helpers.cjs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const batch=process.env.DAY_BATCH||'first',base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'chromium',out=process.env.DAY_EVIDENCE||'/tmp/char-day-workflows';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=app.slice(a,b);
(async()=>{
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],requests=[],worldUrls=new Map(),travelerUrls=new Map(),result={engine,steps:[],widths:[]};let frame;
 try{
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(/\/world\.mjs\?/.test(r.url()))worldUrls.set(r.frame(),r.url());if(/\/traveler\.mjs\?/.test(r.url()))travelerUrls.set(r.frame(),r.url());});await page.clock.setFixedTime(new Date('2026-10-09T10:02:00Z'));await page.goto(base);
  await page.waitForFunction(()=>window.CharDayApp&&window.ReactDOM&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await page.evaluate(writer=>{
   let plans={};window.workRef={current:plans};window.workSave=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},workRef,saveJSON);
   window.workPlan=(scene,spot,title)=>workSave('work-a','2026-10-09',{seqs:[{seq:1,time:'10:00',end:'11:00',title:title||({dayLibrary:'看书与整理笔记',dayLaboratory:'观察样品与记录实验',dayClinic:'整理病历与交班资料',dayStudio:'绘画与手工创作',dayRehearsal:'练琴与排戏',dayStation:'候车与出发准备',dayGym:'运动训练',dayMarket:'采购日常物品'}[scene]),location:({dayLibrary:'图书馆',dayLaboratory:'实验室',dayClinic:'诊室',dayStudio:'创作工作室',dayRehearsal:'排练室',dayStation:'候车区',dayGym:'健身房',dayMarket:'超市'}[scene]),type:'work',world:{scene,spot}}]});
   workPlan('dayLaboratory','bench');window.workWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{workWrites.push(key);return original(key,...args);};window.workModels=0;window.callAI=()=>{workModels++;throw Error('Unexpected model request');};
   const el=document.createElement('div');el.id='work-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.workRoot=ReactDOM.createRoot(el);
   workRoot.render(React.createElement(CharDayApp,{initialCharId:'work-a',characters:[{id:'work-a',name:'测试研究员',gender:'male',tz:'0'}],plansFor:c=>workRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',hairColor:'#43352e',wardrobe:{academy:{cloth:'#a8be83',trim:'#ebcedf',bottom:'#766956',boots:'#163541'}}}),taFor:()=> '他',onBack:()=>{},build:'workflow-browser'}));
  },writer);
  const root=page.locator('#work-root');await page.waitForFunction(()=>document.querySelector('#work-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')}),state=()=>frame.evaluate(()=>CharDayScene.inspect());
  async function observe(scene,primary,time,phase,spot,kind,title){
   await page.clock.setFixedTime(new Date('2026-10-09T'+time+'Z'));await page.evaluate(({scene,primary,title})=>workPlan(scene,primary,title),{scene,primary,title});
   await frame.waitForFunction(({scene,phase,spot})=>{const s=CharDayScene.inspect();return s.map===scene&&s.activity?.phase===phase&&s.activity.spot===spot&&!s.changing;},{scene,phase,spot});
   const pathReport=await frame.evaluate(async url=>{
    const {walkable,segmentClear,MAPS}=await import(url),map=CharDayScene.inspect().map;
    return new Promise((resolve,reject)=>{const start=performance.now();let last=null,n=0,moved=false,carryFrames=0;function sample(){const s=CharDayScene.inspect();n++;if(s.task?.luggageHeld&&s.workAction?.luggagePoint){const [x,y,z]=s.workAction.luggagePoint;if(Math.abs(y-MAPS[map].floor)>.01)return reject(Error('Carried bag left floor'));if(MAPS[map].obstacles.some(o=>o.w&&o.d&&Math.abs(x-o.x)<o.w/2+.14&&Math.abs(z-o.z)<o.d/2+.11))return reject(Error('Carried bag crossed furniture'));}if(!walkable(s.position.x,s.position.z,map))return reject(Error('Walk entered obstacle'));if(last){if(!segmentClear(last,s.position,map))return reject(Error('Walk crossed furniture'));moved||=Math.hypot(last.x-s.position.x,last.z-s.position.z)>.001;}if(s.route.length){if(last&&s.task?.kind==='carry'&&(s.workAction?.pen||s.workAction?.pipette))return reject(Error('Working tools persisted during walking'));if(s.workAction?.carry)carryFrames++;}last=s.position;if(!s.route.length&&!s.changing)return resolve({frames:n,moved,carryFrames});if(performance.now()-start>30000)return reject(Error('Route did not finish'));requestAnimationFrame(sample);}sample();});
   },worldUrls.get(frame));
   if(kind)await frame.waitForFunction(kind=>CharDayScene.inspect().workAction?.kind===kind,kind);
   await page.waitForTimeout(kind==='select'?3000:['pack','take-luggage'].includes(kind)?5500:500);const s=await state(),probe=await frame.evaluate(()=>CharDayScene.probeAction());
   fs.writeFileSync(path.join(out,'last-probe.json'),JSON.stringify({s,probe},null,2));
   assert.equal(s.activity.phase,phase);assert.equal(s.activity.spot,spot);assert.equal(s.workAction?.kind||null,kind||null);
   if(scene==='dayLibrary'&&kind==='select')assert.equal(s.workAction.carry,true);
   if(scene==='dayLibrary'&&['read','write','return'].includes(kind)&&pathReport.moved)assert.ok(pathReport.carryFrames>0,'Carried book follows actual walking');
   if(scene==='dayStation'&&phase==='work'){const rack=await frame.evaluate(async url=>{const {MAPS}=await import(url);return MAPS.dayStation.furniture.find(f=>f.id==='luggage-shelf');},worldUrls.get(frame));assert.ok(Math.abs(probe.luggage[0]-(rack.x-.12))<.005&&Math.abs(probe.luggage[2]-(rack.z+.27))<.005,'Bag stays on rack during waiting');}
   if(scene==='dayStation'&&['enter','exit'].includes(phase))assert.ok(Math.hypot(...probe.luggageGrip.map((n,i)=>n-probe.hand[i]))<.005,'Actual hand holds luggage grip');
   if(kind==='guitar')assert.equal(s.sceneAction.guitarBorrowed,true);if(scene==='dayRehearsal'&&kind!=='guitar')assert.equal(s.sceneAction.guitarBorrowed,false);
   if(kind==='paint')assert.equal(s.workAction.brush,true);if(kind==='guitar')assert.equal(s.workAction.guitar,true);if(kind==='clipboard')assert.equal(s.workAction.clipboard,true);if(scene==='dayStation')assert.equal(s.workAction.luggage,true);
   if(kind==='write')assert.equal(s.workAction.pen,true);if(kind==='experiment')assert.equal(s.workAction.pipette,true);
   if(kind==='write'||kind==='experiment'||kind==='paint'){assert.ok(probe.tool);const distance=Math.hypot(...probe.tool.map((x,i)=>x-probe.hand[i]));assert.ok(distance<.035,'Actual hand holds tool');}
   if(probe.headHand&&['experiment','write','type','observe','paint','piano','craft'].includes(kind))assert.ok(Math.hypot(...probe.headHand)>1.08,'Working hand outside face');
   if(kind==='piano'){assert.ok(Math.hypot(...probe.leftHeadHand)>1.08,'Left piano hand outside face');let pressed=false;for(let n=0;n<8;n++){pressed||=(await state()).sceneAction.pressedKeys.length>0;await page.waitForTimeout(150);}assert.ok(pressed,'Actual keyboard keys move');}
   const before=probe.hand;await page.waitForTimeout(500);const after=await frame.evaluate(()=>CharDayScene.probeAction());if(['write','type','experiment','paint','piano','guitar','craft','dance','rehearse'].includes(kind))assert.ok(before.some((n,i)=>Math.abs(n-after.hand[i])>.00001),'Continuous task movement');
   await cameraView(root,false);await page.waitForTimeout(250);await shot(scene+'-'+phase+'-'+spot);
   result.steps.push({scene,primary,time,phase,spot,kind,pathReport,state:s,probe});
  }
  if(!process.env.DAY_RIG_ONLY){
  for(const step of batch==='errands'?[
   ['dayGym','weights','10:00:10','enter','entrance',null],['dayGym','weights','10:00:45','prepare','take-weights','weight-pick'],['dayGym','weights','10:02:00','work','weights','weights'],['dayGym','weights','10:09:45','work','stretch','stretch'],['dayGym','weights','10:11:45','break','rest',null],['dayGym','weights','10:58:45','tidy','take-weights','weight-return'],['dayGym','weights','10:59:45','exit','exit',null],['dayGym','treadmill','10:02:00','work','treadmill','treadmill'],
   ['dayMarket','produce','10:00:10','enter','entrance',null],['dayMarket','produce','10:00:45','prepare','basket','basket-pick'],['dayMarket','produce','10:02:00','work','produce','market-pick'],['dayMarket','produce','10:05:00','work','groceries','market-pick'],['dayMarket','produce','10:08:00','work','cold','market-pick'],['dayMarket','produce','10:58:36','tidy','checkout','checkout'],['dayMarket','produce','10:59:06','tidy','packing','market-pack'],['dayMarket','produce','10:59:45','exit','exit','carry'],['dayMarket','cashier','10:02:00','work','cashier','cashier','超市收银值班']
  ]:batch==='four'?[
   ['dayClinic','casework','10:00:10','enter','entrance',null],['dayClinic','casework','10:00:45','prepare','casefiles','select'],['dayClinic','casework','10:02:00','work','casework','write'],['dayClinic','casework','10:11:00','work','handoff','clipboard'],['dayClinic','casework','10:16:00','break','rest','carry'],['dayClinic','casework','10:58:45','tidy','casefiles','return'],
   ['dayStudio','easel','10:00:45','prepare','materials','select'],['dayStudio','easel','10:02:00','work','easel','paint'],['dayStudio','easel','10:10:00','work','gallery','observe'],['dayStudio','drawing','10:02:00','work','drawing','write'],['dayStudio','handcraft','10:02:00','work','handcraft','craft'],['dayStudio','easel','10:58:45','tidy','drying','tidy'],
   ['dayRehearsal','piano','10:00:45','prepare','score','read'],['dayRehearsal','piano','10:02:00','work','piano','piano'],['dayRehearsal','practice','10:02:00','work','practice','rehearse'],['dayRehearsal','instruments','10:02:00','work','instruments','guitar'],['dayRehearsal','practice','10:02:00','work','practice','dance','练舞与舞蹈排练'],
   ['dayStation','waiting','10:00:10','enter','entrance','luggage'],['dayStation','waiting','10:00:45','prepare','luggage','pack'],['dayStation','waiting','10:02:00','work','waiting','wait'],['dayStation','waiting','10:14:00','work','reading','read'],['dayStation','waiting','10:58:45','tidy','luggage','take-luggage'],['dayStation','waiting','10:59:45','exit','departure','luggage']
  ]:[
   ['dayLaboratory','bench','10:00:10','enter','entrance',null],['dayLaboratory','bench','10:00:45','prepare','materials','select'],
   ['dayLaboratory','bench','10:02:00','work','bench','experiment'],['dayLaboratory','bench','10:08:00','work','observation','observe'],
   ['dayLaboratory','bench','10:10:00','work','records','write'],['dayLaboratory','bench','10:12:00','break','break',null],
   ['dayLaboratory','bench','10:58:45','tidy','bench','tidy'],['dayLaboratory','bench','10:59:45','exit','entrance',null],
   ['dayLaboratory','computer','10:05:00','work','computer','type'],
   ['dayLibrary','desk-reading','10:00:10','enter','exit',null],['dayLibrary','desk-reading','10:00:45','prepare','choose-book','select'],
   ['dayLibrary','desk-reading','10:02:00','work','desk-reading','read'],['dayLibrary','desk-reading','10:14:10','work','study-notes','write'],
   ['dayLibrary','desk-reading','10:15:40','break','desk-reading','carry'],['dayLibrary','desk-reading','10:58:45','tidy','return-book','return'],['dayLibrary','desk-reading','10:59:45','exit','exit',null]
  ])await observe(...step);
  if(batch==='first')await observe('dayLibrary','window-reading','10:05:00','work','window-reading','read');
  for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
   await page.setViewportSize({width:w,height:h});const boxes=await root.evaluate(el=>{const p=el.querySelector('[data-wk=cdaypage]'),get=k=>p.querySelector('[data-wk='+k+']').getBoundingClientRect().toJSON();return {overflow:p.scrollWidth>p.clientWidth,head:get('head'),now:get('cdaynow'),scene:get('cdayscene'),tools:get('cdaytools')};});
   assert.equal(boxes.overflow,false);assert.ok(boxes.now.right<=w+1&&boxes.now.bottom<boxes.tools.top);assert.ok(Math.abs(boxes.tools.bottom-h)<2&&boxes.tools.height>=54&&boxes.tools.height<=65);await shot('layout-'+w+'x'+h);result.widths.push({w,h,boxes});
  }
  await page.setViewportSize({width:390,height:844});
  }
  result.rigChecks=await frame.evaluate(async({url,batch})=>{
   const {createTraveler,loadTravelerSource}=await import(url),{OUTFITS}=await import(new URL('./wardrobe.mjs',url).href),{taskAt,activityPhase}=await import(new URL('./day/workflow.mjs',url).href),{DAY_PLACES}=await import(new URL('./day/places/index.mjs',url).href),T=await import('three');
   const handPosition=(doll,name)=>doll.root.getObjectByName(name).getWorldPosition(new T.Vector3()).toArray();
   const doll=createTraveler(await loadTravelerSource(),true);await doll.ready();const reports=[];let clock=100;
   try{for(const outfit of Object.keys(OUTFITS))for(const dims of [{height:.88,build:.82,head:1.12},{height:1,build:1,head:1},{height:1.12,build:1.18,head:.9}]){
    doll.setLook({outfit,dims},true);await doll.ready();
    for(const [id,key]of (batch==='errands'?[['dayGym','treadmill'],['dayGym','weights'],['dayGym','stretch'],['dayGym','take-weights'],['dayMarket','basket'],['dayMarket','produce'],['dayMarket','groceries'],['dayMarket','cold'],['dayMarket','checkout'],['dayMarket','cashier'],['dayMarket','packing']]:batch==='four'?[['dayClinic','casework'],['dayClinic','handoff'],['dayStudio','easel'],['dayStudio','drawing'],['dayStudio','handcraft'],['dayRehearsal','practice'],['dayRehearsal','piano'],['dayRehearsal','instruments'],['dayStation','luggage'],['dayStation','waiting'],['dayStation','departure']]:[['dayLaboratory','bench'],['dayLaboratory','observation'],['dayLaboratory','computer'],['dayLaboratory','records'],['dayLibrary','choose-book'],['dayLibrary','study-notes'],['dayLibrary','return-book']])){
     const map=DAY_PLACES[id],spot=map.spots.find(s=>s.id===key),stage=activityPhase({map:id,spot:key},null,null),task=taskAt(stage,spot,map,3),position=spot.seat||spot.target;
     doll.root.position.set(position.x,0,position.z);doll.root.rotation.y=spot.heading||0;let samples=0,maxTipError=0,minHeadDistance=Infinity,maxKeyboardError=0,maxMeshGripError=0,minLeftHeadDistance=Infinity,maxLeftMeshGripError=0,maxToolLength=0,maxGuitarError=0,maxPropGripError=0,minReachError=Infinity,legPoses=[],bestReach=null;
     for(let i=0;i<36;i++){
      clock+=.05;task.progress=i/35;doll.animate(clock,{task,gesture:'rest',seated:!!spot.seat,height:.08+(spot.seat?.rise||0)+(spot.seat?.rise ? .05 : 0)});doll.root.updateMatrixWorld(true);
      const hand=doll.root.getObjectByName('Right_hand'),head=doll.root.getObjectByName('HeadAnchor'),v=head.worldToLocal(hand.getWorldPosition(new T.Vector3()));minHeadDistance=Math.min(minHeadDistance,v.length());const leftHand=doll.root.getObjectByName('Left_hand');minLeftHeadDistance=Math.min(minLeftHeadDistance,head.worldToLocal(leftHand.getWorldPosition(new T.Vector3())).length());
      const tool=doll.root.getObjectByName(task.kind==='write'?'WorkPencil':task.kind==='paint'?'WorkBrush':'WorkPipette');if(tool?.visible&&task.contact){const tip=tool.localToWorld(new T.Vector3(0,task.kind==='write'?-.21:task.kind==='paint'?-.22:-.23,0));maxTipError=Math.max(maxTipError,tip.distanceTo(new T.Vector3(task.contact.x,task.contact.y,task.contact.z)));maxToolLength=Math.max(maxToolLength,tool.getWorldPosition(new T.Vector3()).distanceTo(tip));}
      if(i>25){
       let bind;doll.root.traverse(o=>{if(o.userData.elbowRig)bind=o.userData.elbowRig;});
       const rest=new T.Vector3(...bind.hands.right),points=[];doll.root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.skinBase){const pos=o.geometry.getAttribute('position');for(let n=0;n<pos.count;n++){const v=new T.Vector3().fromBufferAttribute(pos,n);if(v.distanceTo(rest)<.035){o.getVertexPosition(n,v);points.push(o.localToWorld(v));}}}});
       if(points.length){const center=points.reduce((a,p)=>a.add(p),new T.Vector3()).divideScalar(points.length);maxMeshGripError=Math.max(maxMeshGripError,center.distanceTo(hand.getWorldPosition(new T.Vector3())));}
       if(task.kind==='piano'){const leftRest=new T.Vector3(...bind.hands.left),leftPoints=[];doll.root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.skinBase){const pos=o.geometry.getAttribute('position');for(let n=0;n<pos.count;n++){const v=new T.Vector3().fromBufferAttribute(pos,n);if(v.distanceTo(leftRest)<.035){o.getVertexPosition(n,v);leftPoints.push(o.localToWorld(v));}}}});if(leftPoints.length){const center=leftPoints.reduce((a,p)=>a.add(p),new T.Vector3()).divideScalar(leftPoints.length);maxLeftMeshGripError=Math.max(maxLeftMeshGripError,center.distanceTo(leftHand.getWorldPosition(new T.Vector3())));}}
      }
      if(['type','piano'].includes(task.kind)&&i>25)maxKeyboardError=Math.max(maxKeyboardError,hand.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(task.target.x,task.target.y,task.target.z)));
      if(task.kind==='guitar'&&i>25){const guitar=doll.root.getObjectByName('HeldWorkGuitar'),strings=guitar.localToWorld(new T.Vector3(...guitar.userData.strumTarget));maxGuitarError=Math.max(maxGuitarError,hand.getWorldPosition(new T.Vector3()).distanceTo(strings));}
      if(task.kind==='piano'&&i>25){const left=doll.root.getObjectByName('Left_hand');maxKeyboardError=Math.max(maxKeyboardError,left.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(task.leftTarget.x,task.leftTarget.y,task.leftTarget.z)));}
      if(batch==='errands'){
       for(const [name,side]of [['LeftWorkoutWeight','Left_hand'],['RightWorkoutWeight','Right_hand'],['HeldShoppingBasket','Left_hand'],['HeldShoppingBag','Left_hand'],['HeldMarketProduct','Right_hand']]){const prop=doll.root.getObjectByName(name);if(prop?.visible)maxPropGripError=Math.max(maxPropGripError,prop.getWorldPosition(new T.Vector3()).distanceTo(doll.root.getObjectByName(side).getWorldPosition(new T.Vector3())));}
       if(task.contact&&i>6){const distance=(task.kind==='basket-pick'?leftHand:hand).getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(task.contact.x,task.contact.y,task.contact.z));if(distance<minReachError){minReachError=distance;bestReach={hand:hand.getWorldPosition(new T.Vector3()).toArray(),contact:task.contact,head:head.getWorldPosition(new T.Vector3()).toArray(),root:doll.root.position.toArray()};}}
       if(task.kind==='treadmill')legPoses.push(doll.root.getObjectByName('leftLeg').quaternion.toArray());
      }
      if(!hand.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite))throw Error('Non-finite hand pose');samples++;
     }
     if(task.kind==='piano'&&(minLeftHeadDistance<1.08||maxLeftMeshGripError>.07))throw Error('Left piano hand penetrates head or mesh: '+JSON.stringify({outfit,dims,minLeftHeadDistance,maxLeftMeshGripError}));
     if(maxMeshGripError>.07)throw Error('Visible hand differs from grip: '+outfit+'/'+key+' '+maxMeshGripError);
     if(maxKeyboardError>.075)throw Error('Keyboard outside hand reach: '+JSON.stringify({outfit,dims,maxKeyboardError,hand:doll.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()).toArray(),target:task.target,headHand:doll.root.getObjectByName('HeadAnchor').worldToLocal(doll.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3())).toArray(),work:doll.root.userData.workAction}));
     if(maxToolLength>.42)throw Error('Tool stretched beyond normal reach: '+JSON.stringify({outfit,dims,key,maxToolLength}));
     if(maxGuitarError>.065)throw Error('Strumming hand missed actual strings: '+JSON.stringify({outfit,dims,key,maxGuitarError,hand:handPosition(doll,'Right_hand'),left:handPosition(doll,'Left_hand'),guitar:handPosition(doll,'HeldWorkGuitar'),modelScale:doll.root.getObjectByName('TravelerVisual').scale.toArray()}));
     if(maxTipError>.004)throw Error('Tool lost its work surface: '+outfit+'/'+key);
     // HeadAnchor is the authored unit head ellipsoid; test working reach separately from pick/release.
     if(['experiment','write','type','observe','paint','piano','craft','guitar'].includes(task.kind)&&minHeadDistance<1.08)throw Error('Hand entered head: '+outfit+'/'+key+' '+minHeadDistance);
     if(batch==='errands'){
      if(maxPropGripError>.005)throw Error('Prop lost actual hand grip: '+JSON.stringify({outfit,dims,key,maxPropGripError}));
      if(['treadmill','weights','stretch','market-pick','cashier','checkout','market-pack'].includes(task.kind)&&Math.min(minHeadDistance,minLeftHeadDistance)<1.08)throw Error('Errand hand entered head: '+JSON.stringify({outfit,dims,key,minHeadDistance,minLeftHeadDistance}));
      if(task.contact&&minReachError>.10)throw Error('Shelf/counter contact out of reach: '+JSON.stringify({outfit,dims,key,minReachError,bestReach}));
      if(legPoses.length&&Math.max(...legPoses.map(q=>new T.Quaternion().fromArray(q).angleTo(new T.Quaternion().fromArray(legPoses[0]))))<.2)throw Error('Running legs did not move');
      doll.animate(clock+.1,{gesture:'rest',height:.08});for(const name of ['LeftWorkoutWeight','RightWorkoutWeight','HeldShoppingBasket','HeldShoppingBag','HeldMarketProduct'])if(doll.root.getObjectByName(name)?.visible)throw Error('Errand prop persisted after work stopped: '+name);
     }
     reports.push({outfit,dims,id,key,samples,maxTipError,minHeadDistance,maxKeyboardError,maxMeshGripError,minLeftHeadDistance,maxLeftMeshGripError,maxToolLength,maxGuitarError,maxPropGripError,minReachError: Number.isFinite(minReachError)?minReachError:null});
    }
   }}finally{doll.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});}
   return reports;
  },{url:travelerUrls.get(frame),batch});
  if(process.env.DAY_RIG_ONLY){result.ok=true;result.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,engine,rigChecks:result.rigChecks.length,frames:result.rigChecks.reduce((n,x)=>n+x.samples,0)}));return;}
  // A changed schedule follows its actual world immediately and discards work tools.
  await page.evaluate(()=>{const plan=workRef.current['work-a']['2026-10-09'];workSave('work-a','2026-10-09',{...plan,seqs:plan.seqs.map(s=>({...s,deviation:{actual:'在家睡觉',type:'sleep',world:{scene:'dayHome',spot:'sleep'}}}))});});
  await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.map==='dayHome'&&s.bed&&!s.changing&&s.gesture==='sleep';});assert.equal((await state()).workAction?.carry,false);assert.equal((await state()).workAction?.pen,false);for(const prop of ['brush','clipboard','guitar','luggage','weights','basket','product','bag'])assert.equal((await state()).workAction?.[prop],false);result.revisionAndSleep=true;
  await page.clock.setFixedTime(new Date('2026-10-09T11:01:00Z'));await root.getByText('这会儿没排事情',{exact:true}).waitFor();assert.equal((await state()).task,null);result.gap=true;
  const sceneWrites=await page.evaluate(()=>workWrites.filter(k=>/^x_(?:charDay|fairyGardenSaves|chat(?::|$))/.test(k)));assert.deepEqual(sceneWrites,[]);assert.equal(await page.evaluate(()=>workModels),0);
  assert.deepEqual(errors,[]);result.errors=errors;result.zeroModelCalls=true;result.zeroSceneWrites=true;result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,steps:result.steps.length,widths:result.widths.length,engine}));
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:frame?await frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null):null},null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
