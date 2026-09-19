// One gesture state owns taps, panning and bounded zoom. Multitouch never becomes a walk tap.
export const MIN_ZOOM=.45,MAX_ZOOM=2.2;
export function createMapGesture({initial=1,onZoom=()=>{},onTap=()=>{},onPan=()=>{}}={}){
 let zoom=Number.isFinite(initial)?Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,initial)):1,points=new Map(),pinching=false,distance=0;
 const gap=()=>{const [a,b]=[...points.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
 function setZoom(value){if(!Number.isFinite(value))return;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));onZoom(zoom);}
 return {getZoom:()=>zoom,setZoom,
 down(id,x,y){points.set(id,{x,y,startX:x,startY:y,moved:false});if(points.size>1){pinching=true;distance=gap();}},
 move(id,x,y){const p=points.get(id);if(!p)return;const dx=x-p.x,dy=y-p.y,wasMoved=p.moved;p.x=x;p.y=y;p.moved ||= Math.hypot(x-p.startX,y-p.startY)>9;if(points.size>1){const next=gap();if(distance>0&&next>0)setZoom(zoom*next/distance);distance=next;onPan(dx/points.size,dy/points.size);}else if(pinching||p.moved){onPan((wasMoved||pinching)?dx:x-p.startX,(wasMoved||pinching)?dy:y-p.startY);}},
 up(id,x,y,cancel=false){const p=points.get(id);if(!p)return;const tap=!cancel&&!pinching&&!p.moved&&Math.hypot(x-p.startX,y-p.startY)<=9;points.delete(id);if(!points.size){pinching=false;distance=0;}else distance=gap();if(tap)onTap(x,y);},
 cancel(){points.clear();pinching=false;distance=0;}
 };
}
export function installViewControls({canvas,panel,content,toggle,zoomIn,zoomOut,reset,center,onCenter=()=>{},onReset=()=>{},onPan,onZoom,onTap,onFold=()=>{},storage=globalThis.localStorage}){
 const key='x_fairyGardenView';let pref={};try{pref=JSON.parse(storage.getItem(key)||'{}')||{};}catch{}
 let folded=pref.folded===true,saveTimer;
 const persist=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{storage.setItem(key,JSON.stringify({folded,zoom:gesture.getZoom()}));}catch{}},120);};
 const gesture=createMapGesture({initial:pref.zoom,onTap,onPan,onZoom:value=>{onZoom(value);reset.textContent=Math.round(value*100)+'%';zoomIn.disabled=value>=MAX_ZOOM;zoomOut.disabled=value<=MIN_ZOOM;persist();}});
 // ⚠️收起来的时候，这条栏上要写着【此刻该干嘛】（她转群友 2026-09-19：「水井在哪儿呀，怎么取水」）。
 //   井边取水那颗按钮和目标条都在行动面板里，而面板在手机上默认是收起的——
 //   新人看到的只有「展开行动」四个字，于是既找不到井也不知道怎么取水。
 //   ⚠️那句话只有一处来源：ui() 算好了用 setFoldNote 递过来，这儿不自己拼第二份。
 let foldNote='';
 function fold(){content.hidden=folded;panel.classList.toggle('folded',folded);toggle.setAttribute('aria-expanded',String(!folded));toggle.querySelector('span').textContent=folded?(foldNote?'展开行动 · '+foldNote:'展开行动'):'收起行动';persist();onFold(folded);}
 toggle.onclick=()=>{folded=!folded;fold();};zoomIn.onclick=()=>gesture.setZoom(gesture.getZoom()*1.2);zoomOut.onclick=()=>gesture.setZoom(gesture.getZoom()/1.2);reset.onclick=()=>{onReset();gesture.setZoom(1);};if(center)center.onclick=onCenter;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;gesture.down(e.pointerId,e.clientX,e.clientY);try{canvas.setPointerCapture(e.pointerId);}catch{}});
 canvas.addEventListener('pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY));
 canvas.addEventListener('pointerup',e=>gesture.up(e.pointerId,e.clientX,e.clientY));
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>gesture.up(e.pointerId,e.clientX,e.clientY,true));
 canvas.addEventListener('wheel',e=>{e.preventDefault();const amount=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);gesture.setZoom(gesture.getZoom()*Math.exp(-Math.max(-240,Math.min(240,amount))*.002));},{passive:false});
 globalThis.addEventListener('blur',()=>gesture.cancel());
 fold();gesture.setZoom(gesture.getZoom());
 gesture.setFoldNote=text=>{const next=String(text||'').slice(0,18);if(next===foldNote)return;foldNote=next;if(folded)fold();};
 return gesture;
}

// Orthographic dragging uses infinite ground lines: a long swipe can put the shifted
// ray origin below the plane, which must not turn a valid drag into a no-op.
export function orthographicPanDelta(origin,shifted,direction){if(Math.abs(direction.y)<1e-8)return null;const dy=origin.y-shifted.y;return {x:origin.x-shifted.x-dy*direction.x/direction.y,z:origin.z-shifted.z-dy*direction.z/direction.y};}

// Pull an orthographic camera back at wide portrait zoom so its near plane never
// cuts the ground off at the bottom of the screen. Framing and viewing angle stay fixed.
export function orthographicCameraPose(pan,spanY,zoom,offset){
 const targetY=.5-offset/zoom,dy=12-targetY,length=Math.hypot(10,dy,16),half=spanY/(2*zoom);
 const vertical=half*Math.hypot(10,16)/length,scale=Math.max(1,(vertical+2-targetY)/dy);
 return {position:{x:pan.x+10*scale,y:targetY+dy*scale,z:pan.z+16*scale},target:{x:pan.x,y:targetY,z:pan.z},far:Math.max(80,length*scale+half*2+12),fogOffset:length*(scale-1)};
}
