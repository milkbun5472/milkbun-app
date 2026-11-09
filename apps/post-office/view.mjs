import {SHOP_FLOOR,SHOP_CHAIR,SHOP_BENCH} from './furniture.mjs?v=fg-dbb1a66fa5e524fe';
import {storyAnimation,storyHandPoint,makeStoryLetter,applyStoryPair,createStoryTools} from '../fairy-garden/story-motion.mjs?v=fg-dbb1a66fa5e524fe';
import {createShopExterior} from './exterior.mjs?v=fg-dbb1a66fa5e524fe';
import {createDayEnvironment,prepareEnvironmentSurfaces} from '../fairy-garden/day/environment-view.mjs?v=fg-dbb1a66fa5e524fe';
import {makeNpcCostume} from './npc-outfits.mjs?v=fg-dbb1a66fa5e524fe';
import {createShopFlow,unitSeat} from './flow.mjs?v=fg-dbb1a66fa5e524fe';
import {createShopDecor} from './decor-view.mjs?v=fg-dbb1a66fa5e524fe';
import * as T from 'three';
import {createRoomKit} from '../fairy-garden/day/places/room-kit.mjs?v=fg-dbb1a66fa5e524fe';
import {createWorldRenderer,disposeWorldRenderer} from '../fairy-garden/world-renderer.mjs?v=fg-dbb1a66fa5e524fe';
import {createMapGesture,createMapOrbit,orthographicCameraPose,orthographicPanDelta} from '../fairy-garden/view-controls.mjs?v=fg-dbb1a66fa5e524fe';
import {splitRoomCutaway,createRoomCutaway} from '../fairy-garden/day/camera-view.mjs?v=fg-dbb1a66fa5e524fe';
import {createTraveler,loadTravelerSource} from '../fairy-garden/traveler.mjs?v=fg-dbb1a66fa5e524fe';
import {disposeMap} from '../fairy-garden/map-loader.mjs?v=fg-dbb1a66fa5e524fe';
import {visibleBounds} from '../fairy-garden/photo-render.mjs?v=fg-dbb1a66fa5e524fe';
export function createPostOfficeView(stage,{name,counter,thumbnail,select,monthly,onMeetEnd,onEvent}={}){
 const renderer=createWorldRenderer(stage),scene=new T.Scene(),camera=new T.OrthographicCamera(-6,6,7,-7,.1,100),kit=createRoomKit();
 const {root,box,cylinder,sphere,ellipsoid,tube,group,sign,table,chair,bench,plant}=kit;
 scene.add(root);scene.background=new T.Color('#e6dfcc');
 const hemi=new T.HemisphereLight('#fff4da','#927a60',2.4);scene.add(hemi);
 const sun=new T.DirectionalLight('#fff0cf',2.8);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7});sun.shadow.normalBias=.025;scene.add(sun);
 const glow=new T.PointLight('#ffca76',0,12,2);glow.position.set(.8,2.9,.1);scene.add(glow);
 box('ShopFloor',{w:9.3,d:7.3,h:.25,y:-.045,color:'#bea47e'});
 for(let x=-4.2;x<4.5;x+=.45)box('FloorSeam',{x,y:.082,w:.012,h:.003,d:7,color:'#ab916d',radius:0});
 for(const wall of [{x:-1.675,y:1.75,w:5.95,h:3.5},{x:4.325,y:1.75,w:.65,h:3.5},{x:2.65,y:.51,w:2.7,h:1.02},{x:2.65,y:3.24,w:2.7,h:.52}])box('BackWall',{...wall,z:-3.5,d:.17,color:'#e5dcc4'});
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
 for(const x of [1.32,3.98])box('WindowFrame',{x,y:2,z:-3.34,w:.14,h:1.95,d:.18,color:'#6f8877'});for(const y of [1.05,2.95])box('WindowFrame',{x:2.65,y,z:-3.34,w:2.8,h:.14,d:.18,color:'#6f8877'});
 const glass=box('WindowGlass',{x:2.65,y:2,z:-3.25,w:2.53,h:1.75,d:.025,color:'#c9d9cf',radius:0});glass.material=glass.material.clone();glass.material.transparent=true;glass.material.opacity=.11;glass.material.depthWrite=false;glass.castShadow=false;glass.receiveShadow=false;
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
 chair(SHOP_CHAIR);
 const mailbags=group('MailbagRack',{x:4.05,z:2.45});
 for(const x of [-.3,.3])cylinder('RackPole',{x,y:.68,r:.045,h:1.2,color:'#7e7964'},mailbags);
 box('RackTop',{y:1.3,w:.85,h:.07,d:.15,color:'#7e7964'},mailbags);
 for(const x of [-.22,.22]){ellipsoid('Mailbag',{x,y:.72,w:.4,h:.63,d:.4,color:'#ba9e72'},mailbags);box('BagFlap',{x,y:.97,z:.18,w:.36,h:.17,d:.07,color:'#8a7956'},mailbags);}
 const decor={};
 decor.sign=group('Decor:sign');box('OldSignBoard',{x:-3,y:3.18,z:-3.18,w:2.15,h:.42,d:.1,color:'#8a6b48'},decor.sign);sign('OldSignLetters',{text:'慢慢寄 · 好好收',x:-3,y:3.18,z:-3.11,w:2,h:.27,color:'#8a6b48',ink:'#f1e0ba'},decor.sign);
 decor.plant=plant(.7,-2.95);decor.plant.name='Decor:plant';
 decor.lamp=group('Decor:lamp');cylinder('LampPullCord',{x:1.12,y:1.865,z:.1,r:.009,h:1.63,color:'#9d8962'},decor.lamp);sphere('LampPullKnob',{x:1.12,y:1.05,z:.1,r:.04,color:'#c9ab70'},decor.lamp);cylinder('LampCord',{x:.8,y:3.1,z:.1,r:.025,h:.9,color:'#79694f'},decor.lamp);cylinder('PendantShade',{x:.8,y:2.65,z:.1,r:.42,h:.16,color:'#d4b26e'},decor.lamp);sphere('LampBulb',{x:.8,y:2.54,z:.1,r:.14,color:'#ffe4a3'},decor.lamp);
 decor.bench=bench(SHOP_BENCH);
 decor.bells=group('Decor:bells');for(let i=0;i<5;i++){const x=2.55+i*.38;cylinder('BellString',{x,y:2.75,z:3.24,r:.009,h:.4+i%2*.13,color:'#b4a27c'},decor.bells);cylinder('CopperBell',{x,y:2.49-i%2*.065,z:3.24,r:.085,h:.12,color:'#b18b4d'},decor.bells);}
 const decoration=createShopDecor(kit,decor,monthly),liveFlow=createShopFlow({onMeetEnd,onEvent}),cardRoot=group('WindowCards'),people=new Map(),heldLetters=new Map(),storyTools=createStoryTools(scene);let flow=liveFlow,pairReport=null;
 const exterior=createShopExterior(scene),fill=new T.DirectionalLight('#dae9e3',.4);fill.position.set(6,5,-3);scene.add(fill);prepareEnvironmentSurfaces(root);root.userData.dayWeatherRoofs=[{min:[-4.65,0,-3.55],max:[4.65,4,3.55]}];const environment=createDayEnvironment({scene,renderer,hemi,sun,fill});environment.bind({bounds:{w:15,d:20},outdoor:true,furniture:[{kind:'lamp',x:-2.4,z:-5.1},{kind:'lamp',x:3.4,z:-5.1}]},{root},{particles:120});
 const homeOrbit={yaw:.3,pitch:Math.atan2(10.5-1.15,14)},orbit=createMapOrbit(),cutaway=createRoomCutaway();orbit.restore(homeOrbit);
 counterRoot.userData.furnitureId='shop-counter';mailWall.userData.furnitureId='shop-cubbies';cardRoot.userData.furnitureId='shop-cards';
 for(const [name,item]of decoration.entries)item.node.userData.furnitureId='shop-decor:'+name;
 splitRoomCutaway(T,root,{w:9.3,d:7});
 const lights=[glow,...[1,2].map(i=>{const l=new T.PointLight('#ffca76',0,8,2);l.position.set(.8+i*.8,2.55,.1);scene.add(l);return l;})];
 let lastTime=null,animationTime=0,closeResolve=null,closePromise=null;
 let lastTap=null,projection=null,cardKey='',generation=0,closed=false,paused=false,zoom=1,pan={x:0,z:.35};
 const labels=document.getElementById('labels'),observers=[],narrator=document.createElement('span');narrator.className='shop-speech shop-narration';narrator.hidden=true;labels.append(narrator);
 const controls=document.createElement('div');controls.className='shop-performance';controls.hidden=true;const progress=document.createElement('span'),nextLine=document.createElement('button'),stopStory=document.createElement('button');nextLine.textContent='下一句';stopStory.textContent='结束演出';nextLine.onclick=()=>flow.nextBeat();stopStory.onclick=()=>flow.skipStory();controls.append(progress,nextLine,stopStory);const weatherLabel=document.createElement('span');weatherLabel.className='shop-weather';weatherLabel.title='按手机本地日期和钟点，每3小时按季节概率安排景观天气';stage.append(controls,weatherLabel);
 function render(){
  if(closed)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
  const spanX=Math.max(12.8,12.8*w/h),spanY=spanX*h/w;
  camera.left=-spanX/2/zoom;camera.right=spanX/2/zoom;camera.top=spanY/2/zoom;camera.bottom=-spanY/2/zoom;camera.updateProjectionMatrix();
  // Preserve the shop's target height while sharing the orbit/frustum protection.
  const pose=orthographicCameraPose(pan,spanY,zoom,-.65*zoom,orbit.snapshot());camera.far=pose.far;camera.position.copy(pose.position);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();cutaway.update(root,{w:9.3,d:7},{x:camera.position.x-pan.x,z:camera.position.z-pan.z});
  renderer.render(scene,camera);narrator.textContent=flow.narration;narrator.hidden=!flow.narration;const performance=flow.performance;controls.hidden=!performance;progress.textContent=performance?(performance.kind==='closing'?'打烊':'来访')+' · '+(performance.index+1)+' / '+performance.total:'';
  for(const a of people.values()){const u=flow.units.get(a.key);if(!u)continue;const q=new T.Vector3(a.avatar.root.position.x,a.avatar.root.position.y+(a.headHeight||1.55),a.avatar.root.position.z).project(camera);a.label.style.left=(q.x+1)*w/2+'px';a.label.style.top=(1-q.y)*h/2+'px';if(u.kind==='staff'&&u.phase==='leaving')a.label.textContent=u.name+' · 离店';a.label.hidden=u.phase==='waiting-entry'||q.z< -1||q.z>1||Math.abs(q.x)>.94||Math.abs(q.y)>.94;a.bubble.textContent=u.bubble||'';a.bubble.hidden=a.label.hidden||!u.bubble;a.bubble.style.left=Math.max(78,Math.min(w-78,(q.x+1)*w/2))+'px';a.bubble.style.top=Math.max(45,(1-q.y)*h/2-24)+'px';}
 }
 function resize(){if(closed)return;renderer.setSize(stage.clientWidth,stage.clientHeight);render();}
 const observer=new ResizeObserver(resize);observer.observe(stage);
 const listen=(target,name,fn,opts)=>{target.addEventListener(name,fn,opts);observers.push(()=>target.removeEventListener(name,fn,opts));};
 const gesture=createMapGesture({min:.65,max:24,initial:1,onZoom:v=>{zoom=v;render();},onRotate:(dx,dy)=>{orbit.rotate(dx,dy);render();},onPan:(dx,dy)=>{const a=new T.Raycaster(),b=new T.Raycaster();a.setFromCamera(new T.Vector2(0,0),camera);b.setFromCamera(new T.Vector2(dx/stage.clientWidth*2,-dy/stage.clientHeight*2),camera);const q=orthographicPanDelta(a.ray.origin,b.ray.origin,a.ray.direction);if(q){pan.x=T.MathUtils.clamp(pan.x+q.x,-4,4);pan.z=T.MathUtils.clamp(pan.z+q.z,-3,4);render();}},onTap:(x,y)=>{
  if(paused||flow.closing)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
  for(const a of people.values()){const u=flow.units.get(a.key);if(!u||u.phase==='waiting-entry'||u.phase==='leaving')continue;const point=a.avatar.root.position.clone().add(new T.Vector3(0,u.seated?1.0:1.4,0)).project(camera),dx=(point.x+1)*rect.width/2-(x-rect.left),dy=(1-point.y)*rect.height/2-(y-rect.top);if(Math.hypot(dx,dy)<23){select?.(u.kind==='staff'?{type:'staff',post:u.post}:{type:'guest',id:u.id});return;}}
  const item=decoration.hit(ray);if(item){select?.({type:'decor',name:item});return;}
  if(ray.intersectObject(cardRoot,true).length||ray.intersectObject(mailWall,true).length){select?.({type:'window'});return;}
  const hits=ray.intersectObject(counterRoot,true).length;lastTap={x,y,hits};if(hits)counter?.();
 }});
 const canvas=renderer.domElement;listen(canvas,'pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;gesture.down(e.pointerId,e.clientX,e.clientY);canvas.setPointerCapture(e.pointerId);});
 listen(canvas,'pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY));listen(canvas,'pointerup',e=>gesture.up(e.pointerId,e.clientX,e.clientY));
 for(const event of ['pointercancel','lostpointercapture'])listen(canvas,event,e=>gesture.up(e.pointerId,e.clientX,e.clientY,true));
 listen(canvas,'wheel',e=>{e.preventDefault();gesture.setZoom(zoom*Math.exp(-T.MathUtils.clamp(e.deltaY,-240,240)*.002));},{passive:false});
 async function sync(next){
  if(closed)return;projection=next;const ticket=++generation;
  const light=next.lighting;exterior.sync(next.environment);weatherLabel.textContent=next.environment?next.environment.seasonName+' · '+next.environment.phase+' '+next.environment.time+' · '+next.environment.kind:'';scene.background.set(next.environment?.night?'#34434d':next.environment?.sky||'#e6dfcc');
  hemi.intensity=light==='night'?.38:light==='evening'?1.25:2.4;sun.intensity=light==='night'?.12:light==='evening'?.75:2.8;
  sun.color.set(light==='evening'?'#ffc78e':'#fff0cf');closedSign.visible=closedDoor.visible=next.closed&&!flow.closing;
  decoration.sync(next);
  lights.forEach((l,i)=>l.intensity=!next.closed&&next.decor.some(d=>d.builder==='lamp'&&d.level>i)?lampPower(next):0);
  const ck=JSON.stringify(next.cards);if(ck!==cardKey){cardKey=ck;disposeMap(cardRoot);cardRoot.clear();
   next.cards.forEach((card,i)=>{const x=-3.1+i*.79,frame=box('CardFrame:'+card.id,{x,y:2.25,z:-2.87,w:.68,h:.92,d:.055,color:'#dec99d'},cardRoot);
    const face=sign('Card:'+card.id,{text:card.name,x,y:2.25,z:-2.83,w:.59,h:.81,color:'#f4e8cf',ink:'#756146'},cardRoot);face.userData.cardId=card.id;
    if(card.image)loadCardImage(face,card.image,()=>!closed&&!!face.parent);
   });
  }
  if(!flow.closing)flow.reconcile(next);
  await ensureActors();
  if(!closed&&ticket===generation){tick(performance.now()/1000,0);render();}
 }
 async function ensureActors(){
  if(!flow.units.size)return;const source=await loadTravelerSource();if(closed)return;
  const ready=[];
  for(const u of flow.units.values()){let a=people.get(u.key);if(!a){const avatar=createTraveler(source,true,u.look,u.npcStyle?{costume:model=>makeNpcCostume(model,u.npcStyle)}:{}),label=document.createElement('span'),bubble=document.createElement('span');label.className='staff-label';bubble.className='shop-speech';bubble.hidden=true;labels.append(label,bubble);a={key:u.key,avatar,label,bubble,badgeKey:''};a.letter=null;people.set(u.key,a);scene.add(avatar.root);}
   const appearance=JSON.stringify(u.look);if(a.lookKey!==appearance){a.avatar.setLook(u.look,true);a.lookKey=appearance;}
   a.label.textContent=u.kind==='staff'?u.name+' · '+u.post:u.urgent?'急':u.visitor?u.name:'';a.label.classList.toggle('urgent',!!u.urgent);
   ready.push(a.avatar.ready().then(()=>{if(closed||!people.has(u.key))return;syncBadge(a,u);a.headHeight=1.55;}));
  }
  await Promise.all(ready);
 }
 // Window cards and worn badges use the same cached thumbnail and close-up filtering.
 function loadCardImage(mesh,ref,current){
  if(!ref)return;Promise.resolve(thumbnail?.(ref)).then(url=>{if(!url||!current())return;
   const texture=new T.TextureLoader().load(url,()=>{if(!current()){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mesh.material.map?.dispose();mesh.material.map=texture;mesh.material.color.set('#ffffff');mesh.material.toneMapped=false;mesh.material.needsUpdate=true;render();},undefined,()=>texture.dispose());
  }).catch(()=>{});
 }
 function badgeSnapshot(a){
  const mesh=a.badge;if(!mesh)return null;mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox,world=mesh.localToWorld(bounds.getCenter(new T.Vector3())),points=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).project(camera));
  return {image:!!mesh.material.map&&!mesh.material.map.isCanvasTexture,pixels:[mesh.material.map?.image?.width||0,mesh.material.map?.image?.height||0],world:world.toArray(),attachment:a.badgeMount?.inspect(),bounds:{left:(Math.min(...points.map(p=>p.x))+1)*stage.clientWidth/2,right:(Math.max(...points.map(p=>p.x))+1)*stage.clientWidth/2,top:(1-Math.max(...points.map(p=>p.y)))*stage.clientHeight/2,bottom:(1-Math.min(...points.map(p=>p.y)))*stage.clientHeight/2}};
 }
 function syncBadge(a,u){const card=u.badge,key=card?.id||'',artKey=JSON.stringify([key,card?.cover||card?.face||'',card?.text?.name||'']);if(a.badgeArtKey===artKey&&a.badgeLook===a.lookKey)return;a.badgeKey=key;a.badgeArtKey=artKey;a.badgeLook=a.lookKey;if(a.badge){a.badgeMount?.dispose();disposeMap(a.badge);a.badge.removeFromParent();a.badge=null;}if(!key)return;
  const body=a.avatar.root.getObjectByName('body');if(!body)return;const cv=document.createElement('canvas');cv.width=128;cv.height=160;const ctx=cv.getContext('2d');ctx.fillStyle='#ead9b2';ctx.fillRect(0,0,128,160);ctx.fillStyle='#80694b';ctx.font='42px system-ui';ctx.textAlign='center';ctx.fillText(String(card.text?.name||'邮').slice(0,2),64,95,115);const fallback=new T.CanvasTexture(cv);fallback.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(.13,.17,4,6),new T.MeshBasicMaterial({map:fallback,side:T.DoubleSide}));mesh.name='StaffBadge:'+key;a.badgeMount=a.avatar.attachChest(mesh);a.badge=mesh;
  loadCardImage(mesh,card.cover||card.face,()=>!closed&&people.get(a.key)===a&&a.badge===mesh);
 }
 function tick(time,forced=null){if(closed||paused)return;const dt=forced==null?Math.min(.1,Math.max(0,time-(lastTime??time))):forced;lastTime=time;animationTime+=dt;flow.step(dt);
  for(const [key,a]of people){const u=flow.units.get(key);if(!u){a.label.remove();a.bubble.remove();a.avatar.dispose();people.delete(key);continue;}
   const seat=unitSeat(u),seated=!!seat,point=seat?{x:seat.seatX,z:seat.seatZ}:u.position;a.avatar.root.visible=u.phase!=='waiting-entry';a.avatar.root.position.set(point.x,.08,point.z);a.avatar.root.rotation.y=u.heading||0;
   let task=null;if(u.kind==='staff'&&u.phase!=='meeting'&&!u.path.length&&!u.performing&&!u.partnerMotion){
    if(['handover','help'].includes(u.taskAction))task={kind:'serve',target:{x:u.position.x+Math.sin(u.heading||0)*.5,y:1.02,z:u.position.z+Math.cos(u.heading||0)*.5}};
    else if(u.serviceUntil>flow.time||u.taskAction==='tidy'||u.phase==='tidying'||u.post==='分拣'&&u.phase==='working')task={kind:'pack',target:u.post==='柜台'?{x:u.home.x,y:.94,z:1.12}:u.post==='分拣'?{x:-2.25,y:.8,z:-2.5}:{x:u.position.x,y:.85,z:u.position.z-.5}};
   }
   const motion=u.storyMotion&&u.arrived?storyAnimation(u.storyMotion.action,u.storyMotion.progress):null;
   if(motion&&u.storyMotion.idle)motion.emotion=u.storyMotion.idle;
   a.avatar.animate(animationTime,{moving:!!u.path.length,seated,seatPose:seat?.pose,height:seat?SHOP_FLOOR+seat.rise+.05:SHOP_FLOOR,gesture:seated?'sit':motion?.gesture|| (u.letter?'hold':'rest'),emotion:motion?.emotion||null,progress:motion?.progress||0,task});
  }
  storyTools.begin();pairReport=null;const pullKnob=decor.lamp.getObjectByName('LampPullKnob'),pullCord=decor.lamp.getObjectByName('LampPullCord');if(pullKnob)pullKnob.position.y=1.05;if(pullCord){pullCord.position.y=1.865;pullCord.scale.y=1;}
  for(const a of people.values()){
   const u=flow.units.get(a.key),m=u?.storyMotion;if(!u||!m||!u.arrived||u.path.length)continue;
   if(m.action==='sweep')storyTools.sweep(a.avatar,m.progress);
   if(m.action==='lamp'){const bought=projection?.decor.some(d=>d.builder==='lamp'),target=bought?{x:1.12,y:1.05,z:.1}:{x:u.position.x+.1,y:1.5,z:u.position.z};storyTools.lamp(a.avatar,m.progress,target);if(bought&&pullKnob&&pullCord){pullKnob.position.y=1.05-.12*Math.sin(m.progress*Math.PI)**2;pullCord.position.y=(2.68+pullKnob.position.y)/2;pullCord.scale.y=(2.68-pullKnob.position.y)/1.63;}}
   const partner=[...flow.units.values()].find(v=>v.partnerMotion?.actor===u.key),other=partner&&people.get(partner.key);
   if(other)pairReport={actor:u.id,target:partner.id,action:m.action,progress:m.progress,...applyStoryPair(a.avatar,other.avatar,m.action,m.progress,{giverSide:m.giverSide||'right'})};
  }
  const used=new Set();
  for(const a of people.values()){
   const u=flow.units.get(a.key);a.letter=null;if(!u?.letter)continue;const id=u.letterId||'letter:'+u.key;let letter=heldLetters.get(id);if(!letter){letter=makeStoryLetter();heldLetters.set(id,letter);scene.add(letter);}used.add(id);letter.visible=true;letter.userData.owner=u.id;letter.userData.itemId=id;letter.position.copy(storyHandPoint(a.avatar,u.letterHand||'right'));letter.rotation.set(-.15,a.avatar.root.rotation.y+.2,.25);a.letter=letter;
  }
  for(const [id,letter]of heldLetters)if(!used.has(id)){disposeMap(letter);letter.removeFromParent();heldLetters.delete(id);}
  const cut=flow.storyLampOff?0:1;if(!flow.closing)lights.forEach((l,i)=>{l.intensity=projection&&!projection.closed&&projection.decor.some(d=>d.builder==='lamp'&&d.level>i)?lampPower(projection)*cut:0;});
  if(projection?.environment){const env=projection.environment;environment.update(env.minute,{source:'world',code:env.snow?73:env.rain?61:env.mist?45:env.cloudy?3:0,wind:env.wind,lighting:env},time);exterior.tick(time);}
  if(flow.closing){lights.forEach((l,i)=>{const level=projection?.decor.find(d=>d.builder==='lamp')?.level||0;const progress=Math.max(0,Math.min(1,flow.lampProgress*level-i));l.intensity=i<level?lampPower(projection)*cut*(1-progress):0;});if(flow.closingDone){closedSign.visible=closedDoor.visible=true;if(closeResolve){closeResolve(true);closeResolve=null;}}}
 }
 function lampPower(next){const e=next?.environment;return e?(e.phase==='傍晚'||e.night||e.light<.65?6:0):next?.lighting==='evening'?6:0;}
 function weatherSnapshot(){const state=environment.inspect(),weather=scene.getObjectByName('DayWeather'),roofs=root.userData.dayWeatherRoofs||[];let indoorParticles=0;if(weather?.visible)for(const mesh of weather.children){if(!mesh.visible)continue;const p=mesh.geometry.attributes.position,count=Math.min(p.count,mesh.geometry.drawRange.count);for(let i=0;i<count;i+=mesh.isLineSegments?2:1)if(p.getY(i)>0&&roofs.some(r=>p.getX(i)>r.min[0]&&p.getX(i)<r.max[0]&&p.getZ(i)>r.min[2]&&p.getZ(i)<r.max[2]))indoorParticles++;}return {...state,indoorParticles};}
 async function startClosing(story=projection?.closing){if(closePromise)return closePromise;closePromise=new Promise(resolve=>{closeResolve=resolve;});flow=createShopFlow({onEvent});flow.reconcile({...projection,ambient:false,closed:false,phase:'open',staff:Array.isArray(story?.staff)?story.staff:projection?.staff||[],customers:[]});flow.startClosing(story||{});await ensureActors();return closePromise;}
 function dispose(){if(closed)return;closed=true;generation++;observer.disconnect();for(const off of observers)off();for(const a of people.values()){a.label.remove();a.bubble.remove();}people.clear();narrator.remove();controls.remove();weatherLabel.remove();cutaway.restore();environment.close();closeResolve?.(false);closeResolve=null;disposeWorldRenderer(renderer,scene);}
 resize();
 return {scene,camera,renderer,sync,tick,render,dispose,startClosing,finishClosing:async next=>{flow.finishClosing();flow=liveFlow;closePromise=null;if(next?.closed)liveFlow.units.clear();if(next)projection=next;if(projection)await sync(projection);},resume:flow.resume,playMeet:flow.playMeet,pause:value=>{paused=!!value;lastTime=null;if(paused)gesture.cancel();},resetView:()=>{pan={x:0,z:.35};orbit.restore(homeOrbit);gesture.setZoom(1);},snapshot:()=>({lastTap,projection,storyTools:storyTools.inspect(),pairContact:pairReport,heldItems:[...heldLetters.values()].map(l=>({id:l.userData.itemId,uuid:l.uuid,owner:l.userData.owner,position:l.position.toArray()})),cameraView:{orbit:orbit.snapshot(),pan:{...pan},zoom,cutaway:cutaway.snapshot()},rendering:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},exterior:exterior.snapshot(),weather:weatherSnapshot(),performance:flow.performance,flow:flow.snapshot(),people:[...people.values()].filter(a=>flow.units.has(a.key)).map(a=>{const u=flow.units.get(a.key);return {id:u.id,post:u.post,kind:u.kind,heading:u.heading,forward:(a.avatar.root.getObjectByName('TravelerVisual')||a.avatar.root).getWorldDirection(new T.Vector3()).toArray(),look:u.look,x:a.avatar.root.position.x,z:a.avatar.root.position.z,posture:a.avatar.root.userData.posture,seat:unitSeat(u),seatContact:a.avatar.root.userData.seatContact,phase:u.phase,action:u.taskAction||'',badge:a.badgeKey,badgeView:badgeSnapshot(a),letter:!!a.letter?.visible,storyMotion:u.storyMotion||null,storySkeleton:u.storyMotion||u.partnerMotion?{right:storyHandPoint(a.avatar).toArray(),left:storyHandPoint(a.avatar,'left').toArray(),rightShoulder:a.avatar.root.getObjectByName('rightArm')?.getWorldPosition(new T.Vector3()).toArray(),leftShoulder:a.avatar.root.getObjectByName('leftArm')?.getWorldPosition(new T.Vector3()).toArray(),bodyTilt:a.avatar.root.getObjectByName('TravelerVisual')?.rotation.x}:null,emotion:a.avatar.root.userData.emotion,dailyAction:a.avatar.root.userData.dailyAction,costume:a.avatar.root.getObjectByName('TravelerVisual')?.userData.outfit};}),decor:[...decoration.entries].filter(([,n])=>n.node.visible).map(([name])=>name),cards:cardRoot.children.filter(c=>c.userData.cardId).map(c=>({id:c.userData.cardId,image:!!c.material.map&&!c.material.map.isCanvasTexture})),lighting:{ambient:hemi.intensity,sun:sun.intensity,lamp:lights.reduce((sum,l)=>sum+l.intensity,0)},closedSign:closedSign.visible,disposed:closed}),projectCounter:()=>projectPoint(-1.45,.91,1.15),project:projectPoint};
 function projectPoint(x,y,z){const q=new T.Vector3(x,y,z).project(camera);return {x:(q.x+1)*stage.clientWidth/2,y:(1-q.y)*stage.clientHeight/2};}
}
