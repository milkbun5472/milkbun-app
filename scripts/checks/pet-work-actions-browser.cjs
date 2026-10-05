const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.TOWN_WORK_URL||'http://127.0.0.1:18976',out=process.env.TOWN_WORK_EVIDENCE||'/Users/lisa/.codex/visualizations/2026/10/04/town-work-actions/local';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await pw[process.env.TOWN_WORK_ENGINE||'chromium'].launch(process.env.TOWN_WORK_ENGINE==='webkit'?{headless:true}:{channel:'chrome',headless:true}),errors=[],result={};try{const p=await b.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'});p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-04T15:30:00-05:00'));await p.goto(base);await p.waitForFunction(()=>window.FairyGardenApp&&window.ReactDOM);
await p.evaluate(async species=>{const s=await import('./apps/pets/state.mjs'),n=await import('./art/pet-career/world-navigation.mjs'),t=await import('./apps/pets/town-life.mjs'),w=await import('./apps/fairy-garden/world.mjs'),layout=await fetch('./art/pet-career/outside.json').then(r=>r.json()),world=n.createPetWorld(layout),at=Date.now(),state=s.restorePetState({configured:true,profile:{name:'团子',species},room:'home',care:{satiety:90,energy:100,mood:100,rng:1,position:{x:.25,z:.8},initiativeCooldown:120,habitCooldown:240},town:{...t.newTownLife('home',{x:.25,z:.8},17),hold:120},resident:{id:'ta',town:{...t.newTownLife('home',{x:-1.15,z:1.35},19),hold:120},life:{at,marks:{},notes:[],wakeUntil:0}}},world);state.pets[0].life.at=at;const other=s.petEntry({configured:true,profile:{name:'栗子',species:species==='dog'?'cat':'dog'},care:{satiety:90,energy:100,mood:100},town:{...t.newTownLife('alley',t.roomDoor('alley'),31),hold:300},career:{balance:72}},'pet-2');other.life.at=at;state.pets.push(other);state.household.recent.push({at,text:'TA帮新来的猫猫把小球收回了收纳盘。',completed:true});const saved=s.snapshotPetState(state,{position:state.position,room:'home',outdoor:layout.buildings.find(x=>x.id==='home').approach,evening:false}),garden={...w.freshState(),day:23,herbs:17};await saveJSON('x_fairyGarden:bugfix-test',GameClock.archive({id:'bugfix-test',version:1,partnerId:'ta',world:garden,worlds:{garden,pets:saved},journey:{keep:123},dialogs:{}},at));window.skillCalls=0;window.callAI=()=>{skillCalls++;throw Error('Skills called model');};const el=document.createElement('div');el.id='bugfix-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);window.bugfixRoot=ReactDOM.createRoot(el);bugfixRoot.render(React.createElement(FairyGardenApp,{storeKey:'x_fairyGarden:bugfix-test',entryWorld:'pets',characters:[{id:'ta',name:'沈屿白',persona:'温柔、耐心、细心，喜欢小动物。'}],toast:()=>{},onBack:()=>{}}));},process.env.TOWN_WORK_SPECIES||'cat');

await p.waitForFunction(()=>document.querySelector('#bugfix-root iframe')?.contentWindow.PetGame?.ready);const f=p.frames().find(x=>x.url().includes('/apps/pets/')),root=p.locator('#bugfix-root');await f.waitForFunction(()=>!petCareerPreview.snapshot().busy);await f.evaluate(()=>{PetGame.pause(true);for(const kind of ['toys','bowl','water','bedding'])PetGame.choreAction('assign',{kind,actor:'you'});});

const T=await f.evaluate(async()=>{window.workT=await import('three');return true;});assert.ok(T);
const metrics=[];
async function prepare(profession,index){
 const setup=await f.evaluate(async([profession,index])=>{
  PetGame.pause(true);const a=petCareerPreview.household.get(PetGame.snapshot().activePetId),{workRoom}=await import('../../apps/pets/workplaces.mjs');
  a.care.cancel();Object.assign(a.care.state,{energy:100,satiety:90,mood:100,initiativeCooldown:120,habitCooldown:240});
  a.career.restore({selected:profession,rng:1,inventory:{bread:3},stall:{pack:{bread:1}}});
  a.town.sync(workRoom(profession),a.town.nav().restore?.(null)||{x:0,z:0},0,{manual:true});
  const n=(await import('../../apps/pets/town-life.mjs')).createTownNavigation(workRoom(profession),a.pet.root.scale.x);
  a.entry.town.position=n.restore(null);const invite=PetGame.careerAction('invite');if(!invite.accepted)throw Error(JSON.stringify(invite));
  // Isolated stage fixtures come from the real accepted trial and restore writer.
  const facts=a.career.snapshot();facts.job.index=index;facts.job.time=0;facts.job.phase='working';
  if(profession==='courier'&&index>0){facts.job.delivery.picked=true;facts.job.delivery.status=index===1?'carrying':'delivered';}
  a.career.restore(facts);const place=a.career.destination(),point=a.career.destinationPoint();
  const nav=place==='outside'?petCareerPreview.world:(await import('../../apps/pets/town-life.mjs')).createTownNavigation(place,a.pet.root.scale.x);
  a.town.sync(place,point||nav.restore(null),0,{manual:true});a.care.state.position={...a.entry.town.position};
  await PetGame.watch('pet',a.entry.id);PetGame.pause(true);return {place,phase:a.career.state.job.phase};
 },[profession,index]);
 await f.waitForFunction(()=>!petCareerPreview.snapshot().busy);await root.locator('[data-pet-career]').count().then(async n=>{if(n)await root.locator('[data-watch=back]').click();});
 if(setup.place!=='outside'&&await f.locator('#look-cat').getAttribute('aria-pressed')!=='true')await f.locator('#look-cat').click();
 await f.waitForFunction(()=>!petCareerPreview.snapshot().busy);assert.equal(await f.evaluate(()=>petCareerPreview.snapshot().room||'outside'),setup.place);
}
async function frame(seconds){return f.evaluate(seconds=>{
 PetGame.pause(false);for(let i=0;i<Math.round(seconds/.05);i++)PetGame.step(.05);PetGame.pause(true);
 const a=petCareerPreview.household.get(PetGame.snapshot().activePetId),T=workT,m=a.pet.motion.snapshot();a.pet.root.updateMatrixWorld(true);
 const bones=['head','frontLPaw','frontRPaw','backLPaw','backRPaw'].map(n=>a.pet.model.getObjectByName(n).getWorldPosition(new T.Vector3()).toArray());
 const vertices=[];a.pet.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i+=Math.max(1,Math.floor(mesh.geometry.attributes.position.count/50)))vertices.push(mesh.localToWorld(mesh.getVertexPosition(i,new T.Vector3())).toArray());});
 petCareerPreview.renderer.render(petCareerPreview.scene,petCareerPreview.camera);
 return {work:a.workView.snapshot(),bones,vertices,motion:m,job:a.career.state.job.phase,position:{...a.entry.town.position},goal:a.entry.town.goal,careTask:a.care.state.task,other:PetGame.snapshot().pets[1].career.balance};
 },seconds);}
