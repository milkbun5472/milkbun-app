const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18984',engine=process.env.DAY_ENGINE||'chromium',out=process.env.DAY_EVIDENCE||'/tmp/char-day-browser';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),b=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=app.slice(a,b);
(async()=>{const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],result={engine,widths:[]};let frame;try{
  p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-09T10:10:00Z'));await p.goto(base);await p.waitForFunction(()=>window.FairyGardenApp&&window.CharDayApp&&window.ReactDOM);await p.waitForFunction(()=>typeof txtVaultState==='function'&&txtVaultState().ok);
  await p.evaluate(writer=>{
    window.dayChars=[{id:'day-a',name:'测试角色甲',gender:'male',tz:'0'},{id:'day-b',name:'测试角色乙',tz:'8'}];
    let plans={};window.dayRef={current:plans};const save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;');window.daySave=save(fn=>{plans=fn(plans);},dayRef,saveJSON);
    daySave('day-a','2026-10-09',{seqs:[{seq:1,time:'08:00',end:'09:00',title:'用早饭',location:'府中餐桌',type:'meal'},
      {seq:2,time:'10:00',end:'12:00',title:'核对军报',location:'议事处',type:'work'},
      {seq:3,time:'14:00',end:'16:00',title:'去河边走走',location:'河边',type:'out'},
      {seq:4,time:'19:00',end:'21:00',title:'坐在窗边喝茶',location:'窗边',type:'coffee'},
      {seq:5,time:'23:00',end:'24:00',title:'夜里歇下',location:'寝室',type:'sleep'}]});
    window.dayWriteCount=0;window.dayOriginalSave=saveJSON;window.saveJSON=(...args)=>{dayWriteCount++;return dayOriginalSave(...args);};window.dayModelCount=0;window.callAI=()=>{dayModelCount++;throw Error('Unexpected model call');};
    window.dayNavigation=[];const el=document.createElement('div');el.id='char-day-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);
    window.dayRoot=ReactDOM.createRoot(el);dayRoot.render(React.createElement(FairyGardenApp,{characters:dayChars,day:{plansFor:c=>dayRef.current[c.id]||{},taFor:()=> '他',lookFor:c=>c.id==='day-a'?{outfit:'academy',hair:'korean',hairColor:'#43352e',wardrobe:{academy:{cloth:'#a8be83',trim:'#ebcedf',bottom:'#766956',boots:'#163541'}}}:{outfit:'garden',hair:'bob',hairColor:'#935f43'},onSchedule:c=>dayNavigation.push(c.id)},toast:()=>{},onBack:()=>{}}));
  },writer);
  const root=p.locator('#char-day-root'),shot=name=>p.screenshot({path:path.join(out,name+'.png')}),ready=async()=>{await p.waitForFunction(()=>document.querySelector('#char-day-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/'));};
  const state=()=>frame.evaluate(()=>CharDayScene.inspect()),settle=async()=>{await frame.waitForFunction(()=>CharDayScene.inspect().map&&CharDayScene.inspect().gesture&&!CharDayScene.inspect().changing);};
  if(!process.env.DAY_ROUTE_ONLY){
  await root.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await shot('picker');await root.locator('[data-wk=cdaypick]').filter({hasText:'测试角色甲'}).click();await ready();await settle();assert.equal((await state()).map,'dayWork');assert.equal((await state()).gesture,'rest');assert.match(await root.locator('[data-wk=cdaynow]').innerText(),/核对军报/);
  const entry=(await state()).position;await frame.waitForFunction(({x,z})=>{const s=CharDayScene.inspect();return s.route.length&&Math.hypot(s.position.x-x,s.position.z-z)>.6;},entry);result.entryWalking=true;await shot('entry-walking');
  await frame.waitForFunction(()=>{const s=CharDayScene.inspect(),v=s.chinContact;return !s.route.length&&s.emotion==='chin'&&v&&v[1]<-.7&&v[2]>.75;});result.handOutsideFace=true;
  const joint=(await state()).arm;assert.ok(joint?.length===4);await frame.waitForFunction(a=>{const s=CharDayScene.inspect();return s.arm?.some((n,i)=>Math.abs(n-a[i])>.08);},joint);
  assert.equal((await state()).dailyAction.book,false);result.continuousWorkMovement=true;await shot('work');
  for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
    await p.setViewportSize({width:w,height:h});await p.waitForTimeout(150);const boxes=await root.evaluate(el=>{const page=el.querySelector('[data-wk=cdaypage]'),head=page.querySelector('[data-wk=head]'),scene=page.querySelector('[data-wk=cdayscene]'),tools=page.querySelector('[data-wk=cdaytools]');return{overflow:page.scrollWidth>page.clientWidth,head:head.getBoundingClientRect().toJSON(),scene:scene.getBoundingClientRect().toJSON(),tools:tools.getBoundingClientRect().toJSON()};});
    assert.equal(boxes.overflow,false);assert.ok(boxes.tools.height>=54&&boxes.tools.height<=65);assert.ok(Math.abs(boxes.tools.bottom-h)<2);assert.ok(boxes.scene.height>170);await root.getByRole('button',{name:'看全景',exact:true}).click();assert.equal((await state()).following,false);await root.getByRole('button',{name:'跟着TA',exact:true}).click();assert.equal((await state()).following,true);await shot('scene-'+w+'x'+h);result.widths.push({w,h,...boxes});
  }
  await p.setViewportSize({width:390,height:844});
  const area=await frame.locator('canvas').boundingBox();await p.mouse.move(area.x+area.width*.5,area.y+area.height*.6);await p.mouse.down();await p.mouse.move(area.x+area.width*.72,area.y+area.height*.6,{steps:6});await p.mouse.up();
  await root.getByRole('button',{name:'跟着TA',exact:true}).and(p.locator('[aria-pressed="false"]')).waitFor();assert.equal((await state()).following,false);
  await root.getByRole('button',{name:'跟着TA',exact:true}).click();assert.equal((await state()).following,true);result.dragFollowSync=true;
  // Explicit previews move only the stage; real plans and original game saves remain untouched.
  const baseline=await p.evaluate(()=>({plans:JSON.stringify(dayRef.current),writes:dayWriteCount,games:JSON.stringify(loadJSON('x_fairyGardenSaves',[]))}));
  await root.getByRole('button',{name:'今天的日程',exact:true}).click();const scroll=root.locator('[data-wk=cdaybody]');await scroll.evaluate(el=>el.scrollTop=70);await root.locator('[data-wk=cdayrow]').filter({hasText:'用早饭'}).click();await ready();await settle();assert.equal((await state()).map,'dayHome');assert.match(await root.locator('[data-wk=cdaynow]').innerText(),/预览日程/);await frame.waitForFunction(()=>CharDayScene.inspect().gesture==='eat');await shot('meal-preview');
  await root.getByRole('button',{name:'回到此刻',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);await shot('walking-to-work');
  await root.getByRole('button',{name:'今天的日程',exact:true}).click();await root.locator('[data-wk=cdayrow]').filter({hasText:'坐在窗边喝茶'}).click();await ready();await settle();await frame.waitForFunction(()=>CharDayScene.inspect().gesture==='tea');await shot('tea-preview');
  assert.equal(await p.evaluate(()=>JSON.stringify(dayRef.current)),baseline.plans);assert.equal(await p.evaluate(()=>dayWriteCount),baseline.writes);assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_fairyGardenSaves',[]))),baseline.games);result.previewReadOnly=true;
  // Cosmetic choices are per-character and use the real durable IDB writer.
  await root.getByRole('button',{name:'小家样式',exact:true}).click();await root.locator('[data-wk=cdaystyle]').filter({hasText:'深木安静'}).click();
  await root.getByText('已记住这位角色的小家样式',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>loadJSON('x_charDayHomes',{}).styles['day-a']),'dusk');
  await shot('home-style-options');
  for(const [w,h]of [[320,568],[430,932],[844,390]]){await p.setViewportSize({width:w,height:h});const layout=await root.locator('[data-wk=cdaypage]').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,scrolls:el.querySelectorAll('[data-wk=cdaybody]').length}));assert.equal(layout.overflow,false);assert.equal(layout.scrolls,1);await shot('style-options-'+w+'x'+h);}await p.setViewportSize({width:390,height:844});

  await p.evaluate(()=>{window.styleWriter=saveJSONDurable;window.saveJSONDurable=async()=>false;});
  await root.locator('[data-wk=cdaystyle]').filter({hasText:'清爽浅色'}).click();await root.getByText('这次没能保存，原样式还在，可以再试一次。',{exact:true}).waitFor();
  assert.equal(await root.locator('[data-wk=cdaystyle][aria-pressed=true]').innerText(),'深木安静 · 正在用');
  assert.equal(await p.evaluate(()=>loadJSON('x_charDayHomes',{}).styles['day-a']),'dusk');
  await p.evaluate(()=>{window.saveJSONDurable=styleWriter;});await root.getByRole('button',{name:'回去看看',exact:true}).click();await ready();await settle();
  assert.equal((await state()).spaceStyle,'dusk');await shot('home-dark-style');result.perCharacterStyle=true;result.styleFailureRollback=true;
  assert.equal(await p.evaluate(()=>JSON.stringify(dayRef.current)),baseline.plans);

  await root.getByRole('button',{name:'回到此刻',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);
  // A live revision uses the real schedule writer and interrupts an existing route.
  await p.evaluate(()=>{window.dayDelivery=[];const w=document.querySelector('#char-day-root iframe').contentWindow,orig=w.CharDayScene.setSnapshot;w.CharDayScene.setSnapshot=data=>{dayDelivery.push({key:data.key,stage:data.presentation});try{return orig(data);}catch(e){dayDelivery.push({error:e.message});throw e;}};});
  await p.evaluate(()=>{const plan=dayRef.current['day-a']['2026-10-09'];daySave('day-a','2026-10-09',{...plan,seqs:plan.seqs.map(q=>q.seq===2?{...q,type:'out',title:'临时陪她走走',location:'河边',deviation:{plan:q.title,reason:'刚刚约好了',actual:'临时陪她走走'}}:q)});});
  await root.locator('[data-wk=cdaynow]').getByText('临时陪她走走',{exact:true}).waitFor();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayStreet'&&!CharDayScene.inspect().changing);const p0=(await state()).position;await frame.waitForFunction(({x,z})=>{const p=CharDayScene.inspect().position;return Math.hypot(p.x-x,p.z-z)>.5;},p0);await shot('outdoor-walk');result.realRevision=true;result.actualWalking=true;
  await root.getByRole('button',{name:'看全景',exact:true}).click();await shot('street-overview');await root.getByRole('button',{name:'跟着TA',exact:true}).click();
  // A real meal revision routes to the new shop and occupies the actual chair.
  await p.evaluate(()=>{const plan=dayRef.current['day-a']['2026-10-09'];daySave('day-a','2026-10-09',{...plan,seqs:plan.seqs.map(q=>q.seq===2?{...q,type:'meal',title:'在街角餐馆吃午饭',location:'街角餐馆',deviation:null}:q)});});
  await root.locator('[data-wk=cdaynow]').getByText('在街角餐馆吃午饭',{exact:true}).waitFor();
  await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.map==='dayCafe'&&s.gesture==='eat'&&!s.route.length&&!s.changing;});
  const cafe=await state();assert.ok(cafe.seat);assert.ok(Math.abs(cafe.avatarPosition[0]-cafe.seat.x)<.001);assert.ok(cafe.furnitureNodes.includes('cafe-table'));await shot('cafe-meal');
  await root.getByRole('button',{name:'看全景',exact:true}).click();await shot('cafe-overview');result.externalMeal=true;

  await p.clock.setFixedTime(new Date('2026-10-09T12:05:00Z'));await root.getByText('这会儿没排事情',{exact:true}).waitFor();result.gap=true;
  // Yesterday's sleep survives local midnight and never turns into a daytime task.
  await p.clock.setFixedTime(new Date('2026-10-10T02:00:00Z'));await root.getByText('夜里歇下',{exact:true}).waitFor();await frame.waitForFunction(()=>{const s=CharDayScene.inspect();return s.map==='dayHome'&&s.gesture==='sleep'&&s.bed&&s.visualTilt < -1.4&&s.visible&&!s.error;});await shot('midnight-sleep');result.sleepCarry=true;
  await root.getByRole('button',{name:'换人',exact:true}).click();await root.locator('[data-wk=cdaypick]').filter({hasText:'测试角色乙'}).click();await ready();await settle();assert.match((await state()).look,/#935f43/);assert.equal((await state()).spaceStyle,'warm');await root.getByRole('button',{name:'去日历排今天',exact:true}).click();assert.deepEqual(await p.evaluate(()=>dayNavigation),['day-b']);assert.equal((await state()).charId,'day-b');result.noSchedule=true;result.characterIsolation=true;
  await root.getByRole('button',{name:'换人',exact:true}).click();await root.getByRole('button',{name:'先看一段示例',exact:true}).click();await ready();await settle();await root.getByRole('button',{name:'下一段',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);await frame.waitForFunction(()=>CharDayScene.inspect().gesture==='read');await shot('demo-read');assert.match(await root.locator('[data-wk=cdaynow]').innerText(),/示例试玩/);result.demo=true;
  await root.getByRole('button',{name:'换人',exact:true}).click();await root.locator('[data-wk=head] button').first().click();await root.locator('[data-wk=fgworld]').filter({hasText:'微光庭院'}).waitFor();result.back=true;
  assert.equal(await p.evaluate(()=>dayModelCount),0);
  }
  await p.clock.setFixedTime(new Date('2026-10-10T02:00:00Z'));
  // The real App starts from persisted fixture data and owns the calendar return path.
  await p.evaluate(async()=>{
    await saveJSONDurable('x_characters',dayChars);
    await saveJSONDurable('x_schedules',dayRef.current);
    await saveJSONDurable('x_homeLayout',{'0':['fairyGarden']});
    await saveJSONDurable('x_homeFolders',[]);
    await saveJSONDurable('x_companion',{looks:{'day-a':{outfit:'ranger',hair:'korean',hairColor:'#43352e'}}});
  });
  await p.reload();await p.locator('#qiu-splash button').click();await p.locator('#qiu-splash').waitFor({state:'hidden'});await p.locator('[data-appkey=fairyGarden]').click();
  await p.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await p.locator('[data-wk=cdaypick]').filter({hasText:'测试角色甲'}).click();
  await p.locator('[data-wk=cdaynow]').getByText('夜里歇下',{exact:true}).waitFor();
  await p.getByRole('button',{name:'今天的日程',exact:true}).click();await p.getByRole('button',{name:'去日历看完整安排',exact:true}).click();
  await p.locator('[data-wk=calpage]').waitFor();assert.match(await p.locator('[data-wk=calperson][data-on="1"]').innerText(),/测试角色甲/);await shot('real-app-calendar');
  await p.locator('[data-wk=head] button').first().click();await p.locator('[data-wk=head] button').first().click();await p.locator('[data-wk=cdaynow]').getByText('夜里歇下',{exact:true}).waitFor();
  await p.waitForFunction(()=>{const s=document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect();return s?.charId==='day-a'&&s.map==='dayHome'&&s.gesture==='sleep'&&s.bed&&s.spaceStyle==='dusk'&&s.visualTilt < -1.4&&s.visible&&!s.changing&&!s.error;});await shot('real-app-return');result.actualAppCalendarReturn=true;
  assert.equal(await p.locator('[role=status]').filter({hasText:'失败'}).count(),0);assert.deepEqual(errors,[]);result.errors=errors;result.actualSleepPose=true;result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:frame?await stateSafe(frame):null,delivery:await p.evaluate(()=>window.dayDelivery),frames:p.frames().map(f=>({url:f.url(),detached:f.isDetached()})),actualScene:await p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect()),body:await p.locator('body').innerText({timeout:1000}).catch(()=>null)},null,2));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
async function stateSafe(f){return f.evaluate(()=>CharDayScene.inspect()).catch(()=>null);}
