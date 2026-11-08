import {projectShop} from './state.mjs?v=fg-9983713c37f606aa';
import {createPostOfficeView} from './view.mjs?v=fg-9983713c37f606aa';
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
function dispose(){if(closed)return;closed=true;clearInterval(timer);cancelAnimationFrame(frame);host?.pauseSound?.(true);view?.dispose();}
if(!host)status.textContent='请从秋秋机的小世界进入邮局小店。';
else{
 try{view=createPostOfficeView(document.getElementById('stage'),{name:host.name,counter:()=>host.counter?.(),thumbnail:ref=>host.thumbnail(ref),select:target=>host.select?.(target),monthly:host.read().shopRules.SHOP.MONTHLY,onMeetEnd:(id,key)=>host.meetSeen?.({id,key}),onEvent:event=>host.sound?.(event)});
  window.PostOfficeGame={refresh,startClosing:async(storyId=null,local=false)=>{if(closing)return false;closing=true;view.pause(false);try{const {shop,...options}=host.read(),next=projectShop(shop,{...options,lookFor:c=>c.look}),story=local?{lines:[],staff:view.snapshot().projection?.staff||[]}:storyId?next.stories.find(s=>s.key===storyId):next.closing;if(!story)throw Error('这晚的留底暂时没读到。');return await view.startClosing(story);}finally{const {shop,...options}=host.read();await view.finishClosing(projectShop(shop,{...options,lookFor:c=>c.look}));closing=false;key='';await refresh();}},playMeet:id=>view.playMeet(id),draw:()=>view.render(),step:dt=>{view.tick((performance.now()/1000)+dt,dt);},project:(x,y,z)=>view.project(x,y,z),pause:value=>{paused=!!value;view.pause(paused||failed);host.pauseSound?.(paused||failed||document.hidden);if(!paused)refresh();},resetView:()=>view.resetView(),snapshot:()=>({...view.snapshot(),performing:closing,paused,sound:host.audioState?.()||null}),projectCounter:()=>view.projectCounter(),dispose,get ready(){return !!key&&!closed;},get disposed(){return closed;}};
  await refresh();if(!closed){timer=setInterval(()=>{if(!paused&&!document.hidden)refresh();},2000);frame=requestAnimationFrame(animate);}
 }catch(e){status.textContent='画面暂时没能打开，可返回后再试。';host.error?.(e.message);dispose();}
}
window.addEventListener('pagehide',dispose);
window.addEventListener('visibilitychange',()=>{host?.pauseSound?.(document.hidden||paused||failed);if(!document.hidden&&!paused)refresh();});
window.addEventListener('pointerdown',()=>host?.unlockSound?.(),{capture:true});
