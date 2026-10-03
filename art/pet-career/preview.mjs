import * as T from 'three';
import {GLTFLoader} from '../../apps/fairy-garden/vendor/GLTFLoader.js';
import {DRACOLoader} from '../../apps/fairy-garden/vendor/DRACOLoader.js';
import {createMapGesture,orthographicPanDelta} from '../../apps/fairy-garden/view-controls.mjs';
import {createCatMotion} from '../pet-house/cat-motion.mjs?v=pet-house-3';
import {createPetWorld} from './world-navigation.mjs?v=pet-career-3';
const read=async url=>{const r=await fetch(new URL(url,import.meta.url));if(!r.ok)throw Error('场景文件 '+r.status);return r.json();};
const layout=await read('./outside.json?v=pet-career-3'),world=createPetWorld(layout);
const view=document.getElementById('view'),loading=document.getElementById('loading'),labels=document.getElementById('door-labels');
const title=document.querySelector('h1'),subtitle=document.getElementById('subtitle'),back=document.getElementById('back'),enterButton=document.getElementById('enter');
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;view.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#eee8dc');
const camera=new T.OrthographicCamera(-20,20,20,-20,.1,600);
const hemi=new T.HemisphereLight('#fff1dc','#c2ae8e',2.35);scene.add(hemi);
const key=new T.DirectionalLight('#fff1da',3);key.position.set(-15,28,15);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-38,right:38,top:38,bottom:-38,far:150});key.shadow.normalBias=.035;scene.add(key);
const fill=new T.DirectionalLight('#fff8eb',1.2);fill.position.set(20,30,20);scene.add(fill);
const studio=new T.Mesh(new T.PlaneGeometry(500,500),new T.MeshStandardMaterial({color:'#eee8dc',roughness:1}));studio.rotation.x=-Math.PI/2;studio.position.y=-.29;studio.receiveShadow=true;scene.add(studio);
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath(new URL('../../apps/fairy-garden/vendor/draco/',import.meta.url).href);loader.setDRACOLoader(draco);
const toWeb=p=>new T.Vector3(p[0],p[2],-p[1]);
const sessionKey='lisa-pet-street-preview-v1';let raw;try{raw=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}
let restored=world.restore(raw),position={...restored.position},pan={x:0,z:-8},zoom=.65,follow=false,heading=0,room=null,outdoor=restored.outdoor,roomLayout,activeModel,outsideModel,cat,petRoot,motion,rig,busy=false,ready=false,path=[],destination='',activeZone='',lastTime=0,settling=0;
const requested=new URLSearchParams(location.search).get('scene');
if(world.building(requested)&&restored.room!==requested){position={...world.building(requested).approach};pan={...position};restored.room=null;}
if(requested==='outside'||requested==='park')restored.room=null;
let evening=restored.evening,indoorOrbit={theta:0,phi:0};
function save(){try{sessionStorage.setItem(sessionKey,JSON.stringify({position,room,outdoor,evening}));}catch{}}
function note(a,b){document.getElementById('zone-title').textContent=a;document.getElementById('zone-text').textContent=b;}
function shade(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
function clearModel(root){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});}
function applyLight(){hemi.color.set(evening?'#d4dcf3':'#fff1dc');hemi.intensity=evening?1.1:2.35;key.color.set(evening?'#b8cbff':'#fff1da');key.intensity=evening?.65:3;fill.color.set(evening?'#ffdab6':'#fff8eb');fill.intensity=evening?.65:1.2;const b=document.getElementById('light');b.textContent=evening?'白天':'傍晚';b.setAttribute('aria-pressed',String(evening));b.setAttribute('aria-label',evening?'切换到白天':'切换到傍晚');}
function refresh(){title.textContent=room?world.building(room).title:layout.title;document.title=title.textContent+' · 宠物小世界';subtitle.textContent=room?'从门口进来的小屋':'点地面散步 · 拖动画面';back.textContent=room?'出门':'跟着猫';back.setAttribute('aria-label',room?'出门回到街区':'回到猫猫身边');labels.hidden=!!room;const near=world.nearest(position);enterButton.hidden=!!room||!near||near.distance>.65;enterButton.disabled=busy;enterButton.textContent=near?'走进'+near.building.title:'走进屋里';back.disabled=busy;view.setAttribute('aria-busy',String(busy));}
function setOutdoorPet(){motion?.dispose();petRoot.position.set(position.x,world.ground(position.x,position.z)+.001,position.z);petRoot.rotation.y=heading;motion=createCatMotion(T,cat,rig,petRoot,{ground:world.ground,matchSpeed:true});motion.update(0,0);}
function placeIndoor(){petRoot.position.copy(toWeb(roomLayout.cat.position));petRoot.rotation.y=roomLayout.cat.yaw;cat.updateMatrixWorld(true);}
function updateCamera(){
 const aspect=innerWidth/innerHeight;
 if(!room){const width=(aspect<1?40:48*aspect)/zoom,height=width/aspect;camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;const distance=Math.max(75,height*1.5);camera.position.set(pan.x+distance*.6,distance*.75,pan.z+distance*.85);camera.lookAt(pan.x,0,pan.z);camera.far=Math.max(250,distance*4);}
 else {const target=toWeb(roomLayout.camera.target),pos=toWeb(roomLayout.camera.position);const span=roomLayout.camera.scale/Math.min(1,aspect)/zoom;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;const spherical=new T.Spherical().setFromVector3(pos.sub(target));spherical.theta+=indoorOrbit.theta;spherical.phi+=indoorOrbit.phi;spherical.radius*=Math.max(1,1/zoom);camera.position.copy(target).add(new T.Vector3().setFromSpherical(spherical));camera.lookAt(target);camera.far=250;}
 camera.updateProjectionMatrix();camera.updateMatrixWorld();
 for(const b of layout.buildings){const button=document.getElementById('door-'+b.id),v=new T.Vector3(b.x,5.6,b.z+3).project(camera);button.style.left=((v.x+1)*innerWidth/2)+'px';button.style.top=((1-v.y)*innerHeight/2)+'px';const px=(v.x+1)*innerWidth/2,py=(1-v.y)*innerHeight/2;button.hidden=room!==null||v.z<-1||v.z>1||px<55||px>innerWidth-55||py<120||py>innerHeight-85;button.disabled=busy;}
}
async function enter(id){
 if(busy||room||!world.canEnter(position,id))return false;
 const b=world.building(id);busy=true;path=[];destination='';settling=0;lastTime=0;refresh();loading.textContent='走进'+b.title+'…';loading.hidden=false;
 try{
  const [file,inside]=await Promise.all([loader.loadAsync(new URL(b.interior,import.meta.url).href),read(b.layout)]);
  outdoor={position:{...position},heading,pan:{...pan},zoom,follow};motion?.dispose();motion=null;outsideModel.visible=false;activeModel=file.scene;shade(activeModel);scene.add(activeModel);room=id;roomLayout=inside;zoom=1;indoorOrbit={theta:0,phi:0};gesture.setZoom(1);placeIndoor();activeZone='';note(b.title,'点家具看看 · 点「出门」回街区');history.replaceState(null,'','?scene='+id);save();return true;
 }catch(e){console.error(e);note('暂时没能进屋','还在原来的门口，可以再试一次。');return false;}
 finally{busy=false;loading.hidden=true;refresh();draw();}
}
function leave(){if(busy||!room)return;scene.remove(activeModel);clearModel(activeModel);activeModel=outsideModel;outsideModel.visible=true;position={...outdoor.position};pan={...outdoor.pan};zoom=outdoor.zoom;follow=outdoor.follow;heading=outdoor.heading;room=null;roomLayout=null;activeZone='';settling=0;setOutdoorPet();gesture.setZoom(zoom);note('回到门口','接着走走，也可以去旁边的店。');history.replaceState(null,'','?scene=outside');save();refresh();draw();}
function goTo(point,id=''){
 if(busy||room||!ready)return false;const route=world.path(position,point);if(!route){note('这里暂时走不过去','点点道路或草地试试。');return false;}path=route;destination=id;follow=true;pan={...position};gesture.setZoom(1.6);settling=1;note(id?'去'+world.building(id).title:'散散步',id?'沿路走到门口，再走进去。':'点门牌可以去店里。');draw();return true;
}
function advance(dt){
 if(room||!motion||busy)return;dt=Math.max(0,Math.min(.05,dt));let speed=0;
 if(path.length){const q=path[0],dx=q.x-position.x,dz=q.z-position.z,d=Math.hypot(dx,dz);speed=.72;const step=Math.min(d,speed*dt);if(d>.001){position.x+=dx/d*step;position.z+=dz/d*step;heading=Math.atan2(dx,dz);}if(d<=step+.002)path.shift();if(!path.length){speed=0;settling=.65;save();if(destination){const id=destination;destination='';void enter(id);}}}
 petRoot.position.set(position.x,world.ground(position.x,position.z)+.001,position.z);petRoot.rotation.y=heading;motion.update(dt,speed,0,path.length>0);if(follow){pan.x=T.MathUtils.damp(pan.x,position.x,4,dt);pan.z=T.MathUtils.damp(pan.z,position.z,4,dt);}settling=Math.max(0,settling-dt);refresh();
}
let pending=false;function draw(){if(pending||document.hidden)return;pending=true;requestAnimationFrame(time=>{pending=false;const dt=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;advance(dt);updateCamera();renderer.render(scene,camera);if(path.length||settling>0)draw();else lastTime=0;});}
function resize(){renderer.setSize(innerWidth,innerHeight);draw();}window.addEventListener('resize',resize);
const ray=new T.Raycaster(),pointer=new T.Vector2();
function screenRay(x,y){pointer.set(x/innerWidth*2-1,1-y/innerHeight*2);ray.setFromCamera(pointer,camera);return ray;}
function tap(x,y){if(busy||!ready)return;screenRay(x,y);if(room){for(const hit of ray.intersectObject(activeModel,true)){let o=hit.object;while(o&&!o.userData.zone)o=o.parent;const zone=roomLayout.zones[o?.userData.zone];if(zone){activeZone=o.userData.zone;note(zone.title,zone.text);break;}}draw();return;}
 for(const hit of ray.intersectObject(outsideModel,true)){let o=hit.object;while(o&&!o.userData.zone)o=o.parent;const id=o?.userData.zone?.replace(/^building_/,'');if(world.building(id)){goTo(world.building(id).approach,id);return;}}
 const p=ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.06),new T.Vector3());if(p)goTo({x:p.x,z:p.z});}
