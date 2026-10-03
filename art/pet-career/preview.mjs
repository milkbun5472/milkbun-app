import * as T from 'three';
import {createPetCamera} from '../pet-house/pet-camera.mjs?v=pet-camera-1';
import {GLTFLoader} from '../../apps/fairy-garden/vendor/GLTFLoader.js';
import {DRACOLoader} from '../../apps/fairy-garden/vendor/DRACOLoader.js';

const requested=new URLSearchParams(location.search).get('scene');
const sceneId=['bakery','florist','alley'].includes(requested)?requested:'bakery';
const layout=await (await fetch(new URL('./'+sceneId+'.json?v=pet-career-1',import.meta.url))).json();
document.querySelector('h1').textContent=layout.title;document.title=layout.title+' · 宠物小世界';
document.getElementById('zone-title').textContent=layout.title;
for(const link of document.querySelectorAll('[data-scene]'))link.setAttribute('aria-current',link.dataset.scene===sceneId?'page':'false');
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
const lamp=new T.PointLight('#ffc184',0,4,2);lamp.position.copy(toWeb(sceneId==='alley'?[-2.75,1.07,2.69]:[0,1.8,2.5]));scene.add(lamp);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#eee8dc',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.365;floor.receiveShadow=true;scene.add(floor);
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath(new URL('../../apps/fairy-garden/vendor/draco/',import.meta.url).href);loader.setDRACOLoader(draco);
let room,cat,petRoot;const meshes=[];
try{
  const [roomFile,catFile]=await Promise.all([loader.loadAsync(new URL('./'+sceneId+'.glb?v=pet-career-1',import.meta.url).href),loader.loadAsync(new URL('../pet-house/cat.glb?v=pet-house-2',import.meta.url).href)]);
  room=roomFile.scene;cat=catFile.scene;scene.add(room);
  room.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;meshes.push(o);}});
  const bounds=new T.Box3().setFromObject(cat),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=layout.cat.height/size.y;cat.scale.setScalar(scale);
  petRoot=new T.Group();cat.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);petRoot.add(cat);
  petRoot.position.copy(toWeb(layout.cat.position));petRoot.rotation.y=layout.cat.yaw;scene.add(petRoot);
  cat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  loading.hidden=true;
  window.petCareerPreview={scene,camera,room,cat,layout,renderer,snapshot:()=>({evening,...cameraControls.snapshot(),zone:activeZone,ready:true,roomMeshes:meshes.length,catStatic:true}),select:selectZone,reset};
}catch(error){loading.textContent='场景没能打开，请刷新重试。';console.error(error);}

function updateCamera(){cameraControls.update();}
let pending=false;
const cameraControls=createPetCamera(T,{camera,view,position:initialPosition,target,scale:layout.camera.scale,getCat:()=>petRoot,draw,onTap:tapFurniture,controlsHost:document.getElementById('scene-camera')});
function draw(){if(pending||document.hidden)return;pending=true;requestAnimationFrame(()=>{pending=false;updateCamera();renderer.render(scene,camera);});}
function resize(){renderer.setSize(innerWidth,innerHeight);draw();}window.addEventListener('resize',resize);
let evening=false,activeZone='';
document.getElementById('light').onclick=()=>{
  evening=!evening;hemi.color.set(evening?'#d4dcf3':'#fff1dc');hemi.intensity=evening?1.1:2.35;
  key.color.set(evening?'#b8cbff':'#fff1da');key.intensity=evening?.65:3.0;
  fill.color.set(evening?'#ffdab6':'#fff8eb');fill.intensity=evening?.65:1.2;lamp.intensity=evening?10:0;
  const button=document.getElementById('light');button.textContent=evening?'白天':'傍晚';button.setAttribute('aria-pressed',String(evening));button.setAttribute('aria-label',evening?'切换到白天':'切换到傍晚');draw();
};
function selectZone(key){const zone=layout.zones[key];if(!zone)return;activeZone=key;document.getElementById('zone-title').textContent=zone.title;document.getElementById('zone-text').textContent=zone.text;draw();}
function reset(){cameraControls.reset();activeZone='';document.getElementById('zone-title').textContent=layout.title;document.getElementById('zone-text').textContent='点点家具看看 · 双指或滚轮缩放';draw();}
document.getElementById('reset').onclick=reset;
const ray=new T.Raycaster(),pointer=new T.Vector2();
function tapFurniture(e){
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
  for(const hit of ray.intersectObjects(meshes,false)){let o=hit.object;while(o&&!o.userData.zone)o=o.parent;if(o&&layout.zones[o.userData.zone]){selectZone(o.userData.zone);break;}}
}
document.addEventListener('visibilitychange',()=>{cameraControls.clearGesture();if(!document.hidden)draw();});
resize();draw();
