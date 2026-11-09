const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({p,r,f,refresh,out,result}){
 await p.evaluate(()=>saveJSON('x_stampShop',{...loadJSON('x_stampShop',null),badge:{柜台:'card1'}}));await refresh();
 await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.snapshot().people.find(x=>x.id==='a')?.badgeView?.image);
 await f.evaluate(()=>PostOfficeGame.pause(true));
 const original=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),snapshot=()=>f.evaluate(()=>PostOfficeGame.snapshot()),reset=()=>r.getByRole('button',{name:'全景',exact:true}).click();
 const cdp=process.env.POST_OFFICE_BROWSER==='webkit'?null:await p.context().newCDPSession(p);
 async function pan(dx,dy){
  const box=await r.locator('iframe').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,gap=36;
  if(cdp){
   const send=(type,t)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x:x-gap+dx*t,y:y+dy*t,radiusX:1,radiusY:1},{id:2,x:x+gap+dx*t,y:y+dy*t,radiusX:1,radiusY:1}]});
   await send('touchStart',0);for(let i=1;i<=8;i++)await send('touchMove',i/8);await send('touchEnd',1);
  }else await f.evaluate(({dx,dy})=>{
   const c=document.querySelector('canvas'),x=c.clientWidth/2,y=c.clientHeight/2,send=(type,id,x,y)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));
   // Synthetic WebKit pointer input has no native capture registration. Gesture logic is unchanged.
   const capture=c.setPointerCapture;c.setPointerCapture=()=>{};try{send('pointerdown',41,x-36,y);send('pointerdown',42,x+36,y);}finally{c.setPointerCapture=capture;}
   for(let i=1;i<=8;i++){send('pointermove',41,x-36+dx*i/8,y+dy*i/8);send('pointermove',42,x+36+dx*i/8,y+dy*i/8);}send('pointerup',41,x-36+dx,y+dy);send('pointerup',42,x+36+dx,y+dy);
  },{dx,dy});
 }
 async function centerBadge(){
  for(let i=0;i<18;i++){
   const s=await snapshot(),b=s.people.find(x=>x.id==='a').badgeView.bounds,box=await r.locator('iframe').boundingBox(),dx=box.width/2-(b.left+b.right)/2,dy=box.height/2-(b.top+b.bottom)/2;
   if(Math.hypot(dx,dy)<2)return;await pan(Math.max(-55,Math.min(55,dx)),Math.max(-55,Math.min(55,dy)));
  }throw Error('Could not bring the clerk badge into the center with two-finger pan');
 }
 result.closeup=[];
 for(const [width,height]of [[320,568],[390,844],[430,932]]){
  await p.setViewportSize({width,height});await reset();
  const start=await r.locator('iframe').boundingBox();await p.mouse.move(start.x+start.width*.72,start.y+start.height*.45);await p.mouse.down();await p.mouse.move(start.x+start.width*.72,start.y+start.height*.45+60,{steps:12});await p.mouse.up();await centerBadge();
  const box=await r.locator('iframe').boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(const delta of [-240,-106.57359027997262])await p.mouse.wheel(0,delta);
  const prior=await snapshot(),small=prior.people.find(x=>x.id==='a').badgeView;
  await p.screenshot({path:path.join(out,'badge-before-'+width+'.png')});
  for(let i=0;i<8;i++)await p.mouse.wheel(0,-240);
  const s=await snapshot(),b=s.people.find(x=>x.id==='a').badgeView;
  assert.equal(s.cameraView.zoom,24);assert.ok(b.image);assert.ok(b.bounds.right-b.bounds.left>70,'badge artwork must occupy readable close-up pixels');assert.ok((b.bounds.right-b.bounds.left)/(small.bounds.right-small.bounds.left)>10);
  assert.ok(b.bounds.left>=0&&b.bounds.right<=width&&b.bounds.top>=0&&b.bounds.bottom<=box.height,'badge remains in the view after a real pan and zoom');
  assert.equal(await r.evaluate(el=>el.scrollWidth>innerWidth),false);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:path.join(out,'badge-close-'+width+'.png')});
  result.closeup.push({width,height,zoom:s.cameraView.zoom,badge:b});
  await reset();assert.equal((await snapshot()).cameraView.zoom,1);assert.deepEqual((await snapshot()).cameraView.pan,{x:0,z:.35});
 }
 if(cdp){
  const box=await r.locator('iframe').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  for(let round=0;round<3;round++){
   const send=(type,gap)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x:x-gap,y,radiusX:1,radiusY:1},{id:2,x:x+gap,y,radiusX:1,radiusY:1}]});
   await send('touchStart',18);for(const gap of [26,38,55,78,108])await send('touchMove',gap);await send('touchEnd',108);
  }
  assert.equal((await snapshot()).cameraView.zoom,24);result.nativeClosePinch=true;
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),original,'zoom and camera panning do not write the shop save');
 // The same assigned card can acquire new artwork without being reassigned or reopening the scene.
 await p.evaluate(async()=>{const cv=document.createElement('canvas');cv.width=300;cv.height=450;const c=cv.getContext('2d');c.fillStyle='#714d85';c.fillRect(0,0,300,450);c.fillStyle='#f7dfb4';c.fillRect(22,22,256,406);c.fillStyle='#587f92';c.fillRect(55,70,190,190);c.fillStyle='#713f54';c.font='bold 65px sans-serif';c.textAlign='center';c.fillText('NEW',150,350);const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
  try{await idbImgPut('th2_shop-zoom-detail',blob);}catch{const old=idbImgGet;window.idbImgGet=k=>k==='th2_shop-zoom-detail'?Promise.resolve(blob):old(k);}
  const st=loadJSON('x_stamps',{});st.cards[0].cover='shop-zoom-detail';saveJSON('x_stamps',st);
 });await refresh();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.snapshot().people.find(x=>x.id==='a')?.badgeView?.pixels[0]===300);
 const changed=(await snapshot()).people.find(x=>x.id==='a');assert.equal(changed.badge,'card1');assert.ok(changed.badgeView.image);result.liveBadgeArtwork=true;
 await p.evaluate(()=>{const st=loadJSON('x_stamps',{});st.cards[0].cover='missing-zoom-art';saveJSON('x_stamps',st);});await refresh();assert.equal((await snapshot()).people.find(x=>x.id==='a').badgeView.image,false,'missing art falls back to the paper badge safely');
 await p.evaluate(()=>{const st=loadJSON('x_stamps',{});st.cards[0].cover='shop-zoom-detail';saveJSON('x_stamps',st);});await refresh();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.snapshot().people.find(x=>x.id==='a')?.badgeView?.image);result.missingBadgeArtwork=true;
 await reset();await f.evaluate(()=>PostOfficeGame.pause(false));
};
