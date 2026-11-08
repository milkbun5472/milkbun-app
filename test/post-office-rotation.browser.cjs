// Runs inside the shared fake-save host harness, before any shop actions.
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({p,r,f,panel,leave,out,result}){
 const snapshot=()=>f.evaluate(()=>PostOfficeGame.snapshot());
 const reset=()=>r.getByRole('button',{name:'全景',exact:true}).click();
 const original=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null)));
 const baseline=await snapshot(),home=baseline.cameraView;
 const drag=async(dx,dy=0,start=null)=>{
  const box=await r.locator('iframe').boundingBox();
  const x=start?.x??box.x+box.width*.72,y=start?.y??box.y+box.height*.5;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:12});await p.mouse.up();
  assert.equal(await panel.count(),0,'a camera drag must not select a shop action');
 };
 const sameContents=async()=>{
  const s=await snapshot();
  assert.deepEqual(s.people.map(x=>x.id).sort(),baseline.people.map(x=>x.id).sort());
  assert.deepEqual(s.cards,baseline.cards);assert.deepEqual(s.decor,baseline.decor);
  assert.deepEqual(s.cameraView.pan,home.pan,'one pointer rotates around the same center');
  assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  return s;
 };
 result.rotation=[];
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
  await p.setViewportSize({width,height});await reset();
  await p.screenshot({path:path.join(out,'rotation-front-'+width+'.png')});
  const views=[];
  for(let turn=0;turn<7;turn++){
   await drag(-Math.PI*2/(.006*7));const s=await sameContents();views.push(s.cameraView);
   if(turn===1||turn===3)await p.screenshot({path:path.join(out,'rotation-'+(turn===1?'side':'back')+'-'+width+'.png')});
  }
  assert.ok(views.some(x=>x.orbit.yaw>2)&&views.some(x=>x.orbit.yaw< -2),'actual pointer drags complete the circle');
  assert.ok(views.some(x=>x.cutaway.hidden.includes('RoomCutaway:back')),'rear wall clears the view');
  assert.ok(views.some(x=>x.cutaway.hidden.includes('RoomCutaway:left')),'side wall clears the view');
  assert.ok(Math.abs((await snapshot()).cameraView.orbit.yaw-home.orbit.yaw)<.07);
  for(let i=0;i<4;i++)await drag(0,75);assert.equal((await snapshot()).cameraView.orbit.pitch,1.32,'upper pitch is bounded');
  await p.screenshot({path:path.join(out,'rotation-overhead-'+width+'.png')});
  for(let i=0;i<2;i++)await drag(0,-150);
  assert.equal((await snapshot()).cameraView.orbit.pitch,.38,'lower pitch is bounded');
  await sameContents();await reset();assert.deepEqual((await snapshot()).cameraView,home);
  const hint=await r.getByText('单指转动，双指移/缩。',{exact:true}).boundingBox();
  assert.ok(hint&&hint.x>=0&&hint.x+hint.width<=width,'gesture hint fits the small footer');
  result.rotation.push({width,height,fullCircle:true,pitchLimits:true,cutaway:true,contentsStable:true,reset:true});
 }
 await p.setViewportSize({width:390,height:844});await reset();
 // The regular save refresh must not cancel a pointer that is still held down.
 const box=await r.locator('iframe').boundingBox(),sx=box.x+box.width*.7,sy=box.y+box.height*.5;
 await p.mouse.move(sx,sy);await p.mouse.down();await p.mouse.move(sx-50,sy,{steps:8});
 await f.evaluate(()=>PostOfficeGame.refresh());await p.mouse.move(sx-100,sy,{steps:8});await p.mouse.up();
 assert.ok(Math.abs((await snapshot()).cameraView.orbit.yaw-home.orbit.yaw-.6)<.015,'save synchronization preserves a held drag');
 assert.equal(await panel.count(),0);await reset();result.refreshDuringDrag=true;
 // Begin a real drag on a clerk, then select a clerk at the rotated position.
 const scene=await r.locator('iframe').boundingBox();
 const clerk=await f.evaluate(()=>{const a=PostOfficeGame.snapshot().people.find(a=>a.post==='柜台');return PostOfficeGame.project(a.x,1.4,a.z);});
 await drag(-80,0,{x:scene.x+clerk.x,y:scene.y+clerk.y});
 const target=await f.evaluate(()=>{const a=PostOfficeGame.snapshot().people.find(a=>a.post==='柜台');return PostOfficeGame.project(a.x,1.4,a.z);});
 await p.mouse.click(scene.x+target.x,scene.y+target.y);await panel.getByRole('button',{name:'今天休息',exact:true}).waitFor();await leave();
 if(process.env.POST_OFFICE_BROWSER!=='webkit'){
  const cdp=await p.context().newCDPSession(p),x=scene.x+scene.width*.5,y=scene.y+scene.height*.5;
  const touch=(type,shift,gap=32)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{id:1,x:x-gap+shift,y,radiusX:1,radiusY:1},{id:2,x:x+gap+shift,y,radiusX:1,radiusY:1}]});
  const prior=await snapshot(),point=await f.evaluate(()=>PostOfficeGame.project(1,0,1));
  await touch('touchStart',0);for(const shift of [8,16,24,32])await touch('touchMove',shift);await touch('touchEnd',32);
  const after=await snapshot(),moved=await f.evaluate(()=>PostOfficeGame.project(1,0,1));
  assert.equal(after.cameraView.orbit.yaw,prior.cameraView.orbit.yaw);
  assert.ok(Math.abs(moved.x-point.x-32)<6&&Math.abs(moved.y-point.y)<6,'two fingers pan in screen direction after rotation');
  assert.ok(Math.abs(after.cameraView.zoom-prior.cameraView.zoom)<.01);assert.equal(await panel.count(),0);
  await touch('touchStart',0);for(const gap of [42,54,66])await touch('touchMove',0,gap);await touch('touchCancel',0);
  assert.ok((await snapshot()).cameraView.zoom>after.cameraView.zoom+.2);assert.equal(await panel.count(),0,'pinch cancellation must not tap');
  result.rotatedNativePanPinch=true;
 }
 await reset();assert.deepEqual((await snapshot()).cameraView,home);
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),original,'camera gestures do not write the shared save');
 result.rotatedClerkSelection=true;
};
