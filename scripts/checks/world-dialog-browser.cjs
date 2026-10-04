const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.WORLD_DIALOG_URL||'http://127.0.0.1:18961',out=process.env.WORLD_DIALOG_EVIDENCE||'/tmp/world-dialog-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),result={errors:[],modes:[]};try{
 const p=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'});p.setDefaultTimeout(45000);p.on('pageerror',e=>result.errors.push(e.message));
 await p.clock.setFixedTime(new Date('2026-10-05T10:00:00-05:00'));
 async function mount(mode,world,reset=false){
  await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyGardenApp&&window.txtVaultState?.().done);
  await p.evaluate(async({mode,world,reset})=>{
   const cid='dialog-person',archiveId='dialog-'+mode;window.dialogRoomKey=ChatRooms.chatKey(cid,'dialog-room');const key=mode==='solo'?'x_fairyGarden:dialog-'+mode:'x_fairyGarden::'+dialogRoomKey;window.dialogTestKey=key;
   ChatRooms.save(cid,{...ChatRooms.PRESETS.garden,id:'dialog-room',name:'对话测试房'});
   if(reset){const w=await import('./apps/fairy-garden/world.mjs'),garden=w.setGuide({...w.freshState(),day:43,herbs:17,position:{...w.MAPS.garden.station.target}},false);garden.companion.mode='wait';
    saveJSON(key,{version:1,id:archiveId,partnerId:cid,world:garden,worlds:{garden},journey:{keep:'unchanged'},dialogs:{[cid]:[{role:'assistant',content:'LEGACY_SHARED_LINE',status:'done'}]}});
    saveJSON('x_chat:'+dialogRoomKey,[{role:'assistant',content:'LEGACY_SHARED_LINE',kind:'garden',ts:1},{role:'user',content:'PHONE_ONLY_LINE',ts:2}]);
   }
   window.dialogCalls=[];window.failNextDialog=false;window.callAI=async(_a,sys,msg,options)=>{dialogCalls.push({sys,msg,options});if(failNextDialog){failNextDialog=false;throw Error('TEST_FAILED_ONCE');}return JSON.stringify({reply:['ANSWER_'+(sys.includes('【绒绒小镇】')?'pets':sys.includes('【远行列车】')?'train':'garden')],action:{kind:'none'}});};
   const el=document.createElement('div');el.id='world-dialog-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);
   const src=await (await fetch('js/app.js')).text(),a=src.indexOf('  const gardenHistory ='),b=src.indexOf('  const openGardenRoomFor =',a);if(a<0||b<a)throw Error('missing actual room writer');
   function Harness(){const [chatRows,setChatRows]=React.useState(()=>loadJSON('x_chat:'+dialogRoomKey,[])),chats={[dialogRoomKey]:chatRows};
    const pChat=(room,fn)=>{const next=fn(loadJSON('x_chat:'+room,[]));if(!saveJSON('x_chat:'+room,next))throw Error('chat not saved');setChatRows(next);};
    const ca=src.indexOf('  const roomContextFor ='),cb=src.indexOf('  const roomTurnsOf =',ca);
    const role=[{id:cid,name:'测试同行者',persona:'沉稳'}];
    const contextFactory=new Function('gardenHistory','ctxFor','roomHistoryText','directives','loreForContext','gateRoomContext','roomStatesRef','profile',src.slice(ca,cb)+';return roomContextFor;');
    const historyFor=(room,world,id)=>FairyWorldDialogs.select(chats[room]||[],world,id).map(m=>({...m,status:'done'}));
    const roomContext=contextFactory(historyFor,()=>({persona:'沉稳',recentChat:'ALL_ROOM_LEAK'}),()=>chatRows.map(m=>m.content).join('\n'),{},()=>'',(ctx,_c,_k,room)=>ChatRooms.gateCtx(ctx,room),{current:{}},{name:'测试'});
    const factory=new Function('chats','GARDEN_LOG','pChat','characters','buildBundle','roomContextFor','roomPromptFor',src.slice(a,b)+';return {gardenRecord,gardenRecordFor};')(chats,100,pChat,role,ctx=>JSON.stringify(ctx),roomContext,()=> '');
    const props={storeKey:key,entryWorld:world,characters:[{id:cid,name:'测试同行者',persona:'沉稳'}],active:{test:true},profile:{name:'测试'},toast:()=>{},onBack:()=>{},...(mode==='room'?{record:factory.gardenRecord(dialogRoomKey)}:mode==='room-picker'?{recordFor:factory.gardenRecordFor}:{})};
    return React.createElement(FairyGardenApp,props);
   }
   window.dialogRoot=ReactDOM.createRoot(el);dialogRoot.render(React.createElement(Harness));
  },{mode,world,reset});
  await p.waitForFunction(world=>{const win=document.querySelector('#world-dialog-root iframe')?.contentWindow;return world==='pets'?win?.PetGame?.ready:world==='train'?win?.TrainGame?.ready:win?.gardenDebug?.getReady();},world);
  const r=p.locator('#world-dialog-root');let f=p.frames().find(f=>f.url().includes(world==='pets'?'/apps/pets/':world==='train'?'/apps/train/':'/apps/fairy-garden/'));
  if(world==='pets'&&await r.getByRole('button',{name:'保存并进入',exact:true}).count())await r.getByRole('button',{name:'保存并进入',exact:true}).click();
  return {r,f};
 }
 async function open(world,r,f){
  if(world==='pets')await f.locator('#pet-talk').click();
  else if(world==='train')await f.locator('#open-chat').click();
  else{await r.getByRole('button',{name:'说话',exact:true}).click();await r.getByRole('button',{name:'看看聊天记录',exact:true}).click();}
 }
 async function send(world,r,f,text){
  if(world==='train'){await f.locator('#desk-message').fill(text);await f.locator('#desk-send').click();await f.waitForFunction(()=>!document.querySelector('#desk-send').disabled);}
  else{await r.getByLabel('对同行者说').fill(text);await r.getByRole('button',{name:'发送',exact:true}).click();await r.getByLabel('对同行者说').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#world-dialog-root input[aria-label="对同行者说"]').disabled);}
 }
 for(const mode of ['solo','room','room-picker']){
  for(const world of ['garden','train','pets']){
   console.log('CHECK',mode,world);const {r,f}=await mount(mode,world,world==='garden');await open(world,r,f);
   const chat=world==='train'?f.locator('#desk-chat'):world==='pets'?r.locator('[data-pet-chat]'):r.locator('[aria-label="庭院聊天"]');
   let txt=await chat.innerText();assert.ok(!txt.includes('QUESTION_'),'new world must not show another world');
   if(world==='garden'){await p.evaluate(()=>{failNextDialog=true;});await send(world,r,f,'QUESTION_garden');await r.getByRole('button',{name:'重试上次未完成的回复'}).click();await p.waitForFunction(()=>!document.querySelector('#world-dialog-root input[aria-label="对同行者说"]').disabled);}
   else await send(world,r,f,'QUESTION_'+world);
   await p.waitForFunction(()=>dialogCalls.some(c=>c.sys.includes('【这个世界里你们最近的对话】')));
   const sys=await p.evaluate(()=>dialogCalls.at(-1).sys);for(const other of ['garden','train','pets'].filter(x=>x!==world))assert.ok(!sys.includes('QUESTION_'+other),other+' leaked into '+world);
   assert.ok(!sys.includes('LEGACY_SHARED_LINE'));assert.ok(!sys.includes('PHONE_ONLY_LINE'));assert.ok(!sys.includes('ALL_ROOM_LEAK'));
   if(world==='pets'){const premise=await p.evaluate(()=>FairyWorldDialogs.cognition('pets'));assert.ok(sys.includes(premise));assert.ok(sys.includes('一起养宠的日常'));for(const stale of ['这一档宠物小游戏','一起生活在魔法庭院','游戏中的生活按游戏经历'])assert.ok(!sys.includes(stale),stale);}
   txt=await chat.innerText();assert.ok(txt.includes('QUESTION_'+world));assert.ok(txt.includes('ANSWER_'+world));
   for(const width of [320,390,430]){await p.setViewportSize({width,height:width===320?568:width===390?844:932});await p.waitForTimeout(120);assert.ok(await r.evaluate(el=>el.scrollWidth<=innerWidth));
    if(world!=='train'){const old=r.locator('[data-world-legacy]');if(await old.count()){await old.locator('summary').click();assert.ok((await old.innerText()).includes('LEGACY_SHARED_LINE'));const input=await r.getByLabel('对同行者说').boundingBox();assert.ok(input.y+input.height<=p.viewportSize().height);await old.locator('summary').click();}}
    await p.screenshot({path:path.join(out,mode+'-'+world+'-'+width+'.png')});
   }
   if(world==='train'){
    await p.locator('[data-train-toolbar] [data-watch=back]').click();await r.getByRole('button',{name:'设置',exact:true}).click();
    for(const width of [320,390,430]){await p.setViewportSize({width,height:width===320?568:width===390?844:932});const old=r.locator('[data-world-legacy]');await old.locator('summary').click();assert.ok((await old.innerText()).includes('LEGACY_SHARED_LINE'));assert.ok(await r.evaluate(el=>el.scrollWidth<=innerWidth));await p.screenshot({path:path.join(out,mode+'-train-legacy-'+width+'.png')});await old.locator('summary').click();}
   }
   await p.setViewportSize({width:390,height:844});
   const again=await mount(mode,world);await open(world,again.r,again.f);const re=world==='train'?again.f.locator('#desk-chat'):world==='pets'?again.r.locator('[data-pet-chat]'):again.r.locator('[aria-label="庭院聊天"]');
   assert.ok((await re.innerText()).includes('QUESTION_'+world));for(const other of ['garden','train','pets'].filter(x=>x!==world))assert.ok(!(await re.innerText()).includes('QUESTION_'+other));
  }
  const saved=await p.evaluate(mode=>({archive:loadJSON(dialogTestKey,null),phone:loadJSON('x_chat:'+dialogRoomKey,[])}),mode);
  assert.equal(saved.archive.journey.keep,'unchanged');assert.equal(saved.archive.worlds.garden.herbs,17);assert.ok(saved.archive.worlds.train);assert.ok(saved.archive.worlds.pets);
  const rows=mode!=='solo'?saved.phone:saved.archive.dialogs['dialog-person'];
  for(const world of ['garden','train','pets']){assert.equal(rows.filter(m=>m.content==='QUESTION_'+world).length,1);assert.equal(rows.filter(m=>m.content==='ANSWER_'+world).length,1);for(const m of rows.filter(m=>m.content==='QUESTION_'+world||m.content==='ANSWER_'+world)){assert.equal(m.gameWorld,world);assert.equal(m.gameArchiveId,'dialog-'+mode);}}
  assert.ok(rows.some(m=>m.content==='LEGACY_SHARED_LINE'&&!m.gameWorld));if(mode!=='solo')assert.ok(saved.phone.some(m=>m.content==='PHONE_ONLY_LINE'));
  fs.writeFileSync(path.join(out,mode+'-save.json'),JSON.stringify(saved,null,2));result.modes.push({mode,allWorlds:true,reload:true,gardenFailureRetry:true,worldPromptIsolation:true,phonePreserved:mode!=='solo'});
 }
 assert.deepEqual(result.errors,[]);result.ok=true;
 }catch(e){result.error=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