const gesture=createMapGesture({initial:zoom,onTap:tap,onZoom:v=>{zoom=v;draw();},onPan:(dx,dy)=>{if(room){indoorOrbit.theta=T.MathUtils.clamp(indoorOrbit.theta-dx*.004,-.6,.6);indoorOrbit.phi=T.MathUtils.clamp(indoorOrbit.phi-dy*.003,-.25,.25);draw();return;}follow=false;screenRay(innerWidth/2,innerHeight/2);const origin=ray.ray.origin.clone(),direction=ray.ray.direction.clone();screenRay(innerWidth/2+dx,innerHeight/2+dy);const delta=orthographicPanDelta(origin,ray.ray.origin,direction);if(delta){pan.x=T.MathUtils.clamp(pan.x+delta.x,-35,35);pan.z=T.MathUtils.clamp(pan.z+delta.z,-54,35);}draw();}});
view.onpointerdown=e=>{if(e.button&&e.pointerType==='mouse')return;view.setPointerCapture(e.pointerId);gesture.down(e.pointerId,e.clientX,e.clientY);};view.onpointermove=e=>gesture.move(e.pointerId,e.clientX,e.clientY);view.onpointerup=e=>gesture.up(e.pointerId,e.clientX,e.clientY);view.onpointercancel=e=>gesture.up(e.pointerId,e.clientX,e.clientY,true);view.onlostpointercapture=e=>gesture.up(e.pointerId,e.clientX,e.clientY,true);view.addEventListener('wheel',e=>{e.preventDefault();gesture.setZoom(zoom*Math.exp(-Math.max(-240,Math.min(240,e.deltaY))*.002));},{passive:false});
for(const b of layout.buildings){const button=document.createElement('button');button.id='door-'+b.id;button.className='door-label';button.textContent=b.title;button.setAttribute('aria-label','走到'+b.title);button.onclick=()=>goTo(b.approach,b.id);labels.append(button);}
back.onclick=()=>{if(room)leave();else{follow=true;pan={...position};gesture.setZoom(1.6);draw();}};
document.getElementById('reset').onclick=()=>{if(room){indoorOrbit={theta:0,phi:0};gesture.setZoom(1);activeZone='';note(title.textContent,'点家具看看 · 点「出门」回街区');}else{follow=false;pan={x:0,z:-10};gesture.setZoom(.55);note('整个小街区','公园、六栋房子和北边林间小路。');}draw();};
document.getElementById('light').onclick=()=>{evening=!evening;applyLight();save();draw();};enterButton.onclick=()=>{const near=world.nearest(position);if(near)void enter(near.building.id);};
document.addEventListener('visibilitychange',()=>{gesture.cancel();lastTime=0;save();if(!document.hidden)draw();});window.addEventListener('pagehide',save);
try{
 const [outsideFile,catFile,metadata]=await Promise.all([loader.loadAsync(new URL('./outside.glb?v=pet-career-3',import.meta.url).href),loader.loadAsync(new URL('../pet-house/cat.glb?v=pet-house-2',import.meta.url).href),read('../pet-house/cat-rig.json?v=pet-house-2')]);
 outsideModel=outsideFile.scene;shade(outsideModel);scene.add(outsideModel);activeModel=outsideModel;cat=catFile.scene;rig=metadata;const bounds=new T.Box3().setFromObject(cat),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scale=.88/size.y;cat.scale.setScalar(scale);cat.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);petRoot=new T.Group();petRoot.add(cat);shade(cat);scene.add(petRoot);setOutdoorPet();applyLight();loading.hidden=true;ready=true;
 window.petCareerPreview={scene,camera,renderer,cat,petRoot,world,layout,enter,leave,goTo,step:advance,reset:()=>document.getElementById('reset').click(),snapshot:()=>({ready,room,position:{...position},outdoor,pan:{...pan},zoom,evening,busy,walking:path.length>0,destination,zone:activeZone,motion:motion?.snapshot()}),get model(){return activeModel;},project:(x,z,h=0)=>{const v=new T.Vector3(x,h,z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}};
 note(layout.title,'点地面散步 · 点房子门牌走进去');refresh();resize();
 if(restored.room){position={...outdoor.position};heading=outdoor.heading||0;pan={...outdoor.pan};zoom=outdoor.zoom||1;follow=outdoor.follow!==false;setOutdoorPet();await enter(restored.room);}
}catch(e){loading.textContent='小街区没能打开，请刷新重试。';console.error(e);}
