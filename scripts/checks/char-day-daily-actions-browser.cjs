const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18986',engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-daily-actions';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=app.slice(a,b);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
(async()=>{
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],urls=new Map(),result={engine,actions:[],sizes:[]};let frame;
 try{
  p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/\/world\.mjs\?/.test(r.url()))urls.set(r.frame(),r.url());});await p.clock.setFixedTime(new Date('2026-10-09T10:10:00Z'));await p.goto(base);await p.waitForFunction(()=>window.CharDayApp&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await p.evaluate(async writer=>{
   let plans={};window.dailyRef={current:plans};window.dailySave=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},dailyRef,saveJSON);
   window.dailyPlan=(scene,spot,title)=>dailySave('daily-a','2026-10-09',{seqs:[{seq:1,time:'10:00',end:'11:00',title,location:scene==='dayCafe'?'街角小店':'共同小家',type:'home',world:spot?{scene,spot}:null}]});
   dailyPlan('dayHome','read','在家读书');window.dailyWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{dailyWrites.push(key);return original(key,...args);};window.dailyModels=0;window.callAI=()=>{dailyModels++;throw Error('Unexpected model request');};
   window.dailyGames=JSON.stringify(loadJSON('x_fairyGardenSaves',[]));const el=document.createElement('div');el.id='daily-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.dailyRoot=ReactDOM.createRoot(el);
   dailyRoot.render(React.createElement(CharDayApp,{initialCharId:'daily-a',characters:[{id:'daily-a',name:'小家动作测试',gender:'male',tz:'0'}],plansFor:c=>dailyRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',hairColor:'#43352e'}),taFor:()=> '他',onBack:()=>{},build:'daily-actions-browser'}));
  },writer);
  const root=p.locator('#daily-root');await p.waitForFunction(()=>document.querySelector('#daily-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/'));
  const state=()=>frame.evaluate(()=>CharDayScene.inspect());
  async function ready(){await p.waitForFunction(()=>document.querySelector('#daily-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/'));}
  async function settle(scene,kind){await frame.waitForFunction(({scene,kind})=>{const s=CharDayScene.inspect();return s.map===scene&&!s.changing&&!s.route.length&&s.task?.kind===kind;},{scene,kind});}
  async function observe(scene,spot,kind,title){
   await p.evaluate(({scene,spot,title})=>dailyPlan(scene,spot,title),{scene,spot,title});await frame.waitForFunction(scene=>CharDayScene.inspect().map===scene&&!CharDayScene.inspect().changing,scene);
   const route=await frame.evaluate(async url=>{const {walkable,segmentClear}=await import(url);return new Promise((resolve,reject)=>{let previous=null,frames=0;const started=performance.now();function sample(){const s=CharDayScene.inspect();frames++;if(!walkable(s.position.x,s.position.z,s.map))return reject(Error('Entered furniture'));if(previous&&!segmentClear(previous,s.position,s.map))return reject(Error('Crossed furniture'));if(s.route.length&&s.dailyAction&&(s.dailyAction.cup||s.dailyAction.bowl||s.dailyAction.book||s.dailyAction.ladle))return reject(Error('Working while walking'));previous=s.position;if(!s.route.length&&!s.changing)return resolve(frames);if(performance.now()-started>30000)return reject(Error('No arrival'));requestAnimationFrame(sample);}requestAnimationFrame(sample);});},urls.get(frame));
   await settle(scene,kind);await p.waitForTimeout(500);await root.getByRole('button',{name:'跟着TA',exact:true}).click();
   const samples=await frame.evaluate(async()=>{const data=[],until=performance.now()+9200;return new Promise(resolve=>{function sample(){const s=CharDayScene.inspect();data.push({task:s.task,action:s.dailyAction,probe:CharDayScene.probeAction(),heading:s.avatarHeading});if(performance.now()>=until)return resolve(data);setTimeout(sample,80);}sample();});});
   let maxGrip=0,maxTip=0,minHead=Infinity,sip=false,bite=false,turn=false;const angles=new Set();
   for(const s of samples){const d=s.action;assert.equal(d.kind,kind);minHead=Math.min(minHead,Math.hypot(...s.probe.headHand));
    if(kind==='drink'){assert.equal(d.cup,true);maxGrip=Math.max(maxGrip,distance(d.cupGrip,d.rightGrip));if(d.sip>.98){sip=true;maxTip=Math.max(maxTip,distance(d.cupRim,d.mouth));}}
    if(kind==='eat'){assert.ok(d.bowl&&d.chopsticks);maxGrip=Math.max(maxGrip,distance(d.toolGrip,d.rightGrip));bite||=d.bite>.98;}
    if(kind==='read'){assert.equal(d.book,true);angles.add(Math.round(d.page*10));turn||=d.page<-1;}
    if(kind==='cook'){assert.equal(d.ladle,true);maxGrip=Math.max(maxGrip,distance(d.toolGrip,d.rightGrip));maxTip=Math.max(maxTip,Math.hypot(d.toolTip[0]-s.task.contact.x,d.toolTip[2]-s.task.contact.z));assert.ok(d.toolLength<.46,'Ladle stretched out of reach');}
   }
   assert.ok(maxGrip<.005,'Prop lost hand');assert.ok(minHead>1.08,'Hand entered face');if(kind==='drink'){assert.ok(sip);assert.ok(maxTip<.055,'Cup missed mouth');}if(kind==='eat')assert.ok(bite);if(kind==='read'){assert.ok(turn);assert.ok(angles.size>4);}
   if(kind==='drink'||kind==='eat')await frame.waitForFunction(kind=>{const d=CharDayScene.inspect().dailyAction;return kind==='drink'?d.sip>.98:d.bite>.98;},kind);
   const s=await state();await p.screenshot({path:path.join(out,scene+'-'+kind+'.png')});result.actions.push({scene,spot,kind,route,samples:samples.length,maxGrip,maxTip,minHead,sip,bite,turn,state:s});
  }
  if(!process.env.DAY_RIG_ONLY){for(const row of [['dayHome','read','read','在沙发读书'],['dayHome','tea','drink','在家喝水'],['dayHome','meal','eat','在家吃早饭'],['dayHome','cook','cook','下厨煮汤'],['dayCafe','tea','drink','在小店喝茶'],['dayCafe','meal','eat','在小店吃午饭'],['dayWork','read','read','阅读资料']])await observe(...row);}
  // Check contact against the actual morphed doll, not a synthetic skeleton.
  result.rig=await frame.evaluate(async worldUrl=>{
   const base=new URL('./',worldUrl),{createTraveler,loadTravelerSource}=await import(new URL('traveler.mjs',base)),{OUTFITS}=await import(new URL('wardrobe.mjs',base)),{buildSpace}=await import(new URL('day/spaces.mjs',base)),{dailyTaskAt}=await import(new URL('day/daily-workflow.mjs',base)),T=await import('three');
   const doll=createTraveler(await loadTravelerSource(),true),map=buildSpace('dayHome'),reports=[];await doll.ready();let time=100;
   for(const outfit of Object.keys(OUTFITS))for(const dims of [{height:.88,build:.82,head:1.12},{height:1,build:1,head:1},{height:1.12,build:1.18,head:.9}]){
    doll.setLook({outfit,dims},true);await doll.ready();
    for(const action of ['read','tea','meal','cook']){const spot=map.spots.find(s=>s.action===action),position=spot.seat||spot.target;doll.root.position.set(position.x,0,position.z);doll.root.rotation.y=spot.heading;let minHead=Infinity,maxGrip=0,maxCupError=0,maxLength=0,settledLength=0,maxBiteError=0;
     for(let i=0;i<120;i++){time+=.08;const task=dailyTaskAt({action},spot,map,i*.08);doll.animate(time,{task,gesture:{read:'read',tea:'tea',meal:'eat',cook:'stir'}[action],seated:!!spot.seat,height:.08+(spot.seat?.rise||0)+(spot.seat?.rise?.05:0)});doll.root.updateMatrixWorld(true);
      const d=doll.root.userData.dailyAction,hand=doll.root.getObjectByName('Right_hand'),head=doll.root.getObjectByName('HeadAnchor');if(i>20)minHead=Math.min(minHead,head.worldToLocal(hand.getWorldPosition(new T.Vector3())).length());
      if(d.cupGrip)maxGrip=Math.max(maxGrip,new T.Vector3(...d.cupGrip).distanceTo(new T.Vector3(...d.rightGrip)));if(d.toolGrip)maxGrip=Math.max(maxGrip,new T.Vector3(...d.toolGrip).distanceTo(new T.Vector3(...d.rightGrip)));if(action==='cook'&&i>20&&!d.ladle)throw Error('Cooking hand never reached pot');if(d.bite>.98&&i>20)maxBiteError=Math.max(maxBiteError,new T.Vector3(...d.toolTip).distanceTo(new T.Vector3(...d.mouth)));if(d.sip>.98&&i>20)maxCupError=Math.max(maxCupError,new T.Vector3(...d.cupRim).distanceTo(new T.Vector3(...d.mouth)));maxLength=Math.max(maxLength,d.toolLength||0);if(i>20)settledLength=Math.max(settledLength,d.toolLength||0);
     }
     if(minHead<1.08||maxGrip>.005||maxCupError>.06||maxBiteError>.08||maxLength>.46)throw Error('Daily body contact: '+JSON.stringify({outfit,dims,action,minHead,maxGrip,maxCupError,maxLength,settledLength,maxBiteError,last:doll.root.userData.dailyAction,model:doll.root.getObjectByName('TravelerVisual').getWorldScale(new T.Vector3()).toArray(),head:doll.root.getObjectByName('HeadAnchor').getWorldPosition(new T.Vector3()).toArray()}));reports.push({outfit,dims,action,minHead,maxGrip,maxCupError,maxBiteError,maxLength,frames:120});
    }
   }doll.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});return reports;
  },urls.get(frame));
  result.motionRig=await frame.evaluate(async worldUrl=>{
   const base=new URL('./',worldUrl),{createTraveler,loadTravelerSource}=await import(new URL('traveler.mjs',base)),{buildSpace}=await import(new URL('day/spaces.mjs',base)),{dailyTaskAt}=await import(new URL('day/daily-workflow.mjs',base)),{MOTION_STYLES,motionProfile}=await import(new URL('day/motion-profile.mjs',base)),T=await import('three');
   const doll=createTraveler(await loadTravelerSource(),true),map=buildSpace('dayHome'),reports=[];let time=100;await doll.ready();
   for(const style of Object.keys(MOTION_STYLES))for(const dims of [{height:.88,build:.82,head:1.12},{height:1,build:1,head:1},{height:1.12,build:1.18,head:.9}]){
    doll.setLook({outfit:'academy',dims},true);await doll.ready();const motion=motionProfile({id:'rig:ta',style});
    for(const action of ['read','tea','meal','cook']){const spot=map.spots.find(s=>s.action===action),position=spot.seat||spot.target;doll.root.position.set(position.x,0,position.z);doll.root.rotation.y=spot.heading;let minHead=Infinity,maxTip=0,maxGrip=0,maxLength=0;
     for(let i=0;i<120;i++){time+=.08;const task=dailyTaskAt({action},spot,map,i*.08,{motion});doll.animate(time,{task,motion,gesture:{read:'read',tea:'tea',meal:'eat',cook:'stir'}[action],seated:!!spot.seat,height:.08+(spot.seat?.rise||0)+(spot.seat?.rise?.05:0)});doll.root.updateMatrixWorld(true);const d=doll.root.userData.dailyAction,head=doll.root.getObjectByName('HeadAnchor');if(i<=20)continue;
      for(const hand of ['Right_hand','Left_hand'])minHead=Math.min(minHead,head.worldToLocal(doll.root.getObjectByName(hand).getWorldPosition(new T.Vector3())).length());
      const distance=(a,b)=>new T.Vector3(...a).distanceTo(new T.Vector3(...b));if(d.cupGrip)maxGrip=Math.max(maxGrip,distance(d.cupGrip,d.rightGrip));if(d.toolGrip)maxGrip=Math.max(maxGrip,distance(d.toolGrip,d.rightGrip));if(d.sip>.98)maxTip=Math.max(maxTip,distance(d.cupRim,d.mouth));if(d.bite>.98)maxTip=Math.max(maxTip,distance(d.toolTip,d.mouth));if(action==='cook'&&!d.ladle)throw Error('Motion style lost pot reach: '+style);maxLength=Math.max(maxLength,d.toolLength||0);
     }if(minHead<1.08||maxGrip>.005||maxTip>.06||maxLength>.46)throw Error('Motion contact: '+JSON.stringify({style,dims,action,minHead,maxGrip,maxTip,maxLength}));reports.push({style,dims,action,minHead,maxGrip,maxTip,maxLength,frames:120});
    }
   }return reports;
  },urls.get(frame));
  if(!process.env.DAY_RIG_ONLY){
   // Move and rotate the real kitchen through the same furniture draft + save UI.
   await p.evaluate(()=>dailyPlan('dayHome','cook','下厨煮汤'));await settle('dayHome','cook');await root.getByRole('button',{name:'今天的日程',exact:true}).click();await root.getByRole('button',{name:'布置小家',exact:true}).click();
   await ready();await frame.waitForFunction(()=>CharDayScene.inspect().editing&&!CharDayScene.inspect().changing);const moved=await frame.evaluate(()=>CharDayScene.editMove('kitchen',{x:5.5,z:0,heading:Math.PI/2}));assert.equal(moved,true);await frame.waitForFunction(()=>!CharDayScene.inspect().changing);await root.locator('[data-wk=cdaysavelayout]').click();await root.locator('[data-wk=cdaytools]').waitFor();await ready();await settle('dayHome','cook');let s=await state();assert.ok(Math.abs(s.avatarHeading-Math.PI*1.5)<.01);assert.ok(Math.abs(s.task.pot.x-5.5-.22)<.01);assert.ok(Math.abs(s.task.pot.z+1.08)<.01);await p.screenshot({path:path.join(out,'rotated-kitchen.png')});result.movedKitchen=true;
   await p.evaluate(()=>dailyPlan('dayHome',null,'在家做晚餐'));await settle('dayHome','cook');result.legacyCook=true;
   await p.evaluate(()=>dailyPlan('dayHome','sleep','在家睡觉'));await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.gesture==='sleep'&&!s.route.length&&!s.changing;});s=await state();for(const name of ['cup','bowl','book','ladle','chopsticks'])assert.ok(!s.dailyAction?.[name]);result.sleepClearsProps=true;
   for(const [width,height]of [[320,568],[390,844],[430,932],[844,390]]){await p.setViewportSize({width,height});await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));result.sizes.push({width,height});}
   await p.clock.setFixedTime(new Date('2026-10-09T11:01:00Z'));await root.getByText('这会儿没排事情',{exact:true}).waitFor();assert.equal((await state()).task,null);result.gapClearsTask=true;
   const beforeDemo=await p.evaluate(()=>({plans:JSON.stringify(dailyRef.current),writes:dailyWrites.length}));await root.getByRole('button',{name:'换人',exact:true}).click();await root.getByRole('button',{name:'先看一段示例',exact:true}).click();await ready();
   for(const kind of ['eat','read','walk','cook','drink','sleep']){if(kind==='walk')await frame.waitForFunction(()=>CharDayScene.inspect().activity.action==='walk');else if(kind==='sleep')await frame.waitForFunction(()=>CharDayScene.inspect().gesture==='sleep');else await frame.waitForFunction(kind=>CharDayScene.inspect().task?.kind===kind,kind);if(kind==='cook'){await p.waitForTimeout(800);await p.screenshot({path:path.join(out,'demo-cook.png')});}if(kind!=='sleep')await root.getByRole('button',{name:'下一段',exact:true}).click();}
   assert.deepEqual(await p.evaluate(()=>({plans:JSON.stringify(dailyRef.current),writes:dailyWrites.length})),beforeDemo);result.demoAllFourWithoutWrites=true;

   assert.equal(await p.evaluate(()=>dailyModels),0);assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_fairyGardenSaves',[]))),await p.evaluate(()=>dailyGames));
   const writes=await p.evaluate(()=>dailyWrites.filter(k=>/^x_(?:fairyGardenSaves|chat(?::|$))/.test(k)));assert.deepEqual(writes,[]);
  }
  assert.deepEqual(errors,[]);result.errors=errors;result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,engine,actions:result.actions.length,rig:result.rig.length,frames:result.rig.reduce((n,x)=>n+x.frames,0),motionRig:result.motionRig.length}));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:frame?await frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null):null},null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
