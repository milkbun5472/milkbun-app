import {createCarriageView} from './view.mjs?v=fg-ad67a71aa7b8be0b';
import {createWindowScenery,ROUTES,WEATHERS,SEASONS} from './scenery.mjs?v=fg-ad67a71aa7b8be0b';
const host=document.querySelector('#stage'), status=document.querySelector('#status');
const view=await createCarriageView(host,{onZoom:v=>document.querySelector('#zoom').value=v});
const {scene,camera,renderer,asset,scenery,setView,setShell,setZoom,render}=view;
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};
document.querySelector('#shell').onchange=e=>setShell(e.target.checked);
document.querySelector('#zoom').oninput=e=>setZoom(Number(e.target.value));
function syncEnvironment(){
 view.syncLighting();
 const h=scenery.state.hour,mins=Math.floor(h*60);document.querySelector('#clock').value=`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
 document.querySelector('#hour').value=h;document.querySelector('#route').value=scenery.state.route;document.querySelector('#season').value=scenery.state.season;document.querySelector('#weather').value=scenery.state.weather;document.querySelector('#auto-time').checked=scenery.state.autoTime;
 const b=document.querySelector('#play');b.textContent=scenery.state.playing?'暂停窗景':'继续前行';b.setAttribute('aria-pressed',String(scenery.state.playing));
 document.querySelector('#speed').value=scenery.state.speed;document.querySelector('#speed-label').value=`${scenery.state.speed.toFixed(1)} 倍`;const passing=document.querySelector('#passing'),passingText=scenery.journey.label+(scenery.destination.speedFactor<.95?' · 观景慢行':'');if(passing.textContent!==passingText)passing.textContent=passingText;
 document.querySelector('#journey-label').textContent=`${ROUTES[scenery.state.route]} · ${SEASONS[scenery.state.season]} · ${WEATHERS[scenery.state.weather]}`;
}
function setEnvironment(patch){scenery.set(patch);syncEnvironment();render();}
for(const key of ['route','weather','season'])document.querySelector('#'+key).onchange=e=>setEnvironment({[key]:e.target.value});
function visitDestination(id){const route=id==='lake'?'forest':'coast',start=id==='lake'?91:21,duration=id==='lake'?16:13;scenery.set({route});scenery.seekJourney(start+duration*(scenery.state.playing ? .12 : .5));syncEnvironment();render();}
for(const b of document.querySelectorAll('[data-destination]'))b.onclick=()=>visitDestination(b.dataset.destination);
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
const requestedDestination=new URLSearchParams(location.search).get('destination');if(['lake','town'].includes(requestedDestination))visitDestination(requestedDestination);
status.textContent='点「看窗外」靠近车窗 · 可切换风景、天气与时间';
window.carriageReview={...view,visitDestination,setEnvironment,get currentView(){return view.currentView;}};
