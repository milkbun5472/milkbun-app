import {createTraveler,loadTravelerSource} from '../fairy-garden/traveler.mjs?v=fg-ad36803fee25eb2f';
import {seatLook} from '../fairy-garden/wardrobe.mjs?v=fg-ad36803fee25eb2f';
import {createHomeNavigation,HOME_PLACES} from './home-navigation.mjs?v=fg-ad36803fee25eb2f';
import {turnPet} from './movement.mjs?v=fg-ad36803fee25eb2f';
// No model calls here: these are visible, local acts in this archive.
export async function createHousemate({scene,host,care,home,notice,save,getPets=()=>[],getActiveId=()=>null}){
 const person=host.companion?.();if(!person?.id)return null;
 const archive=host.load(),garden=archive.worlds?.garden||archive.world;
 const look=seatLook('companion',archive.journey?.companionLook||garden?.companion?.look,person.ta);
 const doll=createTraveler(await loadTravelerSource(),true,look);await doll.ready();scene.add(doll.root);doll.root.scale.setScalar(1.2);doll.root.visible=false;
 const nav=createHomeNavigation(1.4);let route=[],clock=0,idle=0,visible=false,job=null;
 const members=()=>getPets().length?getPets():[{entry:{id:'pet-1'},care,home}];
 const choose=id=>{const selected=members().find(x=>x.entry.id===id)||members().find(x=>x.entry.id===getActiveId())||members()[0];care=selected.care;home=selected.home;return selected.entry.id;};
 const pos=()=>({x:doll.root.position.x,z:doll.root.position.z});
 function begin(){visible=true;doll.root.visible=true;const resume=members().find(x=>String(x.care.state.helper?.id)===String(person.id));choose(resume?.entry.id);const old=care.state.helper;job=old&&String(old.id)===String(person.id)?old:null;care.state.helper=job;const p=nav.restore(job?.position||{x:-1.15,z:1.35});doll.root.position.set(p.x,.08,p.z);route=[];if(job?.phase==='walking')plan();}
 function target(action){const bowl=home.snapshot().station?.bowl;return action==='feed'?(bowl?{x:bowl.x,z:bowl.z+.25}:{x:1.55,z:1.75}):action==='play'?{x:-.85,z:1.35}:{x:-.65,z:.55};}
 function plan(){route=nav.path(pos(),target(job.action))||[];if(!route.length){care.record(person.name+'暂时走不过去，没能照料它。');job=null;care.state.helper=null;save();}}
 function request(action,{responsive=false,petId=getActiveId()}={}){if(!visible)return {accepted:false,text:'先一起回家，再照料它。'};if(!['feed','play','pet','snack'].includes(action))return {accepted:false,text:'这个动作暂时做不到。'};if(job)return {accepted:false,text:person.name+'正在照料它，等一会儿。'};if(petId&&!members().some(x=>x.entry.id===petId))return {accepted:false,text:'这一只已经不在当前存档里了。'};const selectedId=choose(petId);job={petId:selectedId,id:String(person.id),name:person.name,action,phase:responsive&&action!=='feed'?'doing':'walking',time:0,position:pos(),responsive};care.state.helper=job;if(job.phase==='walking')plan();if(!job)return {accepted:false,text:'暂时走不过去。'};save();return {accepted:true,text:person.name+'准备走过去'+({feed:'添粮',play:'陪玩',pet:'摸摸它',snack:'给一小口零食'})[action]+'，等它回应。'};}
 function tick(dt){if(!visible)return;clock+=dt;idle+=dt;let moving=false;
  const pending=members().filter(x=>{const v=x.care.state.task;return v?.source==='self'&&v.target==='companion:'+person.id&&v.phase==='doing'&&v.time>=2&&['waiting','cuddle'].includes(v.stage);}).sort((a,b)=>b.care.state.task.time-a.care.state.task.time)[0];if(!job&&pending)choose(pending.entry.id);const visit=care.state.task;if(!job&&visit?.source==='self'&&visit.target==='companion:'+person.id&&visit.phase==='doing'&&visit.time>=2&&['waiting','cuddle'].includes(visit.stage)){const action=({waitFood:'feed',invitePlay:'play',invitePet:'pet',askSnack:'snack'})[visit.kind];if(action)request(action,{responsive:true,petId:pending?.entry.id});}
  if(job){if(job.phase==='walking'){
   const dest=route[0];if(dest){const p=pos(),dx=dest.x-p.x,dz=dest.z-p.z,d=Math.hypot(dx,dz),turn=turnPet(doll.root.rotation.y,Math.atan2(dx,dz),dt);doll.root.rotation.y=turn.heading;const step=turn.canMove?Math.min(d,dt*.8):0;moving=step>0;if(d>1e-5){doll.root.position.x+=dx/d*step;doll.root.position.z+=dz/d*step;}if(d<=step+.002)route.shift();}
   if(!route.length){job.phase='doing';job.time=0;save();}
  }else{job.time+=dt;const t=care.state.task;const to=job.action==='feed'?(home.snapshot().station?.bowl||HOME_PLACES.feeding):{x:care.state.position?.x||0,z:care.state.position?.z||.55};doll.root.rotation.y=turnPet(doll.root.rotation.y,Math.atan2(to.x-doll.root.position.x,to.z-doll.root.position.z),dt).heading;
   if(job.time>=1&&!job.started){const result=home.request(job.action,{source:'companion',actor:String(person.id),name:person.name,nearPerson:job.responsive});job.started=true;notice(person.name+'与它',result.text);if(!result.accepted){care.record(person.name+'这次没能'+({feed:'添粮',play:'陪玩',pet:'摸摸它',snack:'给一小口零食'})[job.action]+'：'+result.text);job=null;care.state.helper=null;save();}else if(!care.state.task){job=null;care.state.helper=null;save();}}
   else if(job.started&&(!t||t.source!=='companion'||String(t.actor)!==String(person.id))){job=null;care.state.helper=null;idle=0;save();}
  }
  if(job)job.position=pos();
  }else if(idle>=50){idle=0;const candidate=members().filter(x=>!x.care.state.task||x.care.state.task.source==='self'&&x.care.state.task.kind==='watch').sort((a,b)=>a.care.state.satiety-b.care.state.satiety)[0];if(candidate)choose(candidate.entry.id);const s=care.state;if(!s.task||s.task.source==='self'&&s.task.kind==='watch'){if(s.satiety<50&&s.bowl<25)request('feed',{petId:candidate?.entry.id});else if(Math.hypot((s.position?.x||0)-doll.root.position.x,(s.position?.z||0)-doll.root.position.z)<1.8&&s.cooldown<=0)request(s.energy>55&&s.mood<78?'play':'pet',{petId:candidate?.entry.id});}}
  doll.animate(clock,{moving,gesture:job?.phase==='doing'?(job.action==='play'?'stir':'hold'):'rest',seated:job?.phase==='doing'&&job.action==='pet'||visit?.kind==='sleep'&&visit.place==='person'&&visit.target==='companion:'+person.id&&visit.phase==='doing',height:.08});
 }
 function leave(){visible=false;doll.root.visible=false;route=[];if(job)care.record(person.name+'跟着出门了，这次照料先停下。');job=null;for(const p of members())p.care.state.helper=null;}
 return {begin,tick,request,leave,doll,person,snapshot:()=>({visible,position:pos(),job:job?{...job}:null,look})};
}
