import {projectShop} from './state.mjs?v=fg-b149ac3dbf94ecd5';
import {createPostOfficeView} from './view.mjs?v=fg-b149ac3dbf94ecd5';
const host=parent!==window?parent.FairyGardenHostFor?.(window):null,status=document.getElementById('status');
let view=null,closed=false,paused=false,frame=0,timer=null,key='',pending=false,closing=false,failed=false,lastRender=0;
async function refresh(){
 if(closed||!host||pending||closing)return;pending=true;
 try{await host.sync?.();const data=host.read(),{shop,...options}=data,next=projectShop(shop,{...options,lookFor:c=>c.look});const k=JSON.stringify(next);
  if(k!==key){if(!key){const previous=host.previous?.();if(previous?.projection){await view.sync(previous.projection);view.resume(previous.flow);}}await view.sync(next);if(closed)return;key=k;}
  failed=false;view.pause(paused);status.textContent='';host.ready?.();
 }catch(e){failed=true;view?.pause(true);if(!closed){status.textContent='画面暂时没能打开，可返回后再试。';host.error?.(e.message);}}
 finally{pending=false;}
}
function animate(now){if(closed)return;if(!paused&&!failed&&!document.hidden&&now-lastRender>32){lastRender=now;view?.tick(now/1000);view?.render();}frame=requestAnimationFrame(animate);}
function dispose(){if(closed)return;closed=true;clearInterval(timer);cancelAnimationFrame(frame);view?.dispose();}
if(!host)status.textContent='请从秋秋机的小世界进入邮局小店。';
else{
 try{view=createPostOfficeView(document.getElementById('stage'),{name:host.name,counter:()=>host.counter?.(),thumbnail:ref=>host.thumbnail(ref),select:target=>host.select?.(target),monthly:host.read().shopRules.SHOP.MONTHLY,onMeetEnd:(id,key)=>host.meetSeen?.({id,key})});
  window.PostOfficeGame={refresh,startClosing:async()=>{closing=true;try{return await view.startClosing();}finally{view.finishClosing();closing=false;await refresh();}},playMeet:id=>view.playMeet(id),draw:()=>view.render(),step:dt=>{view.tick((performance.now()/1000)+dt,dt);},project:(x,y,z)=>view.project(x,y,z),pause:value=>{paused=!!value;view.pause(paused||failed);if(!paused)refresh();},resetView:()=>view.resetView(),snapshot:()=>view.snapshot(),projectCounter:()=>view.projectCounter(),dispose,get ready(){return !!key&&!closed;},get disposed(){return closed;}};
  await refresh();if(!closed){timer=setInterval(()=>{if(!paused&&!document.hidden)refresh();},2000);frame=requestAnimationFrame(animate);}
 }catch(e){status.textContent='画面暂时没能打开，可返回后再试。';host.error?.(e.message);dispose();}
}
window.addEventListener('pagehide',dispose);
window.addEventListener('visibilitychange',()=>{if(!document.hidden&&!paused)refresh();});
