import * as T from 'three';
import { GLTFLoader } from '../../apps/fairy-garden/vendor/GLTFLoader.js';
const host=document.querySelector('#stage'), status=document.querySelector('#status');
const scene=new T.Scene();
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(34,1,.05,100);
const hemi=new T.HemisphereLight(0xfff7e5,0x766652,2.6);scene.add(hemi);
const sun=new T.DirectionalLight(0xffefcf,3.4);sun.position.set(-3,8,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:24});sun.shadow.normalBias=.025;scene.add(sun);
const rim=new T.DirectionalLight(0xddeeff,1.7);rim.position.set(2,4,-5);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.35;floor.receiveShadow=true;scene.add(floor);
const lamps=[];
for(const y of [1.14,2.16]){const l=new T.PointLight(0xffba64,0,3,2);l.position.set(-2.89,y,-1.05);scene.add(l);lamps.push(l);}
let az=.56,el=.55,radius=12.0,zoom=1,asset,currentView='overview';
const aim=new T.Vector3(0,1.1,0);
const presets={overview:{aim:[0,1.1,0],az:.56,el:.55,radius:12.0},table:{aim:[1.27,1.22,-.36],az:.5,el:.45,radius:5.7},berths:{aim:[-1.92,1.4,-.6],az:.35,el:.30,radius:5.8},top:{aim:[0,.7,0],az:0,el:1.47,radius:10.8}};
function render(){const r=radius*zoom*(camera.aspect<1?1.20/Math.max(camera.aspect,.35):1);camera.position.set(aim.x+r*Math.sin(az)*Math.cos(el),aim.y+r*Math.sin(el),aim.z+r*Math.cos(az)*Math.cos(el));camera.lookAt(aim);renderer.render(scene,camera);}
function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
new ResizeObserver(resize).observe(host);
function setView(name){currentView=name;const p=presets[name];aim.fromArray(p.aim);({az,el,radius}=p);zoom=1;document.querySelector('#zoom').value=1;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));render();}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
function setShell(closed){asset?.traverse(o=>{if(['Roof','ShellFront','ShellEnd'].includes(o.userData.carriageGroup))o.visible=closed;});render();}
document.querySelector('#shell').onchange=e=>setShell(e.target.checked);
document.querySelector('#night').onchange=e=>{const n=e.target.checked;hemi.intensity=n?.75:2.6;sun.intensity=n?.65:3.4;rim.intensity=n?.25:1.7;lamps.forEach(l=>l.intensity=n?6:0);render();};
function setZoom(v){zoom=T.MathUtils.clamp(v,.7,1.6);document.querySelector('#zoom').value=zoom;render();}
document.querySelector('#zoom').oninput=e=>setZoom(Number(e.target.value));
const pointers=new Map();let lastDistance=0;
renderer.domElement.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);lastDistance=0;});
renderer.domElement.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;const next={x:e.clientX,y:e.clientY};if(pointers.size===1){az-=(next.x-p.x)*.007;el=T.MathUtils.clamp(el+(next.y-p.y)*.006,.06,1.5);}pointers.set(e.pointerId,next);if(pointers.size===2){const[a,b]=[...pointers.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance&&dist)setZoom(zoom*lastDistance/dist);lastDistance=dist;}render();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{pointers.delete(e.pointerId);lastDistance=0;});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom+e.deltaY*.001);},{passive:false});
try{
 const gltf=await new GLTFLoader().loadAsync('./carriage.glb?v=1');asset=gltf.scene;
 asset.traverse(o=>{if(o.isMesh){o.castShadow=o.userData.carriageGroup!=='WindowGlass';o.receiveShadow=true;if(o.userData.carriageGroup==='WindowGlass'){o.material.transparent=true;o.material.opacity=.10;o.material.depthWrite=false;}}});
 scene.add(asset);setShell(false);resize();status.textContent='拖动看看里面 · 桌面已留空，方便之后拼图';
 window.carriageReview={scene,camera,renderer,asset,setView,setShell,render,get currentView(){return currentView;}};
}catch(e){status.textContent='模型加载失败：'+e.message;status.classList.add('error');console.error(e);}
