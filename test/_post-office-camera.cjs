// Real Chrome touch input; WebKit uses the same DOM pointer handlers with capture registration shimmed.
module.exports=async function({p,r,f}){
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
 return {cdp,pan};
};
