import {createPetToy} from './toy-prop.mjs?v=fg-bfba5822c8e6d500';
import {idlePose} from './autonomy.mjs?v=fg-bfba5822c8e6d500';
import {createTraveler,loadTravelerSource} from '../fairy-garden/traveler.mjs?v=fg-bfba5822c8e6d500';
import {NEIGHBORS} from './neighborhood.mjs?v=fg-bfba5822c8e6d500';
import {createParcelProp,disposeParcelProp} from './parcel-prop.mjs?v=fg-bfba5822c8e6d500';

export async function createNeighborhoodView(T,{scene,engine,getRows,getPlace,loadPet}){
 const source=await loadTravelerSource(),dolls=new Map(),pets=new Map();let ball=null;
 for(const n of NEIGHBORS){if(n.pet){const pet=await loadPet();pet.select(n.species);pet.dye.set(n.profile.look);pet.root.scale.setScalar(n.profile.size);pet.bind({ground:()=>.047,matchSpeed:true});pet.root.name='neighbor-'+n.id;pet.root.userData.neighbor=n.id;scene.add(pet.root);pets.set(n.id,pet);ball=createPetToy(T,'ball');scene.add(ball);continue;}const doll=createTraveler(source,true,n.look);await doll.ready();doll.root.name='neighbor-'+n.id;doll.root.scale.setScalar(1.4);doll.root.userData.neighbor=n.id;scene.add(doll.root);dolls.set(n.id,doll);}
 let clock=0,parcel=null,parcelKey='';const previous=new Map();
 function sync(dt=0){clock+=dt;for(const [id,doll]of dolls){const town=engine.state.neighbors[id].town,p=town.position,old=previous.get(id),moving=!!town.goal&&!!old&&Math.hypot(old.x-p.x,old.z-p.z)>.00001;doll.root.position.set(p.x,town.place==='outside'?.06:.08,p.z);doll.root.rotation.y=town.heading;doll.root.visible=town.place===(getPlace()||'outside');const handoff=engine.state.quest?.phase==='handoff'&&engine.state.quest.to===id;const a=engine.appearance(id);doll.animate(clock,{moving,gesture:handoff?'hold':a.gesture,progress:a.progress||0,height:doll.root.position.y});previous.set(id,{...p});}
  for(const [id,pet]of pets){const town=engine.state.neighbors[id].town,t=engine.state.petMeeting,r=engine.friendMotion||{};pet.root.visible=town.place===(getPlace()||'outside');pet.root.position.set(town.position.x,.047,town.position.z);pet.root.rotation.y=town.heading;pet.motion.setActionPose(r.friendSpeed?{}:idlePose(t?.kind==='greet'?'sniff':'look',t?.time||0));pet.setMood(t?.kind==='play'?'happy':t?'curious':'relaxed');pet.motion.update(dt,r.friendSpeed||0);ball.visible=pet.root.visible;ball.position.set(engine.state.friendBall.x,.115,engine.state.friendBall.z);if(t?.kind==='play')ball.rotation.z+=dt*3;}
  const q=engine.state.quest,key=q?q.from+':'+q.petId:'';if(key!==parcelKey){if(parcel)disposeParcelProp(parcel);parcel=null;parcelKey=key;if(q){parcel=createParcelProp(T,'neighbor-'+key,{sealed:true});parcel.name='neighbor-delivery';parcel.scale.setScalar(.7);scene.add(parcel);}}
  if(parcel&&q){const row=getRows().find(x=>x.entry.id===q.petId),root=row?.pet.root;parcel.visible=!!root&&row.entry.town.place===(getPlace()||'outside');if(root){const side=.2,a=root.rotation.y;parcel.position.set(root.position.x+Math.cos(a)*side,root.position.y+.22,root.position.z-Math.sin(a)*side);parcel.rotation.y=a;}}
 }
 function pick(ray){for(const[id,doll]of [...dolls,...pets])if(doll.root.visible&&ray.intersectObject(doll.root,true).length)return id;return null;}
 sync();return {dolls,pets,get ball(){return ball;},sync,pick,get parcel(){return parcel;}};
}
