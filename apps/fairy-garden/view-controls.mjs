// Pointer gestures and buttons share one bounded zoom state. A pinch never becomes a walk tap.
export const MIN_ZOOM=.7,MAX_ZOOM=2.2;
export function createMapGesture({initial=1,onZoom=()=>{},onTap=()=>{}}={}){
 let zoom=Number.isFinite(initial)?Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,initial)):1,points=new Map(),pinching=false,distance=0;
 const gap=()=>{const [a,b]=[...points.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
 function setZoom(value){if(!Number.isFinite(value))return;zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));onZoom(zoom);}
 return {getZoom:()=>zoom,setZoom,
 down(id,x,y){points.set(id,{x,y,startX:x,startY:y,moved:false});if(points.size>1){pinching=true;distance=gap();}},
 move(id,x,y){const p=points.get(id);if(!p)return;p.x=x;p.y=y;p.moved ||= Math.hypot(x-p.startX,y-p.startY)>9;if(points.size>1){const next=gap();if(distance>0&&next>0)setZoom(zoom*next/distance);distance=next;}},
 up(id,x,y,cancel=false){const p=points.get(id);if(!p)return;const tap=!cancel&&!pinching&&!p.moved&&Math.hypot(x-p.startX,y-p.startY)<=9;points.delete(id);if(!points.size){pinching=false;distance=0;}else distance=gap();if(tap)onTap(x,y);},
 cancel(){points.clear();pinching=false;distance=0;}
 };
}
export function installViewControls({canvas,panel,content,toggle,zoomIn,zoomOut,reset,onZoom,onTap,storage=globalThis.localStorage}){
 const key='x_fairyGardenView';let pref={};try{pref=JSON.parse(storage.getItem(key)||'{}')||{};}catch{}
 let folded=pref.folded===true,saveTimer;
 const persist=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{storage.setItem(key,JSON.stringify({folded,zoom:gesture.getZoom()}));}catch{}},120);};
 const gesture=createMapGesture({initial:pref.zoom,onTap,onZoom:value=>{onZoom(value);reset.textContent=Math.round(value*100)+'%';zoomIn.disabled=value>=MAX_ZOOM;zoomOut.disabled=value<=MIN_ZOOM;persist();}});
 function fold(){content.hidden=folded;panel.classList.toggle('folded',folded);toggle.setAttribute('aria-expanded',String(!folded));toggle.querySelector('span').textContent=folded?'展开行动':'收起行动';persist();}
 toggle.onclick=()=>{folded=!folded;fold();};zoomIn.onclick=()=>gesture.setZoom(gesture.getZoom()*1.2);zoomOut.onclick=()=>gesture.setZoom(gesture.getZoom()/1.2);reset.onclick=()=>gesture.setZoom(1);
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;gesture.down(e.pointerId,e.clientX,e.clientY);try{canvas.setPointerCapture(e.pointerId);}catch{}});
 canvas.addEventListener('pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY));
 canvas.addEventListener('pointerup',e=>gesture.up(e.pointerId,e.clientX,e.clientY));
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>gesture.up(e.pointerId,e.clientX,e.clientY,true));
 canvas.addEventListener('wheel',e=>{e.preventDefault();const amount=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);gesture.setZoom(gesture.getZoom()*Math.exp(-Math.max(-240,Math.min(240,amount))*.002));},{passive:false});
 globalThis.addEventListener('blur',()=>gesture.cancel());
 fold();gesture.setZoom(gesture.getZoom());return gesture;
}
