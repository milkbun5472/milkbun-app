import * as T from 'three';
import {GLTFLoader} from '../../apps/fairy-garden/vendor/GLTFLoader.js?v=fg-b828a8ebe37a7c5e';
import {createWindowScenery} from './scenery.mjs?v=fg-b828a8ebe37a7c5e';
export async function createCarriageView(host,{onZoom=()=>{},immersive=false}={}){
const scene=new T.Scene();
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(34,1,.05,100);
const hemi=new T.HemisphereLight(0xfff7e5,0x766652,2.6);scene.add(hemi);
const sun=new T.DirectionalLight(0xffefcf,3.4);sun.position.set(-3,8,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:24});sun.shadow.normalBias=.025;scene.add(sun);
const rim=new T.DirectionalLight(0xddeeff,1.7);rim.position.set(2,4,-5);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.35;floor.receiveShadow=true;scene.add(floor);
const scenery=createWindowScenery(scene);
const lamps=[];
for(const y of [1.14,2.16]){const l=new T.PointLight(0xffba64,0,3,2);l.position.set(-2.89,y,-1.05);scene.add(l);lamps.push(l);}
const tableLamp=new T.PointLight(0xffc788,0,5,2);tableLamp.position.set(1.27,2.50,.15);scene.add(tableLamp);lamps.push(tableLamp);
let az=.56,el=.55,radius=12.0,zoom=1,asset,currentView='overview',photoView=null;
const photoShell=new Map(),photoBackdrop=new T.Color('#e8e6d7');
const photoCamera=new T.PerspectiveCamera(34,1.5,.05,100);
const photoPresets={companion:{aim:[2.53,1.35,-.32],az:-.8,el:.16,radius:3.5},together:{aim:[1.27,1.25,-.32],az:0,el:.16,radius:5.2}};
const aim=new T.Vector3(0,1.1,0);
const presets={overview:{aim:[0,1.1,0],az:.56,el:.55,radius:12.0},table:{aim:[1.27,1.22,-.36],az:.5,el:.45,radius:5.7},berths:{aim:[-1.92,1.4,-.6],az:.35,el:.30,radius:5.8},top:{aim:[0,.7,0],az:0,el:1.47,radius:10.8},window:{aim:[1.19,1.60,-1.40],az:0,el:.035,radius:4.6}};
function render(){if(photoView){const p=photoPresets[photoView],a=new T.Vector3(...p.aim);photoCamera.position.set(a.x+p.radius*Math.sin(p.az)*Math.cos(p.el),a.y+p.radius*Math.sin(p.el),a.z+p.radius*Math.cos(p.az)*Math.cos(p.el));photoCamera.lookAt(a);const background=scene.background;scene.background=photoBackdrop;renderer.render(scene,photoCamera);scene.background=background;return;}const r=radius*zoom*(camera.aspect<1?(immersive?.9:1.20)/Math.max(camera.aspect,.35):1);camera.position.set(aim.x+r*Math.sin(az)*Math.cos(el),aim.y+r*Math.sin(el),aim.z+r*Math.cos(az)*Math.cos(el));camera.lookAt(aim);renderer.render(scene,camera);}
function resize(){if(photoView){renderer.setSize(1200,800,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';render();return;}const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
const observer=new ResizeObserver(resize);observer.observe(host);
function setView(name){currentView=name;const p=presets[name];aim.fromArray(p.aim);({az,el,radius}=p);zoom=1;onZoom(1);render();}
function setShell(closed){renderer.shadowMap.needsUpdate=true;asset?.traverse(o=>{if(['Roof','ShellFront','ShellEnd'].includes(o.userData.carriageGroup))o.visible=closed;});render();}

function setPhotoView(mode){for(const [o,visible] of photoShell)o.visible=visible;photoShell.clear();if(photoPresets[mode])asset?.traverse(o=>{if(o.userData.carriageGroup==='ShellEnd'){photoShell.set(o,o.visible);o.visible=true;}});renderer.shadowMap.needsUpdate=true;photoView=photoPresets[mode]?mode:null;renderer.setPixelRatio(photoView?1:Math.min(devicePixelRatio,2));resize();}

function setZoom(v){zoom=T.MathUtils.clamp(v,.7,1.6);onZoom(zoom);render();}

const pointers=new Map();let lastDistance=0;
renderer.domElement.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);lastDistance=0;});
renderer.domElement.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;const next={x:e.clientX,y:e.clientY};if(pointers.size===1){az-=(next.x-p.x)*.007;el=T.MathUtils.clamp(el+(next.y-p.y)*.006,.06,1.5);}pointers.set(e.pointerId,next);if(pointers.size===2){const[a,b]=[...pointers.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance&&dist)setZoom(zoom*lastDistance/dist);lastDistance=dist;}render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{pointers.delete(e.pointerId);lastDistance=0;});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom+e.deltaY*.001);},{passive:false});
const gltf=await new GLTFLoader().loadAsync(new URL('./carriage.glb?v=fg-b828a8ebe37a7c5e',import.meta.url).href);asset=gltf.scene;
 asset.traverse(o=>{if(o.isMesh){o.castShadow=o.userData.carriageGroup!=='WindowGlass';o.receiveShadow=true;if(o.userData.carriageGroup==='WindowGlass'){o.material.transparent=true;o.material.opacity=.10;o.material.depthWrite=false;}}});
 scene.add(asset);setShell(false);resize();setView('window');
 function syncLighting(){const light=scenery.lighting();hemi.intensity=light.ambient;sun.intensity=light.sun;sun.color.set(light.color);rim.intensity=.3+light.daylight*1.4;lamps.forEach(l=>l.intensity=light.lamps);}
 function dispose(){observer.disconnect();scenery.dispose();const gs=new Set(),ms=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();});textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 return {scene,camera,renderer,asset,scenery,setView,setShell,setZoom,setPhotoView,render,syncLighting,dispose,get currentView(){return currentView;}};
}