for(const profession of ['bakery','florist','store','cafe','alley','courier','stall'])for(let index=0;index<3;index++){
 await prepare(profession,index);const first=await frame(.8);assert.equal(first.job,'working');assert.ok(first.work.kind,profession+' '+index);assert.equal(first.goal,null);assert.equal(first.careTask,null);assert.equal(first.other,72);
 if(index===0||index===2)await p.screenshot({path:path.join(out,profession+'-'+index+'-a.png')});
 const second=await frame(1.6),delta=Math.max(...second.vertices.flatMap((v,i)=>v.map((n,j)=>Math.abs(n-first.vertices[i][j]))));
 assert.ok(delta>.008,profession+' '+index+' actual mesh did not move '+delta);assert.notDeepEqual(first.bones[1],second.bones[1]);assert.deepEqual(first.position,second.position);assert.ok(second.vertices.flat().every(Number.isFinite));
 const feet=second.motion.feet;assert.equal(feet.length,4);for(const foot of feet.filter(x=>x.name!=='frontL'))assert.ok(Math.abs(foot.goal[1]-foot.ankle[1])<.003,profession+' '+index+' support paw');
 if(index===0||index===2){await p.screenshot({path:path.join(out,profession+'-'+index+'-b.png')});}
 if(index===2){
  const stopped=await f.evaluate(()=>{const a=petCareerPreview.household.get(PetGame.snapshot().activePetId);a.career.state.job.phase='choice';PetGame.pause(false);PetGame.step(.05);PetGame.pause(true);return a.workView.snapshot();});assert.equal(stopped.visible,false);assert.equal(stopped.kind,'');
 }
 metrics.push({profession,index,kind:first.work.kind,prop:first.work.prop,vertexDelta:delta,clamps:second.motion.clamps});console.log(profession,index,first.work.kind,'mesh delta',delta.toFixed(4));
}
await prepare('florist',1);await frame(.8);const paused=await f.evaluate(()=>{const a=petCareerPreview.household.get(PetGame.snapshot().activePetId),before=a.pet.motion.snapshot(),time=a.career.state.job.time;for(let i=0;i<50;i++)PetGame.step(.05);return {before,after:a.pet.motion.snapshot(),time,afterTime:a.career.state.job.time};});assert.deepEqual(paused.before,paused.after);assert.equal(paused.time,paused.afterTime);
const savedJob=await f.evaluate(()=>{PetGame.flush();const s=PetGame.snapshot();const assertNoRenderState=s.pets.every(x=>!x.workView&&!x.workAction);return {id:PetGame.career().job.id,index:PetGame.career().job.index,noRenderState:assertNoRenderState};});assert.ok(savedJob.noRenderState);
await f.goto(f.url());await f.waitForFunction(()=>window.PetGame?.ready&&!window.petCareerPreview?.snapshot().busy);await f.evaluate(()=>{PetGame.pause(false);PetGame.step(.05);PetGame.pause(true);});
assert.equal(await f.evaluate(()=>PetGame.career().job.id),savedJob.id);assert.equal(await f.evaluate(()=>PetGame.career().job.index),savedJob.index);assert.equal(await f.evaluate(()=>petCareerPreview.household.get(PetGame.snapshot().activePetId).workView.snapshot().kind),'workSort');
await f.evaluate(()=>PetGame.preview(true));assert.equal(await f.evaluate(()=>petCareerPreview.household.get(PetGame.snapshot().activePetId).workView.root.visible),false);await p.screenshot({path:path.join(out,'appearance-no-work-props.png')});await f.evaluate(()=>PetGame.preview(false));await f.waitForFunction(()=>!petCareerPreview.snapshot().busy);
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({metrics,paused:true,reload:true,appearanceClean:true,pageErrors:errors},null,2));console.log('All work stages, physical meshes, pause and appearance passed.');
}catch(e){throw e;}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
