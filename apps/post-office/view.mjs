import * as T from 'three';
import {createRoomKit} from '../fairy-garden/day/places/room-kit.mjs?v=fg-7d8490d3228b9b43';
import {createWorldRenderer,disposeWorldRenderer} from '../fairy-garden/world-renderer.mjs?v=fg-7d8490d3228b9b43';
import {createMapGesture} from '../fairy-garden/view-controls.mjs?v=fg-7d8490d3228b9b43';
import {createTraveler,loadTravelerSource} from '../fairy-garden/traveler.mjs?v=fg-7d8490d3228b9b43';
import {disposeMap} from '../fairy-garden/map-loader.mjs?v=fg-7d8490d3228b9b43';
import {visibleBounds} from '../fairy-garden/photo-render.mjs?v=fg-7d8490d3228b9b43';
export function createPostOfficeView(stage,{name,counter,thumbnail}={}){
 const renderer=createWorldRenderer(stage),scene=new T.Scene(),camera=new T.OrthographicCamera(-6,6,7,-7,.1,100),kit=createRoomKit();
 const {root,box,cylinder,sphere,ellipsoid,tube,group,sign,table,chair,bench,plant}=kit;
 scene.add(root);scene.background=new T.Color('#e6dfcc');
 const hemi=new T.HemisphereLight('#fff4da','#927a60',2.4);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff0cf',2.8);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7});sun.shadow.normalBias=.025;scene.add(sun);
 const glow=new T.PointLight('#ffca76',0,12,2);glow.position.set(.8,2.9,.1);scene.add(glow);
 box('ShopFloor',{w:9.3,d:7.3,h:.25,y:-.045,color:'#bea47e'});
 for(let x=-4.2;x<4.5;x+=.45)box('FloorSeam',{x,y:.082,w:.012,h:.003,d:7,color:'#ab916d',radius:0});
 box('BackWall',{z:-3.5,y:1.75,w:9.3,h:3.5,d:.17,color:'#e5dcc4'});
 box('LeftWall',{x:-4.6,y:1.75,w:.17,h:3.5,d:7.2,color:'#9cae9c'});
 box('Skirting',{z:-3.37,y:.24,w:9.1,h:.32,d:.12,color:'#789184'});
 box('Street',{x:0,z:4.2,y:-.14,w:10.2,d:1.8,h:.24,color:'#b8b5a5'});
 for(let x=-4.7;x<5;x+=.65)box('StreetStone',{x,z:4.15,y:-.012,w:.59,d:1.5,h:.04,color:'#c7c6b5',radius:.035});
 // A cutaway front leaves the room visible. The green entry stands on the street.
 for(const x of [2.3,4.35])box('DoorPost',{x,y:1.5,z:3.15,w:.16,d:.2,h:3,color:'#5d8175'});
 box('DoorLintel',{x:3.32,y:3,z:3.15,w:2.2,d:.24,h:.24,color:'#5d8175'});
 const closedDoor=group('ClosedDoor');box('DoorPanel',{x:3.32,z:3.13,y:1.36,w:1.85,h:2.6,d:.1,color:'#75978a'},closedDoor);
 box('DoorGlass',{x:3.32,z:3.2,y:1.75,w:1.43,h:1.45,d:.04,color:'#647778'},closedDoor);
 const closedSign=sign('ClosedSign',{text:'打 烊',x:3.32,y:1.9,z:3.24,w:1.2,h:.5,color:'#e6d7b4',ink:'#705c43'});
 sign('EntryName',{text:name,x:3.32,y:2.96,z:3.29,w:1.8,h:.26,color:'#5d8175',ink:'#f2e8cc'});
 // Window and four physical workstations.
 box('WindowFrame',{x:2.65,y:2,z:-3.34,w:2.7,h:1.9,d:.13,color:'#6f8877'});
 box('WindowLight',{x:2.65,y:2,z:-3.25,w:2.37,h:1.6,d:.035,color:'#c9d9cf'});
 for(const x of [1.48,2.65,3.82])box('WindowMullion',{x,y:2,z:-3.2,w:.06,h:1.65,d:.045,color:'#748878'});
 box('WindowCross',{x:2.65,y:2,z:-3.18,w:2.43,h:.07,d:.05,color:'#748878'});
 const counterRoot=group('Counter');box('CounterBody',{x:-1.45,z:1.15,y:.43,w:3.7,h:.7,d:.8,color:'#739184'},counterRoot);
 box('CounterTop',{x:-1.45,z:1.15,y:.84,w:3.93,h:.12,d:1.04,color:'#b48c62'},counterRoot);
 sign('CounterLabel',{text:'寄信 · 取件',x:-1.45,y:.46,z:1.57,w:1.8,h:.32},counterRoot);
 cylinder('InkPad',{x:-2.5,z:1.12,y:.96,r:.2,h:.08,color:'#936b56'});
 box('CounterLetters',{x:-.55,z:1.17,y:.96,w:.6,h:.08,d:.33,color:'#efe3c9'});
 table({id:'SortTable',x:-2.25,z:-2.5,w:2.8,d:.85,top:.65,color:'#ad8b64'});
 for(let i=0;i<4;i++)box('LetterStack',{x:-3+i*.48,z:-2.5,y:.8,w:.37,h:.13,d:.36,color:i%2?'#ddd0b3':'#f0e4cb'});
 const mailWall=group('MailCubbyWall');box('MailBacking',{x:-1.5,y:2,z:-3.31,w:4.65,h:2.22,d:.15,color:'#8d7455'},mailWall);
 for(let i=0;i<7;i++)box('MailDivider',{x:-3.78+i*.76,y:2,z:-3.12,w:.055,h:2.22,d:.36,color:'#ad8f66'},mailWall);
 for(let i=0;i<4;i++)box('MailShelf',{x:-1.5,y:.9+i*.73,z:-3.12,w:4.65,h:.065,d:.36,color:'#ad8f66'},mailWall);
 chair({id:'WindowStool',x:3,z:-.6,seat:.45,color:'#899a7f'});
 const mailbags=group('MailbagRack',{x:4.05,z:2.45});
 for(const x of [-.3,.3])cylinder('RackPole',{x,y:.68,r:.045,h:1.2,color:'#7e7964'},mailbags);
 box('RackTop',{y:1.3,w:.85,h:.07,d:.15,color:'#7e7964'},mailbags);
 for(const x of [-.22,.22]){ellipsoid('Mailbag',{x,y:.72,w:.4,h:.63,d:.4,color:'#ba9e72'},mailbags);box('BagFlap',{x,y:.97,z:.18,w:.36,h:.17,d:.07,color:'#8a7956'},mailbags);}
 const decor={};
 decor.sign=group('Decor:sign');box('OldSignBoard',{x:-3,y:3.18,z:-3.18,w:2.15,h:.42,d:.1,color:'#8a6b48'},decor.sign);sign('OldSignLetters',{text:'慢慢寄 · 好好收',x:-3,y:3.18,z:-3.11,w:2,h:.27,color:'#8a6b48',ink:'#f1e0ba'},decor.sign);
 decor.plant=plant(.7,-2.95);decor.plant.name='Decor:plant';
 decor.lamp=group('Decor:lamp');cylinder('LampCord',{x:.8,y:3.1,z:.1,r:.025,h:.9,color:'#79694f'},decor.lamp);cylinder('PendantShade',{x:.8,y:2.65,z:.1,r:.42,h:.16,color:'#d4b26e'},decor.lamp);sphere('LampBulb',{x:.8,y:2.54,z:.1,r:.14,color:'#ffe4a3'},decor.lamp);
 decor.bench=bench({id:'Decor:bench',x:2.7,z:-2.6,w:2.25,color:'#769084'});
 decor.bells=group('Decor:bells');for(let i=0;i<5;i++){const x=2.55+i*.38;cylinder('BellString',{x,y:2.75,z:3.24,r:.009,h:.4+i%2*.13,color:'#b4a27c'},decor.bells);cylinder('CopperBell',{x,y:2.49-i%2*.065,z:3.24,r:.085,h:.12,color:'#b18b4d'},decor.bells);}
 const cardRoot=group('WindowCards'),people=new Map(),pool=new Map(),retired=new T.Group();scene.add(retired);retired.visible=false;
 let lastTap=null,projection=null,cardKey='',generation=0,closed=false,paused=false,zoom=1,pan={x:0,z:.35},yaw=.3;
 const labels=document.getElementById('labels'),observers=[];
 function render(){
  if(closed)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  const spanX=Math.max(12.8,12.8*w/h),spanY=spanX*h/w;
  camera.left=-spanX/2/zoom;camera.right=spanX/2/zoom;camera.top=spanY/2/zoom;camera.bottom=-spanY/2/zoom;camera.updateProjectionMatrix();
  const target=new T.Vector3(pan.x,1.15,pan.z);camera.position.set(target.x+Math.sin(yaw)*14,10.5,target.z+Math.cos(yaw)*14);camera.lookAt(target);camera.updateMatrixWorld();
  renderer.render(scene,camera);
  for(const a of people.values()){const q=new T.Vector3(a.x,a.labelY||1.7,a.z).project(camera);a.label.style.left=(q.x+1)*w/2+'px';a.label.style.top=(1-q.y)*h/2+'px';a.label.hidden=q.z< -1||q.z>1||Math.abs(q.x)>.94||Math.abs(q.y)>.94;}
 }
 function resize(){if(closed)return;renderer.setSize(stage.clientWidth,stage.clientHeight);render();}
 const observer=new ResizeObserver(resize);observer.observe(stage);
 const listen=(target,name,fn,opts)=>{target.addEventListener(name,fn,opts);observers.push(()=>target.removeEventListener(name,fn,opts));};
 const gesture=createMapGesture({min:.65,max:2,initial:1,onZoom:v=>{zoom=v;render();},onPan:(dx,dy)=>{pan.x=T.MathUtils.clamp(pan.x-dx/stage.clientWidth*10/zoom,-4,4);pan.z=T.MathUtils.clamp(pan.z-dy/stage.clientHeight*10/zoom,-3,4);render();},onTap:(x,y)=>{
  if(paused)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
  const hits=ray.intersectObject(counterRoot,true).length;lastTap={x,y,hits};if(hits)counter?.();
 }});
 const canvas=renderer.domElement;listen(canvas,'pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;gesture.down(e.pointerId,e.clientX,e.clientY);canvas.setPointerCapture(e.pointerId);});
 listen(canvas,'pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY));listen(canvas,'pointerup',e=>gesture.up(e.pointerId,e.clientX,e.clientY));
 for(const event of ['pointercancel','lostpointercapture'])listen(canvas,event,e=>gesture.up(e.pointerId,e.clientX,e.clientY,true));
 listen(canvas,'wheel',e=>{e.preventDefault();gesture.setZoom(zoom*Math.exp(-T.MathUtils.clamp(e.deltaY,-240,240)*.002));},{passive:false});
 async function sync(next){
  if(closed)return;projection=next;const ticket=++generation;
  const light=next.lighting;scene.background.set(light==='night'?'#65706f':light==='evening'?'#b6a58b':'#e6dfcc');
  hemi.intensity=light==='night'?.38:light==='evening'?1.25:2.4;sun.intensity=light==='night'?.12:light==='evening'?.75:2.8;
  sun.color.set(light==='evening'?'#ffc78e':'#fff0cf');closedSign.visible=closedDoor.visible=next.closed;
  for(const [key,node]of Object.entries(decor))node.visible=next.decor.some(d=>d.builder===key);
  glow.intensity=light==='evening'&&decor.lamp.visible?6:0;
  const ck=JSON.stringify(next.cards);if(ck!==cardKey){cardKey=ck;disposeMap(cardRoot);cardRoot.clear();
   next.cards.forEach((card,i)=>{const x=-3.1+i*.79,frame=box('CardFrame:'+card.id,{x,y:2.25,z:-2.87,w:.68,h:.92,d:.055,color:'#dec99d'},cardRoot);
    const face=sign('Card:'+card.id,{text:card.name,x,y:2.25,z:-2.83,w:.59,h:.81,color:'#f4e8cf',ink:'#756146'},cardRoot);face.userData.cardId=card.id;
    if(card.image)Promise.resolve(thumbnail?.(card.image)).then(url=>{if(!url||closed||!face.parent)return;const tex=new T.TextureLoader().load(url,()=>{if(closed||!face.parent){tex.dispose();return;}tex.colorSpace=T.SRGBColorSpace;face.material.map?.dispose();face.material.map=tex;face.material.color.set('#ffffff');face.material.needsUpdate=true;render();},undefined,()=>tex.dispose());}).catch(()=>{});
   });
  }
  const wanted=new Set(next.staff.map(s=>s.post+':'+s.id));
  for(const [id,a]of people)if(!wanted.has(id)){a.label.remove();retired.add(a.avatar.root);pool.set(id,a);people.delete(id);}
  // No model at all is needed for an empty/closed store.
  if(next.staff.length){const source=await loadTravelerSource();if(closed||ticket!==generation)return;
   for(const person of next.staff){const id=person.post+':'+person.id;let a=people.get(id);
    if(!a){a=pool.get(id);pool.delete(id);if(!a){const avatar=createTraveler(source,true,person.look),label=document.createElement('span');label.className='staff-label';a={avatar,label};}labels.append(a.label);people.set(id,a);scene.add(a.avatar.root);}
    Object.assign(a,person);a.label.textContent=person.name+' · '+person.post;a.avatar.setLook(person.look,true);a.avatar.root.position.set(person.x,.08,person.z);a.avatar.root.rotation.y=person.yaw;
   }
   await Promise.all([...people.values()].map(a=>a.avatar.ready()));
  }
  if(!closed&&ticket===generation){tick(performance.now()/1000);for(const a of people.values())a.labelY=visibleBounds(T,[a.avatar.root]).max.y+.12;render();}
 }
 function tick(time){if(closed||paused)return;for(const a of people.values())a.avatar.animate(time,{height:a.seat||.08,seated:!!a.seat,seatPose:a.seat?'chair':null,gesture:a.gesture,task:a.post==='分拣'?{kind:'pack',target:{x:-2.25,y:.76,z:-2.5}}:null});}
 function dispose(){if(closed)return;closed=true;generation++;observer.disconnect();for(const off of observers)off();for(const a of people.values())a.label.remove();people.clear();disposeWorldRenderer(renderer,scene);}
 resize();
 return {scene,camera,renderer,sync,tick,render,dispose,pause:value=>{paused=value;gesture.cancel();},resetView:()=>{pan={x:0,z:.35};yaw=.3;gesture.setZoom(1);},snapshot:()=>({lastTap,projection,people:[...people.values()].map(a=>({id:a.id,post:a.post,look:a.look,x:a.avatar.root.position.x,z:a.avatar.root.position.z,posture:a.avatar.root.userData.posture,bounds:new T.Box3().setFromObject(a.avatar.root).getSize(new T.Vector3()).toArray()})),decor:Object.entries(decor).filter(([,n])=>n.visible).map(([id])=>id),cards:cardRoot.children.filter(c=>c.userData.cardId).map(c=>({id:c.userData.cardId,image:!!c.material.map&&!c.material.map.isCanvasTexture})),lighting:{ambient:hemi.intensity,sun:sun.intensity,lamp:glow.intensity},closedSign:closedSign.visible,disposed:closed}),projectCounter:()=>{const q=new T.Vector3(-1.45,.91,1.15).project(camera);return {x:(q.x+1)*stage.clientWidth/2,y:(1-q.y)*stage.clientHeight/2};}};
}
