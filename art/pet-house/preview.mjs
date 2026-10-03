import * as T from 'three';
import {createPetCamera} from './pet-camera.mjs?v=pet-camera-1';
import {GLTFLoader} from '../../apps/fairy-garden/vendor/GLTFLoader.js';
import {DRACOLoader} from '../../apps/fairy-garden/vendor/DRACOLoader.js';
import {createCatMotion,floorHeight} from './cat-motion.mjs?v=pet-house-2';
import {createCatDye,CAT_PALETTES,CAT_LOOK_KEY} from './cat-dye.mjs?v=pet-house-2';

const layout=await (await fetch(new URL('./layout.json',import.meta.url))).json();
const view=document.getElementById('view'),loading=document.getElementById('loading');
const toWeb=p=>new T.Vector3(p[0],p[2],-p[1]);
const renderer=new T.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;
view.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#eee8dc');
const camera=new T.OrthographicCamera(-5,5,5,-5,.1,100);
const target=toWeb(layout.camera.target),initialPosition=toWeb(layout.camera.position);
const hemi=new T.HemisphereLight('#fff1dc','#c2ae8e',2.35);scene.add(hemi);
const key=new T.DirectionalLight('#fff1da',3.0);key.position.set(-3,7,4);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.03;key.shadow.bias=-.00015;scene.add(key);
const fill=new T.DirectionalLight('#fff8eb',1.2);fill.position.set(3,5,6);scene.add(fill);
const lamp=new T.PointLight('#ffc184',0,4,2);lamp.position.copy(toWeb([.1,1.94,1.29]));scene.add(lamp);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#eee8dc',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.365;floor.receiveShadow=true;scene.add(floor);
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath(new URL('../../apps/fairy-garden/vendor/draco/',import.meta.url).href);loader.setDRACOLoader(draco);
let room,cat,petRoot,motion,dye,rig,walking=false,speed=0,pathPhase=0,settling=0;
const meshes=[],pathOrigin=toWeb(layout.cat.position),pathYaw=layout.cat.yaw;
const walkButton=document.getElementById('walk'),furButton=document.getElementById('fur');
const baseInput=document.getElementById('fur-base'),patchInput=document.getElementById('fur-patch');
try{
  const [roomFile,catFile,metadata,mask]=await Promise.all([loader.loadAsync(new URL('./room.glb?v=pet-house-1',import.meta.url).href),loader.loadAsync(new URL('./cat.glb?v=pet-house-2',import.meta.url).href),fetch(new URL('./cat-rig.json?v=pet-house-2',import.meta.url)).then(r=>{if(!r.ok)throw Error('Cat rig '+r.status);return r.json();}),new T.TextureLoader().loadAsync(new URL('./cat-mask.png?v=pet-house-2',import.meta.url).href)]);
  room=roomFile.scene;cat=catFile.scene;scene.add(room);
  room.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes.push(o);}});
  const bounds=new T.Box3().setFromObject(cat),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=layout.cat.height/size.y;cat.scale.setScalar(scale);
  petRoot=new T.Group();cat.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);petRoot.add(cat);
  petRoot.position.copy(toWeb(layout.cat.position));petRoot.rotation.y=layout.cat.yaw;scene.add(petRoot);
  cat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  rig=metadata;motion=createCatMotion(T,cat,rig,petRoot);dye=createCatDye(T,cat,mask,rig.dye);
  let saved;try{saved=JSON.parse(localStorage.getItem(CAT_LOOK_KEY));}catch{}
  setLook(saved,false);motion.update(0,0);
  walkButton.disabled=false;furButton.disabled=false;
  loading.hidden=true;
  window.petHousePreview={scene,camera,room,cat,petRoot,layout,rig,renderer,motion,dye,
    snapshot:()=>({evening,...cameraControls.snapshot(),zone:activeZone,ready:true,roomMeshes:meshes.length,catStatic:false,walking,speed,look:dye.snapshot(),motion:motion.snapshot()}),select:selectZone,reset,step:advance};
}catch(error){loading.textContent='小屋没能打开，请刷新重试。';console.error(error);}

