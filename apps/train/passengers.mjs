import {restState} from './rest.mjs?v=fg-7542b1b1703af212';
import {DRACOLoader} from '../fairy-garden/vendor/DRACOLoader.js?v=fg-7542b1b1703af212';
import * as T from 'three';
import {GLTFLoader} from '../fairy-garden/vendor/GLTFLoader.js?v=fg-7542b1b1703af212';
import {createTraveler} from '../fairy-garden/traveler.mjs?v=fg-7542b1b1703af212';
import {bubbleRows,bubbleHold,BUBBLE_GAP} from '../fairy-garden/speech.mjs?v=fg-7542b1b1703af212';
export async function createPassengers(view,host,stage,state=()=>({})){
 const archive=host.load(),journey=archive.journey||{},garden=archive.worlds?.garden||archive.world,companion=host.companion?.();
 const draco=new DRACOLoader();draco.setDecoderPath(new URL('../fairy-garden/vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);let source;try{source=(await loader.loadAsync(new URL('../fairy-garden/doll.glb?v=fg-7542b1b1703af212',import.meta.url).href)).scene;}finally{draco.dispose();}
 const people=[];
 for(const [who,anchorName,look,name,angle] of [['me','seat_user',journey.look||garden?.look,'你',Math.PI/2],['companion','seat_companion',journey.companionLook||garden?.companion?.look,companion?.name,-Math.PI/2]]){
  if(who==='companion'&&!companion?.id)continue;
  let anchor;view.asset.traverse(o=>{if(o.userData.anchor===anchorName)anchor=o;});if(!anchor)throw Error('座位还没有准备好');
  const at=anchor.getWorldPosition(new T.Vector3()),avatar=createTraveler(source,who==='companion',look||{});avatar.root.position.copy(at);avatar.root.rotation.y=angle;const carrier=new T.Group();view.scene.add(carrier);carrier.add(avatar.root);let bedAnchor;view.asset.traverse(o=>{if(o.userData.anchor===(who==='me'?'berth_lower':'berth_upper'))bedAnchor=o;});if(!bedAnchor)throw Error('卧铺还没有准备好');const bed=bedAnchor.getWorldPosition(new T.Vector3());avatar.root.updateMatrixWorld(true);const face=avatar.root.getObjectByName('Face'),headPoint=new T.Vector3(0,1.48,0);if(face){const bounds=new T.Box3().setFromObject(face,true),top=bounds.getCenter(new T.Vector3());top.y=bounds.max.y+.09;headPoint.copy(avatar.root.worldToLocal(top));}
  const bubble=document.createElement('div');bubble.id=who==='me'?'player-bubble':'companion-bubble';bubble.hidden=true;bubble.setAttribute('aria-live','polite');stage.append(bubble);
  const tag=document.createElement('span');tag.className='train-passenger-name';tag.textContent=name;stage.append(tag);
  people.push({who,avatar,carrier,bed,angle,face,resting:false,bubble,tag,seat:at,headPoint,queue:[],line:null,left:0});
 }
 view.renderer.shadowMap.needsUpdate=true;
 function speak(lines,who='companion'){const p=people.find(p=>p.who===who);if(p)p.queue=[...p.queue,...bubbleRows(lines)].slice(0,12);}
 function tick(now,dt,visible){
  for(const p of people){const resting=restState(state())[p.who==='me'?'you':'companion'];if(resting!==p.resting){p.resting=resting;view.renderer.shadowMap.needsUpdate=true;}
   if(resting){p.carrier.position.set(p.bed.x+.90,p.bed.y+.12,p.bed.z);p.carrier.rotation.y=Math.PI/2;p.avatar.root.position.set(0,0,0);p.avatar.animate(now/1000,{sleepPose:{x:0,z:0,y:0}});}
   else{p.carrier.position.set(0,0,0);p.carrier.rotation.y=0;p.avatar.root.position.copy(p.seat);p.avatar.root.rotation.y=p.angle;p.avatar.animate(now/1000,{seated:true,gesture:'sit',height:p.seat.y-.215});}
   p.carrier.updateMatrixWorld(true);
   const head=p.face?new T.Box3().setFromObject(p.face,true).getCenter(new T.Vector3()):p.avatar.root.localToWorld(p.headPoint.clone());head.y+=.14;head.project(view.camera);const rect=stage.getBoundingClientRect();
   const onscreen=visible&&head.z>=-1&&head.z<=1&&head.x>-1&&head.x<1&&head.y>-1&&head.y<1;
   p.tag.hidden=!onscreen;p.bubble.hidden=!onscreen||!p.line;
   if(!onscreen)continue;
   if(p.line){p.left-=dt*1000;if(p.left<=0)p.line=null;}
   if(!p.line&&p.queue.length){p.line=p.queue.shift();p.left=bubbleHold(p.line.show)+BUBBLE_GAP;p.bubble.textContent=p.line.show;}
   const x=(head.x+1)*rect.width/2,y=(1-head.y)*rect.height/2;
   p.tag.style.left=x+'px';p.tag.style.top=y+'px';p.bubble.hidden=!p.line||p.left<BUBBLE_GAP;
   if(!p.bubble.hidden){const half=p.bubble.offsetWidth/2+6;p.bubble.style.left=Math.max(half,Math.min(rect.width-half,x))+'px';p.bubble.style.top=Math.max(p.bubble.offsetHeight+8,Math.min(rect.height-24,y-10))+'px';}
  }
 }
 return {speak,tick,get people(){return people;},dispose(){for(const p of people){p.bubble.remove();p.tag.remove();}people.length=0;}};
}
