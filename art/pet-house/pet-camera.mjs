// Shared scene camera for the home and all pet outings. It uses the canvas
// viewport, so a future game can mount the same controls inside its own layout.
export const PET_ZOOM={min:.72,max:8,cat:5};
export function defaultPetZoom(width,height){return width<height?1.30:1.12;}

export function createPetCamera(T,{camera,view,position,target,scale,getCat,draw,onTap,controlsHost}){
  const home=target.clone(),pan=new T.Vector3();
  const orbit=new T.Spherical().setFromVector3(position.clone().sub(home));
  const initial={theta:orbit.theta,phi:orbit.phi};
  const rect=()=>view.getBoundingClientRect();
  let zoom=defaultPetZoom(rect().width,rect().height),following=false,gesture=null;
  const pointers=new Map();
  const controls=document.createElement('div');controls.className='camera-tools';controls.setAttribute('aria-label','镜头控制');
  function button(id,label,html,click){
    const b=document.createElement('button');b.id=id;b.type='button';b.setAttribute('aria-label',label);b.innerHTML=html;b.onclick=click;controls.append(b);return b;
  }
  const minus=button('zoom-out','缩小场景','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',()=>zoomBy(1/1.25));
  const focus=button('look-cat','近距离看猫咪','看猫',()=>{
    following=!following;pan.set(0,0,0);if(following)zoom=Math.max(zoom,PET_ZOOM.cat);else zoom=defaultPetZoom(rect().width,rect().height);
    updateButtons();draw();
  });
  const plus=button('zoom-in','放大场景','<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',()=>zoomBy(1.25));
  controlsHost.append(controls);
  function updateButtons(){
    minus.disabled=zoom<=PET_ZOOM.min;plus.disabled=zoom>=PET_ZOOM.max;focus.disabled=!getCat();
    focus.textContent=following?'看场景':'看猫';focus.setAttribute('aria-pressed',String(following));focus.setAttribute('aria-label',following?'回到场景视角':'近距离看猫咪');
  }
  function zoomBy(factor){zoom=T.MathUtils.clamp(zoom*factor,PET_ZOOM.min,PET_ZOOM.max);updateButtons();draw();}
  function update(){
    const {width,height}=rect();if(width<=0||height<=0)return;
    const aspect=width/height,span=scale/Math.min(1,aspect)/zoom;
    const at=following&&getCat()?getCat().getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.44,0)):home.clone();at.add(pan);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
    camera.position.copy(at).add(new T.Vector3().setFromSpherical(orbit));camera.lookAt(at);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
  function reset(){zoom=1;following=false;pan.set(0,0,0);orbit.theta=initial.theta;orbit.phi=initial.phi;clearGesture();updateButtons();draw();}
  function pair(){const a=[...pointers.values()];return {distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};}
  function screenOffset(p,units,right,up){const r=rect();return right.clone().multiplyScalar((p.x-r.left-r.width/2)*units).addScaledVector(up,-(p.y-r.top-r.height/2)*units);}
  function beginPair(){
    const p=pair(),right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    gesture={moved:true,pinch:p.distance,startZoom:zoom,pan:pan.clone(),right,up,anchor:screenOffset(p,(camera.top-camera.bottom)/Math.max(rect().height,1),right,up)};
  }
  function clearGesture(){pointers.clear();gesture=null;}
  view.onpointerdown=e=>{
    view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2)beginPair();else gesture={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
  };
  view.onpointermove=e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){
      if(!gesture.pinch)beginPair();const p=pair();zoom=T.MathUtils.clamp(gesture.startZoom*p.distance/Math.max(gesture.pinch,1),PET_ZOOM.min,PET_ZOOM.max);
      const {width,height}=rect(),units=scale/Math.min(1,width/Math.max(height,1))/zoom/Math.max(height,1);
      pan.copy(gesture.pan).add(gesture.anchor).sub(screenOffset(p,units,gesture.right,gesture.up));pan.clampLength(0,scale*.5);gesture.moved=true;
    }else{
      const dx=e.clientX-gesture.lastX,dy=e.clientY-gesture.lastY;
      if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)gesture.moved=true;
      orbit.theta=T.MathUtils.clamp(orbit.theta-dx*.004,.18,1.18);orbit.phi=T.MathUtils.clamp(orbit.phi-dy*.003,.66,1.19);
      gesture.lastX=e.clientX;gesture.lastY=e.clientY;
    }
    updateButtons();draw();
  };
  view.onpointerup=e=>{
    if(!pointers.has(e.pointerId))return;const tap=gesture&&!gesture.moved&&pointers.size===1;pointers.delete(e.pointerId);
    if(tap)onTap(e);
    if(pointers.size>=2)beginPair();else if(pointers.size===1){const p=[...pointers.values()][0];gesture={x:p.x,y:p.y,lastX:p.x,lastY:p.y,moved:true};}else gesture=null;
  };
  view.onpointercancel=clearGesture;
  const wheel=e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*.001));};view.addEventListener('wheel',wheel,{passive:false});
  updateButtons();
  return {update,reset,clearGesture,snapshot:()=>({zoom,following,pan:pan.toArray()}),dispose:()=>{clearGesture();view.onpointerdown=view.onpointermove=view.onpointerup=view.onpointercancel=null;view.removeEventListener('wheel',wheel);controls.remove();}};
}