function updateCamera(){cameraControls.update();}
function advance(dt){
  if(!motion)return;
  const full=rig.stride/rig.duty/rig.cycle*cat.scale.x;
  speed=T.MathUtils.damp(speed,walking?full:0,6,dt);if(!walking&&speed<.003)speed=0;
  const derivativeLength=Math.hypot(.78*Math.cos(pathPhase),.58*Math.sin(pathPhase));
  pathPhase+=speed*dt/derivativeLength;
  const along=.78*Math.sin(pathPhase),across=.58*(1-Math.cos(pathPhase));
  petRoot.position.x=pathOrigin.x+along*Math.sin(pathYaw)+across*Math.cos(pathYaw);
  petRoot.position.z=pathOrigin.z+along*Math.cos(pathYaw)-across*Math.sin(pathYaw);
  petRoot.position.y=floorHeight(petRoot.position.x,petRoot.position.z)+.001;
  const heading=pathYaw+Math.atan2(.58*Math.sin(pathPhase),.78*Math.cos(pathPhase));
  const delta=Math.atan2(Math.sin(heading-petRoot.rotation.y),Math.cos(heading-petRoot.rotation.y));
  const turn=delta*(1-Math.exp(-8*dt));petRoot.rotation.y+=turn;
  motion.update(dt,speed,dt?turn/dt:0,walking);settling=Math.max(0,settling-dt);
}
let pending=false,lastTime=0;
const cameraControls=createPetCamera(T,{camera,view,position:initialPosition,target,scale:layout.camera.scale,getCat:()=>petRoot,draw,onTap:tapFurniture,controlsHost:document.querySelector('.cat-actions')});
function draw(){if(pending||document.hidden)return;pending=true;requestAnimationFrame(time=>{
  pending=false;const dt=lastTime?Math.min(.05,(time-lastTime)/1000):0;lastTime=time;
  advance(dt);updateCamera();renderer.render(scene,camera);
  if(walking||speed>0||settling>0)draw();else lastTime=0;
});}
walkButton.onclick=()=>{walking=!walking;settling=1;walkButton.textContent=walking?'停一停':'走走';walkButton.setAttribute('aria-pressed',String(walking));draw();};
furButton.onclick=()=>{const panel=document.getElementById('fur-panel');panel.hidden=!panel.hidden;furButton.setAttribute('aria-expanded',String(!panel.hidden));};
function setLook(value,persist=true){
  const look=dye.set(value);
  baseInput.value=look.base||rig.dye.baseReference;patchInput.value=look.patch||rig.dye.patchReference;
  for(const button of document.querySelectorAll('[data-palette]')){
    const p=CAT_PALETTES.find(p=>p.id===button.dataset.palette);
    button.setAttribute('aria-pressed',String(look.id==='original'?p.id==='original':look.base===p.base&&look.patch===p.patch));
  }
  if(persist)try{localStorage.setItem(CAT_LOOK_KEY,JSON.stringify(look));}catch{}
}
for(const palette of CAT_PALETTES){
  const button=document.createElement('button');button.textContent=palette.label;button.dataset.palette=palette.id;button.setAttribute('aria-pressed','false');
  button.onclick=()=>{setLook(palette);draw();};document.querySelector('.palettes').append(button);
}
if(dye)setLook(dye.snapshot(),false);
baseInput.oninput=patchInput.oninput=()=>{setLook({base:baseInput.value,patch:patchInput.value});draw();};
function resize(){renderer.setSize(innerWidth,innerHeight);draw();}window.addEventListener('resize',resize);
let evening=false,activeZone='';
document.getElementById('light').onclick=()=>{
  evening=!evening;hemi.color.set(evening?'#d4dcf3':'#fff1dc');hemi.intensity=evening?1.1:2.35;
  key.color.set(evening?'#b8cbff':'#fff1da');key.intensity=evening?.65:3.0;
  fill.color.set(evening?'#ffdab6':'#fff8eb');fill.intensity=evening?.65:1.2;lamp.intensity=evening?10:0;
  const button=document.getElementById('light');button.textContent=evening?'白天':'傍晚';button.setAttribute('aria-pressed',String(evening));button.setAttribute('aria-label',evening?'切换到白天':'切换到傍晚');draw();
};
function selectZone(key){const zone=layout.zones[key];if(!zone)return;activeZone=key;document.getElementById('zone-title').textContent=zone.title;document.getElementById('zone-text').textContent=zone.text;draw();}
function reset(){cameraControls.reset();activeZone='';document.getElementById('zone-title').textContent='猫猫的小客厅';document.getElementById('zone-text').textContent='点点家具看看 · 双指或滚轮缩放';draw();}
document.getElementById('reset').onclick=reset;
const ray=new T.Raycaster(),pointer=new T.Vector2();
function tapFurniture(e){
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
  for(const hit of ray.intersectObjects(meshes,false)){let o=hit.object;while(o&&!o.userData.zone)o=o.parent;if(o&&layout.zones[o.userData.zone]){selectZone(o.userData.zone);break;}}
}
document.addEventListener('visibilitychange',()=>{cameraControls.clearGesture();lastTime=0;if(!document.hidden)draw();});
resize();draw();
