import * as T from 'three';
import {createWindowScenery,ROUTES,WEATHERS,SEASONS} from './scenery.mjs?v=4f58b3edf25a';
import { GLTFLoader } from '../../apps/fairy-garden/vendor/GLTFLoader.js';
const host=document.querySelector('#stage'), status=document.querySelector('#status');
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
let az=.56,el=.55,radius=12.0,zoom=1,asset,currentView='overview';
const aim=new T.Vector3(0,1.1,0);
const presets={overview:{aim:[0,1.1,0],az:.56,el:.55,radius:12.0},table:{aim:[1.27,1.22,-.36],az:.5,el:.45,radius:5.7},berths:{aim:[-1.92,1.4,-.6],az:.35,el:.30,radius:5.8},top:{aim:[0,.7,0],az:0,el:1.47,radius:10.8},window:{aim:[1.19,1.60,-1.40],az:0,el:.035,radius:4.6}};
function render(){const r=radius*zoom*(camera.aspect<1?1.20/Math.max(camera.aspect,.35):1);camera.position.set(aim.x+r*Math.sin(az)*Math.cos(el),aim.y+r*Math.sin(el),aim.z+r*Math.cos(az)*Math.cos(el));camera.lookAt(aim);renderer.render(scene,camera);}
function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
new ResizeObserver(resize).observe(host);
function setView(name){currentView=name;const p=presets[name];aim.fromArray(p.aim);({az,el,radius}=p);zoom=1;document.querySelector('#zoom').value=1;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));render();}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
function setShell(closed){renderer.shadowMap.needsUpdate=true;asset?.traverse(o=>{if(['Roof','ShellFront','ShellEnd'].includes(o.userData.carriageGroup))o.visible=closed;});render();}
document.querySelector('#shell').onchange=e=>setShell(e.target.checked);
function syncEnvironment(){
 const light=scenery.lighting();hemi.intensity=light.ambient;sun.intensity=light.sun;sun.color.set(light.color);rim.intensity=.3+light.daylight*1.4;lamps.forEach(l=>l.intensity=light.lamps);
 const h=scenery.state.hour,mins=Math.floor(h*60);document.querySelector('#clock').value=`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
 document.querySelector('#hour').value=h;document.querySelector('#route').value=scenery.state.route;document.querySelector('#season').value=scenery.state.season;document.querySelector('#weather').value=scenery.state.weather;document.querySelector('#auto-time').checked=scenery.state.autoTime;
 const b=document.querySelector('#play');b.textContent=scenery.state.playing?'暂停窗景':'继续前行';b.setAttribute('aria-pressed',String(scenery.state.playing));
 document.querySelector('#speed').value=scenery.state.speed;document.querySelector('#speed-label').value=`${scenery.state.speed.toFixed(1)} 倍`;const passing=document.querySelector('#passing');if(passing.textContent!==scenery.journey.label)passing.textContent=scenery.journey.label;
 document.querySelector('#journey-label').textContent=`${ROUTES[scenery.state.route]} · ${SEASONS[scenery.state.season]} · ${WEATHERS[scenery.state.weather]}`;
}
function setEnvironment(patch){scenery.set(patch);syncEnvironment();render();}
for(const key of ['route','weather','season'])document.querySelector('#'+key).onchange=e=>setEnvironment({[key]:e.target.value});
document.querySelector('#speed').oninput=e=>setEnvironment({speed:Number(e.target.value)});
document.querySelector('#next-stop').onclick=()=>{scenery.nextStop();syncEnvironment();render();};
document.querySelector('#hour').oninput=e=>setEnvironment({hour:Number(e.target.value)});
document.querySelector('#auto-time').onchange=e=>setEnvironment({autoTime:e.target.checked});
document.querySelector('#play').onclick=()=>setEnvironment({playing:!scenery.state.playing});
syncEnvironment();
let frameId,lastFrame=0;
const frameInterval=1000/30;
function animate(now){
 frameId=requestAnimationFrame(animate);
 if(document.hidden){lastFrame=now;return;}
 if(now-lastFrame<frameInterval)return;
 const dt=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
 if(scenery.step(dt)){syncEnvironment();render();}
}
frameId=requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{lastFrame=0;});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);});
window.addEventListener('pageshow',e=>{if(e.persisted){lastFrame=0;frameId=requestAnimationFrame(animate);}});
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
 scene.add(asset);setShell(false);resize();setView('window');status.textContent='点「看窗外」靠近车窗 · 可切换风景、天气与时间';
 window.carriageReview={scene,camera,renderer,asset,scenery,setEnvironment,setView,setShell,render,get currentView(){return currentView;}};
}catch(e){status.textContent='模型加载失败：'+e.message;status.classList.add('error');console.error(e);}
