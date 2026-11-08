import {projectShop} from './state.mjs?v=fg-7d8490d3228b9b43';
import {createPostOfficeView} from './view.mjs?v=fg-7d8490d3228b9b43';
const host=parent!==window?parent.FairyGardenHostFor?.(window):null,status=document.getElementById('status');
let view=null,closed=false,paused=false,frame=0,timer=null,key='',pending=false;
async function refresh(){
 if(closed||!host||pending)return;pending=true;
 try{const data=host.read(),{shop,...options}=data,next=projectShop(shop,{...options,lookFor:c=>c.look});const k=JSON.stringify(next);
  if(k!==key){await view.sync(next);if(closed)return;key=k;}
  status.textContent='';host.ready?.();
 }catch(e){if(!closed){status.textContent='画面暂时没能打开，可返回后再试。';host.error?.(e.message);}}
 finally{pending=false;}
}
function animate(now){if(closed)return;if(!paused&&!document.hidden){view?.tick(now/1000);view?.render();}frame=requestAnimationFrame(animate);}
function dispose(){if(closed)return;closed=true;clearInterval(timer);cancelAnimationFrame(frame);view?.dispose();}
if(!host)status.textContent='请从秋秋机的小世界进入邮局小店。';
else{
 try{view=createPostOfficeView(document.getElementById('stage'),{name:host.name,counter:()=>host.counter?.(),thumbnail:ref=>host.thumbnail(ref)});
  window.PostOfficeGame={refresh,pause:value=>{paused=!!value;view.pause(paused);if(!paused)refresh();},resetView:()=>view.resetView(),snapshot:()=>view.snapshot(),projectCounter:()=>view.projectCounter(),dispose,get ready(){return !!key&&!closed;},get disposed(){return closed;}};
  await refresh();if(!closed){timer=setInterval(()=>{if(!paused&&!document.hidden)refresh();},2000);frame=requestAnimationFrame(animate);}
 }catch(e){status.textContent='画面暂时没能打开，可返回后再试。';host.error?.(e.message);dispose();}
}
window.addEventListener('pagehide',dispose);
window.addEventListener('visibilitychange',()=>{if(!document.hidden&&!paused)refresh();});
