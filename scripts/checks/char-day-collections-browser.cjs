const {moreItem,cameraView}=require('./char-day-ui-helpers.cjs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18987',engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-collections';fs.mkdirSync(out,{recursive:true});
const src=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),a=src.indexOf('  const saveSchedDay ='),b=src.indexOf('  const applySchedChange =',a);assert.ok(a>0&&b>a);const writer=src.slice(a,b);
(async()=>{const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await browser.newPage({viewport:{width:390,height:844}}),errors=[],result={engine,actions:[]};let frame;
try{
 p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-10T10:10:00Z'));await p.goto(base);await p.waitForFunction(()=>window.CharDayApp&&typeof txtVaultState==='function'&&txtVaultState().ok);
 await p.evaluate(writer=>{let plans={};window.collectionRef={current:plans};const save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>plans=fn(plans),collectionRef,saveJSON);window.collectionPlan=kind=>save('collection-a','2026-10-10',{seqs:[{seq:1,time:'10:00',end:'11:00',title:({sleep:'睡觉',meal:'吃飯',read:'看书'})[kind],location:'小家',type:kind==='sleep'?'sleep':kind==='meal'?'meal':'home',world:{scene:'dayHome',spot:kind}}]});collectionPlan('read');window.collectionBaseline=JSON.stringify(collectionRef.current);window.collectionModels=0;window.callAI=()=>{collectionModels++;throw Error('Unexpected model');};const el=document.createElement('div');el.id='collection-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);ReactDOM.createRoot(el).render(React.createElement(CharDayApp,{initialCharId:'collection-a',characters:[{id:'collection-a',name:'家具造型验收',gender:'male',tz:'0'}],plansFor:c=>collectionRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',face:'happy'}),taFor:()=> '他',onBack:()=>{}}));},writer);
 const root=p.locator('#collection-root'),ready=async()=>{await p.waitForFunction(()=>document.querySelector('#collection-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/'));await frame.waitForFunction(()=>!CharDayScene.inspect().changing);};await ready();await moreItem(root,'cdaydecorate');await ready();
 await root.locator('[data-wk=cdaydecoractions] [data-part=catalog]').click();await root.locator('[data-wk=cdaycatalogitem]').nth(71).waitFor();assert.equal(await root.locator('[data-wk=cdaycatalogitem]').count(),72);
 assert.equal(await root.locator('[data-wk=cdaycatalogitem] img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth===160)),true);
 result.geometry=await frame.evaluate(async()=>{
  const T=await import('three'),{createSpaceView}=await import('./space-view.mjs'),{createHomeFurniture}=await import('./home-furniture.mjs'),{createRoomKit}=await import('./places/room-kit.mjs'),{HOME_CATALOG,furniturePalette}=await import('./home-catalog.mjs'),{CORE_SPACES,styleOf}=await import('./spaces.mjs'),{disposeMap}=await import('../map-loader.mjs');
  const checks=[],contacts=[],signatures={},colors=[];
  for(const a of HOME_CATALOG){
   const k=createRoomKit(),group=createHomeFurniture(k,{...a,x:0,z:0,heading:0},furniturePalette(a,styleOf('warm')));group.updateMatrixWorld(true);
   if(a.collection&&['bed','chair','sofa'].includes(a.kind)){const name=a.kind==='bed'?'CollectionMattress':a.kind==='chair'?'CollectionChairSeat':a.id==='cloud-sofa'?'CloudSeatModule':'CollectionSeat',box=new T.Box3().setFromObject(group.getObjectByName(name));contacts.push({id:a.id,top:box.max.y,kind:a.kind});}
   if(a.collection){const signature=[];group.traverse(o=>{if(o.isMesh)signature.push([o.geometry.attributes.position.count,...new T.Box3().setFromObject(o).min.toArray().map(x=>+x.toFixed(4)),...new T.Box3().setFromObject(o).max.toArray().map(x=>+x.toFixed(4))]);});signatures[a.id]=JSON.stringify(signature);}
   disposeMap(k.root);
   if(a.collection){const v=createSpaceView('dayHome','warm',{...CORE_SPACES.dayHome,furniture:[{...a,x:0,z:0,heading:0,color:'#123456'}],structure:[]},{furnitureOnly:true});let present=false;v.root.traverse(o=>{if(o.isMesh&&o.material.color.getHexString()==='123456')present=true;});colors.push({id:a.id,present});disposeMap(v.root);}
   for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const view=createSpaceView('dayHome','warm',{...CORE_SPACES.dayHome,furniture:[{...a,x:0,z:0,heading}],structure:[]},{furnitureOnly:true}),box=new T.Box3().setFromObject(view.root),quarter=Math.round(heading/(Math.PI/2))%2,w=quarter?a.d:a.w,d=quarter?a.w:a.d;let finite=true;view.root.traverse(o=>{if(o.isMesh)finite&&=Array.from(o.geometry.attributes.position.array).every(Number.isFinite);});checks.push({id:a.id,heading,finite,heightExcess:a.kind==='ornament'?(a.mount?Math.max(-box.min.y,box.max.y)-a.height/2:box.max.y-a.height-.08):0,excess:Math.max(-box.min.x,box.max.x)-w/2,depthExcess:Math.max(-box.min.z,box.max.z)-d/2});disposeMap(view.root);}
  }
  return {checks,contacts,signatures,colors};
 });
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(result.geometry,null,2));assert.deepEqual(result.geometry.checks.filter(c=>!c.finite||c.excess>.031||c.depthExcess>.031||c.heightExcess>.031),[]);
 assert.ok(result.geometry.colors.every(c=>c.present),'every addition has a visible editable primary surface');
 for(const c of result.geometry.contacts)assert.ok(Math.abs(c.top-(c.kind==='bed'?.71:.53))<.002,JSON.stringify(c));
 assert.equal(new Set(Object.values(result.geometry.signatures)).size,52,'all additions must have distinct geometry');delete result.geometry.signatures;
 const catalogue=await frame.evaluate(()=>CharDayScene.listCatalog()),options=await frame.evaluate(()=>CharDayScene.decorationOptions());
 for(const [id,collection]of Object.entries(options.collections)){
  const items=catalogue.filter(a=>a.collection===id),html='<!doctype html><meta charset="utf-8"><title>'+collection.label+'</title><style>body{margin:0;padding:28px;background:#f1ecdf;color:#4f473a;font:18px system-ui}h1{font-size:26px;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}figure{margin:0;background:#faf8f2;padding:14px;border-radius:12px;text-align:center}img{width:100%;image-rendering:auto}figcaption{font-size:17px;padding:10px 0}</style><h1>'+collection.label+' · 实际三维家具</h1><div class="grid">'+items.map(a=>'<figure><img src="'+a.thumbnail+'"><figcaption>'+a.label+'</figcaption></figure>').join('')+'</div>';
  fs.writeFileSync(path.join(out,id+'.html'),html);const gallery=await browser.newPage({viewport:{width:1040,height:800}});await gallery.setContent(html);await gallery.screenshot({path:path.join(out,id+'.png'),fullPage:true});await gallery.close();
 }
 if(process.env.DAY_GEOMETRY_ONLY){result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,engine,geometryChecks:result.geometry.checks.length,colors:result.geometry.colors.length}));return;}
 await root.getByRole('button',{name:'回去摆放',exact:true}).click();await root.locator('[data-wk=head] button').first().click();await ready();
 // Exercise the new models through real editing, assignment, save and schedule.
 const sets=[['canopy-bed','rattan-sofa','woven-chair'],['spindle-bed','rolled-sofa','windsor-chair'],['panel-bed','cloud-sofa','shell-chair'],['steel-bed','tube-sofa','cantilever-chair']];
 for(let i=0;i<sets.length;i++){
  for(const [n,catalogId]of sets[i].entries()){
   const kind=['sleep','read','meal'][n];await moreItem(root,'cdaydecorate');await ready();
   const edited=await frame.evaluate(async({catalogId,kind})=>{const api=CharDayScene;api.selectFurniture(kind==='sleep'?'double-bed':kind==='read'?'sofa':'dining-chair');if(!api.editAction('store'))throw Error('store');return true;},{catalogId,kind});assert.equal(edited,true);await ready();
   const instance=await frame.evaluate(id=>{if(!CharDayScene.addFurniture(id))throw Error('add');return CharDayScene.inspect().selected;},catalogId);await ready();
   const point=kind==='sleep'?{x:-4,z:-3}:kind==='read'?{x:-3,z:1.4}:{x:3,z:.9,heading:Math.PI};assert.equal(await frame.evaluate(({instance,point})=>CharDayScene.editMove(instance,point),{instance,point}),true);await ready();assert.equal(await frame.evaluate(()=>CharDayScene.editAction('use')),true);await ready();
   await root.locator('[data-wk=cdaysavelayout]').click();await root.locator('[data-wk=cdaytools]').waitFor();await ready();await p.evaluate(kind=>collectionPlan(kind),kind);
   await frame.waitForFunction(({kind,instance})=>{const s=CharDayScene.inspect();return !s.changing&&!s.route.length&&s.gesture===({sleep:'sleep',read:'read',meal:'eat'})[kind]&&(kind==='sleep'?s.homePlacements.$room.uses.sleep===instance:s.seat?.piece===instance);},{kind,instance});
   await cameraView(root,false);await p.screenshot({path:path.join(out,catalogId+'-action.png')});result.actions.push({catalogId,instance,state:await frame.evaluate(()=>({gesture:CharDayScene.inspect().gesture,seat:CharDayScene.inspect().seat,bed:CharDayScene.inspect().bed}))});
   // Store the tested addition so the next family reuses the same physical spot.
   await moreItem(root,'cdaydecorate');await ready();await frame.evaluate(instance=>{CharDayScene.selectFurniture(instance);if(!CharDayScene.editAction('store'))throw Error('store tested addition');},instance);await ready();await root.locator('[data-wk=cdaysavelayout]').click();await root.locator('[data-wk=cdaytools]').waitFor();await ready();
  }
 }
 assert.equal(await p.evaluate(()=>collectionModels),0);assert.deepEqual(errors,[]);result.ok=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:true,engine,geometryChecks:result.geometry.checks.length,actions:result.actions.length}));
}catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.message,errors,scene:frame?await frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null):null},null,2));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
