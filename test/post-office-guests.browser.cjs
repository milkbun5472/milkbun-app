const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({p,r,f,refresh,out,result,videoStarted=null,catOnly=false})=>{
 await p.clock.setFixedTime(new Date('2026-11-09T10:00:00-06:00'));const snapshot=()=>f.evaluate(()=>PostOfficeGame.snapshot());
 async function seed(customers){await p.evaluate(customers=>{const sh={...shopFixture,date:'2026-11-9',period:'上午',phase:'open',customers,closing:[]};saveJSON('x_stampShop',StampShop.restore(sh));return StampShop.sync({characters:['a','b','c','d'].map(id=>({id,name:'店员'+id})),cards:loadJSON('x_stamps',{}).cards});},customers);await refresh();}
 if(!catOnly){
  const before=(await snapshot()).people.filter(a=>a.kind==='staff').map(a=>({id:a.id,look:a.look}));
  const customers=[{id:'nurse',name:'提着保温桶的夜班护士',fee:10},{id:'walker',name:'牵柴犬的新婚的姑娘',fee:10},{id:'bride',name:'稀客名不参与分类',rareId:'bride',fee:70},{id:'sun',name:'晒得很黑的渔夫',fee:10},{id:'watch',name:'总迟到的高中生',fee:10},{id:'snow',name:'雪旅人',rareId:'snow',fee:70}];await seed(customers);
  await f.evaluate(()=>{for(let i=0;i<800;i++)PostOfficeGame.step(.025);PostOfficeGame.draw();});let s=await snapshot();
  for(const a of before)assert.deepEqual(s.people.find(p=>p.id===a.id).look,a.look,'角色外貌继续读陪伴');
  assert.equal(s.people.find(a=>a.id==='nurse').costume,'post-npc-nurse');assert.equal(s.people.find(a=>a.id==='nurse').props.kind,'thermos');assert.equal(s.people.find(a=>a.id==='walker').props.animal,'shiba');assert.equal(s.people.find(a=>a.id==='bride').look.npcRare,'bride');assert.equal(s.people.find(a=>a.id==='sun').costume,'post-npc-fisher');assert.equal(s.people.find(a=>a.id==='watch').props.kind,'watch');assert.equal(s.people.find(a=>a.id==='snow').look.npcRare,'snow');
  await p.evaluate(()=>StampShop.run('serve',{id:'nurse',characters:['a','b','c','d'].map(id=>({id,name:'店员'+id})),cards:loadJSON('x_stamps',{}).cards}));await refresh();await f.evaluate(()=>{PostOfficeGame.step(.025);PostOfficeGame.draw();});s=await snapshot();const nurse=s.people.find(a=>a.id==='nurse');assert.ok(nurse.letter);assert.equal(nurse.props.hand,'left');
  for(const [width,height]of [[320,568],[390,844],[430,932]]){await p.setViewportSize({width,height});await f.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await r.evaluate(el=>el.scrollWidth>innerWidth),false);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const footer=await r.getByRole('button',{name:'去柜台',exact:true}).boundingBox();assert.ok(footer.y+footer.height<=height);await p.screenshot({path:path.join(out,'mixed-guests-'+width+'.png')});}
  result.characterLooksUnchanged=true;result.letterFreeHand=true;result.mobileWidths=[320,390,430];
 }
 await p.setViewportSize({width:390,height:844});await r.getByRole('button',{name:'全景',exact:true}).click();
 // Clear old visual customers before the filmed cat visit.
 await seed([]);await f.evaluate(()=>{for(let i=0;i<1600;i++)PostOfficeGame.step(.025);PostOfficeGame.draw();});
 const follow=catOnly&&process.env.POST_OFFICE_RECORD_CAT==='1',camera=follow?await require('./_post-office-camera.cjs')({p,r,f}):null;
 if(follow){for(let i=0;i<16;i++){const q=await f.evaluate(()=>PostOfficeGame.project(3.32,.3,4.7)),box=await r.locator('iframe').boundingBox(),dx=box.width/2-q.x,dy=box.height/2-q.y;if(Math.hypot(dx,dy)<2)break;await camera.pan(Math.max(-55,Math.min(55,dx)),Math.max(-55,Math.min(55,dy)));}const box=await r.locator('iframe').boundingBox();await p.mouse.move(box.width/2,box.y+box.height/2);for(let i=0;i<4;i++)await p.mouse.wheel(0,-180);}
 const original=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null)));await seed([{id:'rare-cat',name:'蹲在门口的三花猫',rareId:'cat',fee:20,need:null}]);
 const catSave=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),phases=new Set();let carried=null,dropped=null,sawMeow=false,gone=false;const started=Date.now();
 while(Date.now()-started<25000){const s=await snapshot(),cat=s.people.find(a=>a.id==='rare-cat'),u=s.flow.units.find(u=>u.id==='rare-cat');
  if(cat){if(follow){const q=await f.evaluate(({x,z,y})=>PostOfficeGame.project(x,y,z),{x:cat.x,z:cat.z,y:(u?.catHeight||0)+.3}),box=await r.locator('iframe').boundingBox(),dx=box.width/2-q.x,dy=box.height/2-q.y;if(Math.hypot(dx,dy)>8)await camera.pan(Math.max(-40,Math.min(40,dx)),Math.max(-40,Math.min(40,dy)));}assert.equal(cat.species,'cat');assert.equal(cat.costume,'cat');assert.notEqual(cat.posture,'sit');assert.equal(cat.letter,false);phases.add(cat.phase);if(u?.bubble){assert.equal(u.bubble,'喵');sawMeow=true;}const leaf=s.catLeaves.find(x=>x.key.endsWith('rare-cat'));if(leaf){if(!leaf.dropped)carried ||=leaf.uuid;else dropped=leaf.uuid;}
   if(['cat-jump','cat-counter','cat-down'].includes(cat.phase)&&!fs.existsSync(path.join(out,cat.phase+'.png')))await p.screenshot({path:path.join(out,cat.phase+'.png')});
  }else if(phases.size){gone=true;break;}await p.waitForTimeout(90);
 }
 assert.ok(gone&&sawMeow);for(const phase of ['queuing','cat-jump','cat-counter','cat-down','leaving'])assert.ok(phases.has(phase),phase);assert.ok(carried&&dropped);assert.equal(carried,dropped,'the same leaf leaves the mouth and remains on the counter');
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),catSave,'猫演出不代结算、不写存档');await refresh();assert.ok(!(await snapshot()).people.some(a=>a.id==='rare-cat'));
 result.catVisit={phases:[...phases],sameLeaf:true,meow:true,departed:true,saveUnchanged:true,durationMs:Date.now()-started,startOffsetMs:videoStarted?started-videoStarted:null,followed:follow};
};
