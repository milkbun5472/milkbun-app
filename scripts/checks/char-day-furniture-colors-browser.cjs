// Actual App, native renderer and existing durable album writer; disposable fixtures.
const {moreItem,openMore,activity,closeLife,lifeAction}=require('./char-day-ui-helpers.cjs');
const pw=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=process.cwd(),engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-furniture-colors';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync('js/app.js','utf8'),a=app.indexOf('  const saveSchedDay ='),z=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&z>a);
(async()=>{
 const server=process.env.DAY_URL?null:http.createServer((req,res)=>{const file=path.resolve(repo,'.'+(req.url.split('?')[0]==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}}).listen(0,'127.0.0.1');
 if(server)await new Promise(r=>server.on('listening',r));const base=process.env.DAY_URL||'http://127.0.0.1:'+server.address().port;
 const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[],result={engine,layouts:[]};
 try{
  p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.clock.setFixedTime(new Date('2026-10-09T10:10:00Z'));
  await p.goto(base);await p.waitForFunction(()=>window.CharDayKit&&typeof txtVaultState==='function'&&txtVaultState().ok);
  await p.evaluate(async writer=>{
   const chars=[{id:'photo-a',name:'取景测试甲',gender:'male',tz:'0'},{id:'photo-b',name:'取景测试乙',gender:'female',tz:'0'}],ref={current:{}},save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{ref.current=fn(ref.current);},ref,saveJSON);
   for(const c of chars)save(c.id,'2026-10-09',{seqs:[{seq:1,time:'08:00',end:'20:00',title:'在家看会书',location:'小家',type:'home',world:{scene:'dayHome',spot:'read',manual:true}}]});
   const features=Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(k=>[k,{global:false,chars:{}}]));
   for(const [k,v]of Object.entries({x_characters:chars,x_schedules:ref.current,x_profile:{name:'测试读者'},x_homeLayout:{'0':['fairyGarden']},x_homeFolders:[],x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features},x_charDayHomes:{future:{keep:1},kitchens:{'photo-b':{ingredients:{egg:8}}},visitorActivities:{'photo-a':'manual','photo-b':'manual'}},x_companion:{charId:'photo-a',float:false,looks:{'photo-a':{outfit:'academy',hair:'korean'}}},'x_chat:photo-a':[{role:'assistant',content:'原来的测试聊天',ts:Date.now()}]}))await saveJSONDurable(k,v);
  },app.slice(a,z));
  const enter=async(name='取景测试甲')=>{
   if(await p.locator('#qiu-splash').isVisible()){await p.locator('#qiu-splash button').click();await p.locator('#qiu-splash').waitFor({state:'hidden'});}
   await p.evaluate(()=>{window.photoTestAI=0;window.callAI=()=>{photoTestAI++;throw Error('Unexpected AI');};});
   await p.locator('[data-appkey=fairyGarden]').click();await p.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await p.locator('[data-wk=cdaypick]').filter({hasText:name}).click();
   await p.waitForFunction(()=>{const s=document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect();return s?.ready&&!s.changing&&!s.route.length&&!s.visitor.busy;});
  };

  const root=()=>p.locator('[data-wk=cdaypage]'),scene=()=>p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.inspect()),api=(fn,arg)=>p.frames().find(f=>f.url().includes('/fairy-garden/day/')).evaluate(fn,arg),shot=name=>p.screenshot({path:path.join(out,name+'.png')});
  const settle=()=>p.waitForFunction(()=>{const s=document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene.inspect();return s?.editing&&!s.changing&&!s.dragging;});
  const begin=async()=>{await moreItem(p,'cdaydecorate');await settle();},panel=async()=>{await root().locator('[data-wk=cdaydecoractions] [data-part=piece]').click();await root().locator('[data-wk=cdaypiecepreview]').waitFor();},back=async()=>{await root().getByRole('button',{name:'回去摆放',exact:true}).click();await root().locator('[data-wk=cdaydecorpanel]').waitFor({state:'detached'});};
  const partInput=id=>root().locator('[data-wk=cdaypartcolor][data-part='+id+'] input:not([type=color])'),colour=async(id,value)=>{await partInput(id).fill(value);await settle();await p.waitForFunction(({id,value})=>{const s=document.querySelector('[data-wk=cdayscene] iframe').contentWindow.CharDayScene.inspect();return s.homePlacements[s.selected].partColors?.[id]===value;},{id,value});};
  await p.reload();await enter();const baseline=await p.evaluate(()=>({plans:JSON.stringify(loadJSON('x_schedules',{})),other:JSON.stringify(loadJSON('x_charDayHomes',{}).kitchens['photo-b'])}));await begin();
  // Real native builder and material batches: every component of all 72 models,
  // including stored furniture, nested book groups, mirrors, glass and curtains.
  console.log("native audit starting");result.native=await api(async()=>{
   const {createSpaceView}=await import('./space-view.mjs'),{createHomeFurniture}=await import('./home-furniture.mjs'),{createRoomKit}=await import('./places/room-kit.mjs'),{HOME_CATALOG,furniturePalette}=await import('./home-catalog.mjs'),{tagFurnitureParts}=await import('./home-parts.mjs'),{CORE_SPACES,styleOf}=await import('./spaces.mjs'),{disposeMap}=await import('../map-loader.mjs'),{createKitchenView}=await import('./kitchen-view.mjs');
   const view=p=>createSpaceView('dayHome','warm',{...CORE_SPACES.dayHome,furniture:[{...p,x:0,z:0,heading:0}],structure:[]},{furnitureOnly:true});
   const materials=g=>{const rows=[];g.traverse(o=>{if(o.isMesh)rows.push({part:o.userData.furniturePart,color:o.material.color.getHexString(),transparent:o.material.transparent,opacity:o.material.opacity,roughness:o.material.roughness,metalness:o.material.metalness,depthWrite:o.material.depthWrite,texture:!!o.material.map,count:o.geometry.attributes.position.count});});return rows;};
   const checks=[],fallback=[];
   for(const p of HOME_CATALOG){
    const v=view(p),g=v.root.children[0],parts=g.userData.parts,defaults=materials(g),k=createRoomKit(),raw=createHomeFurniture(k,{...p,x:0,z:0,heading:0},furniturePalette(p,styleOf('warm')));tagFurnitureParts(raw,p);
    raw.traverse(o=>{if(o.isMesh&&o.userData.furniturePart==='structure')fallback.push({id:p.id,name:o.name});});
    if(new Set(parts.map(q=>q.id)).size!==parts.length||parts.length<2)throw Error('missing components: '+p.id);
    if(defaults.some(q=>!parts.some(p=>p.id===q.part)))throw Error('missing batch identity: '+p.id);
    // No colour edit: per-component splitting changes neither default appearance
    // nor total geometry. Compare against the constructed source before batching.
    const original=new Map(),batched=new Map();raw.traverse(o=>{if(o.isMesh)original.set(o.material.color.getHexString(),(original.get(o.material.color.getHexString())||0)+(o.geometry.index?.count||o.geometry.attributes.position.count));});for(const q of defaults)batched.set(q.color,(batched.get(q.color)||0)+q.count);
    if(JSON.stringify([...original].sort())!==JSON.stringify([...batched].sort()))throw Error('default geometry/colours changed: '+p.id);
    disposeMap(k.root);
    for(const part of parts){
     const edited=view({...p,partColors:{[part.id]:'#1234ab'}}),rows=materials(edited.root.children[0]);
     if(rows.length!==defaults.length)throw Error('batch changed: '+p.id);
     for(let i=0;i<rows.length;i++){const row=rows[i],before=defaults[i];if(row.color!==(row.part===part.id?'1234ab':before.color))throw Error('component leaked: '+p.id+'/'+part.id+'/'+row.part);for(const key of ['transparent','opacity','roughness','metalness','depthWrite','texture','count'])if(row[key]!==before[key])throw Error('material lost: '+p.id+'/'+key);}
     disposeMap(edited.root);checks.push({id:p.id,part:part.id,label:part.label});
    }
    disposeMap(v.root);
   }
   // Two identically coloured seats must still support different component colours.
   const p=HOME_CATALOG.find(p=>p.id==='sofa'),multi=createSpaceView('dayHome','warm',{...CORE_SPACES.dayHome,furniture:[{...p,id:'a',catalogId:p.id,x:0,z:0,heading:0,material:'fabric',color:'#445566',partColors:{seat:'#1234ab'}},{...p,id:'b',catalogId:p.id,x:4,z:0,heading:0,material:'fabric',color:'#445566',partColors:{back:'#ac1234'}}],structure:[]},{furnitureOnly:true});
   const a=materials(multi.root.getObjectByName('a')),b=materials(multi.root.getObjectByName('b'));if(!a.some(q=>q.part==='seat'&&q.color==='1234ab'&&q.texture)||a.some(q=>q.color==='ac1234')||!b.some(q=>q.part==='back'&&q.color==='ac1234'&&q.texture)||b.some(q=>q.color==='1234ab'))throw Error('instance/material isolation');disposeMap(multi.root);
   const kitchen=view({...HOME_CATALOG.find(p=>p.id==='kitchen'),partColors:{pot:'#1234ab'}}),before=materials(kitchen.root),kv=createKitchenView();const map={id:'dayHome',spots:[{action:'cook',piece:'kitchen'}],furniture:[{id:'kitchen',kind:'kitchen',x:0,z:0}]};kv.update(kitchen.root,map,{id:'cook-test',kind:'cook',recipeId:'soup'},null,{passive:true,index:1,method:'soup',progress:{}},0);kv.clear();if(JSON.stringify(materials(kitchen.root))!==JSON.stringify(before))throw Error('kitchen restoration');disposeMap(kitchen.root);
   return {models:HOME_CATALOG.length,components:checks.length,checks,fallback,instanceIsolation:true,kitchenRestoration:true};
  });
  console.log("native audit complete",result.native.models,result.native.components);await panel();await root().locator('[data-wk=cdaypiecepick]').selectOption('sofa');await settle();await colour('seat','#ffcc33');await colour('back','#77aa99');await colour('cushionLeft','#cc6677');
  const preview=await root().locator('[data-wk=cdaypiecepreview]').getAttribute('src');await colour('arms','#557799');await p.waitForFunction(old=>document.querySelector('[data-wk=cdaypiecepreview]')?.src!==old,preview);result.liveNativePreview=true;
  for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
   await p.setViewportSize(size);await root().locator('[data-wk=cdaypartcolor][data-part=seat]').scrollIntoViewIfNeeded();
   const layout=await root().evaluate(el=>{const body=el.querySelector('[data-wk=cdaydecorbody]'),head=el.querySelector('[data-wk=head]').getBoundingClientRect(),footer=el.querySelector('[data-wk=cdayedittools]').getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,head:head.bottom,body:body.getBoundingClientRect().toJSON(),footer:footer.toJSON(),touch:[...el.querySelectorAll('[data-wk=cdaypartcolor] button')].map(e=>e.getBoundingClientRect().height)};});assert.ok(layout.overflow<=1);assert.ok(layout.body.top>=layout.head-.5);assert.ok(layout.body.bottom<=layout.footer.top+.5);assert.ok(layout.footer.height>=54&&layout.footer.height<=61);for(const h of layout.touch)assert.ok(h>=43.9);await shot('components-'+size.width+'x'+size.height);
   const scroll=await root().locator('[data-wk=cdaydecorbody]').evaluate(e=>e.scrollTop);await back();await panel();assert.equal(await root().locator('[data-wk=cdaydecorbody]').evaluate(e=>e.scrollTop),scroll);result.layouts.push({...size,...layout});
  }
  await p.setViewportSize({width:390,height:844});await root().locator('[data-wk=cdaypartreset][data-part=arms]').click();await settle();assert.equal((await scene()).homePlacements.sofa.partColors.arms,undefined);assert.equal((await scene()).homePlacements.sofa.partColors.seat,'#ffcc33');await back();await root().getByRole('button',{name:'撤销',exact:true}).click();await settle();assert.equal((await scene()).homePlacements.sofa.partColors.arms,'#557799');result.singleResetAndUndo=true;
  await panel();await root().locator('[data-wk=cdaypartsreset]').click();await settle();assert.equal((await scene()).homePlacements.sofa.partColors,undefined);await back();await root().getByRole('button',{name:'撤销',exact:true}).click();await settle();assert.equal((await scene()).homePlacements.sofa.partColors.back,'#77aa99');result.allResetAndUndo=true;
  // Stored instances are editable; adding another of the same model has no dye.
  const added=await api(()=>{CharDayScene.addFurniture('glass-table');return CharDayScene.inspect().selected;});await settle();await api(()=>CharDayScene.editAction('store'));await settle();await panel();await colour('top','#7799cc');assert.equal((await scene()).homePlacements[added].stored,true);await back();const second=await api(()=>{CharDayScene.addFurniture('glass-table');return CharDayScene.inspect().selected;});await settle();assert.equal((await scene()).homePlacements[second].partColors,undefined);result.storedAndDuplicate=true;
  const expected=(await scene()).homePlacements;
  await p.evaluate(()=>{window.colourDurableOriginal=commitJSONDurable;window.commitJSONDurable=async(k,v)=>k==='x_charDayHomes'?{durable:false,live:false}:colourDurableOriginal(k,v);});await root().locator('[data-wk=cdaysavelayout]').click();await root().locator('[data-wk=cdayeditnote]').filter({hasText:'这次没能保存'}).waitFor();assert.deepEqual((await scene()).homePlacements,expected);assert.equal(await p.evaluate(()=>loadJSON('x_charDayHomes',{}).layouts?.['photo-a']),undefined);await p.evaluate(()=>window.commitJSONDurable=colourDurableOriginal);result.failedSaveKeepsColours=true;
  await root().locator('[data-wk=cdaysavelayout]').click();await root().locator('[data-wk=cdaytools]').waitFor();assert.deepEqual(await p.evaluate(()=>loadJSON('x_charDayHomes',{}).layouts['photo-a']),expected);await shot('coloured-home');
  await begin();await panel();await root().locator('[data-wk=cdaypiecepick]').selectOption('sofa');await settle();await colour('back','#ff0000');await back();await root().locator('[data-wk=head] button').first().click();await root().locator('[data-wk=cdaytools]').waitFor();assert.deepEqual((await scene()).homePlacements,expected);result.cancelRestoresSaved=true;
  await p.reload();await enter();assert.deepEqual((await scene()).homePlacements,expected);await begin();await panel();await root().locator('[data-wk=cdaypiecepick]').selectOption('sofa');await settle();assert.equal(await partInput('seat').inputValue(),'#ffcc33');await root().locator('[data-wk=cdaypiecepreview]').scrollIntoViewIfNeeded();await shot('reloaded-preview');result.realAppReload=true;
  assert.deepEqual(await p.evaluate(()=>({plans:JSON.stringify(loadJSON('x_schedules',{})),other:JSON.stringify(loadJSON('x_charDayHomes',{}).kitchens['photo-b'])})),baseline);assert.equal(await p.evaluate(()=>photoTestAI),0);assert.deepEqual(errors,[]);result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({engine,ok:true,models:result.native.models,components:result.native.components,layouts:result.layouts.length}));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.message,errors,native:result.native},null,2));throw e;}finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exit(1);});
