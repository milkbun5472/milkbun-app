// Every actual seated writing anchor, using the authored body and all outfits.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-seated-tools';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1000,height:800}}),errors=[];try{
 p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base+'/apps/companion/');
 const report=await p.evaluate(async()=>{
  const T=await import('three'),{createTraveler,loadTravelerSource}=await import('../fairy-garden/traveler.mjs'),{OUTFITS}=await import('../fairy-garden/wardrobe.mjs'),{DAY_PLACES}=await import('../fairy-garden/day/places/index.mjs'),{activityPhase,taskAt}=await import('../fairy-garden/day/workflow.mjs');
  const catalog=await(await fetch('../fairy-garden/doll.json')).json(),avatar=createTraveler(await loadTravelerSource(),true,{hair:'korean'});await avatar.ready();const variants=[{},Object.fromEntries(catalog.dims.map(x=>[x.key,x.min])),Object.fromEntries(catalog.dims.map(x=>[x.key,x.max]))],anchors=[],contacts=[];let clock=0;
  for(const [id,map]of Object.entries(DAY_PLACES))for(const spot of map.spots.filter(s=>s.seat)){
   const stage=activityPhase({map:id,spot:spot.id,action:spot.action},null,null,{preview:true}),task=taskAt(stage,spot,map,3);if(task?.kind==='write')anchors.push({id,map,spot,stage});
  }
  for(const outfit of Object.keys(OUTFITS))for(const [variant,dims]of variants.entries()){
   avatar.setLook({outfit,dims},true);await avatar.ready();
   for(const {id,map,spot,stage}of anchors){let task;avatar.root.rotation.y=spot.heading;
    for(let i=0;i<100;i++){avatar.root.position.set(spot.seat.x,0,spot.seat.z);task=taskAt(stage,spot,map,i*.03);avatar.animate(clock+=.04,{gesture:'rest',task,seated:true,seatPose:spot.seat.pose,height:map.floor+spot.seat.rise+.05});}
    avatar.root.updateMatrixWorld(true);const brush=task.tool==='inkbrush',tool=avatar.root.getObjectByName(brush?'WorkBrush':'WorkPencil'),tip=tool.localToWorld(new T.Vector3(0,brush?-.22:-.21,0)),contact=new T.Vector3(task.contact.x,task.contact.y,task.contact.z),hand=avatar.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),head=avatar.root.getObjectByName('HeadAnchor'),row={id,spot:spot.id,outfit,variant,visible:tool.visible,error:tip.distanceTo(contact),handDistance:hand.distanceTo(contact),headClearance:head.worldToLocal(hand.clone()).length()};
    if(!row.visible||row.error>.018||row.handDistance>.40||row.headClearance<1.07)throw Error(JSON.stringify(row));contacts.push(row);
   }
  }
  return {anchors:anchors.map(({id,spot})=>({id,spot:spot.id})),contacts};
 });assert.deepEqual(errors,[]);assert.ok(report.anchors.length>10);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,errors,...report},null,2));console.log(JSON.stringify({ok:true,engine,anchors:report.anchors.length,contacts:report.contacts.length}));
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
