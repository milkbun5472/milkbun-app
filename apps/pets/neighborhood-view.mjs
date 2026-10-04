import {createTraveler,loadTravelerSource} from '../fairy-garden/traveler.mjs?v=fg-ffd9972dc4f3545d';
import {NEIGHBORS} from './neighborhood.mjs?v=fg-ffd9972dc4f3545d';
import {createParcelProp,disposeParcelProp} from './parcel-prop.mjs?v=fg-ffd9972dc4f3545d';

export async function createNeighborhoodView(T,{scene,engine,getRows,getPlace}){
 const source=await loadTravelerSource(),dolls=new Map();
 for(const n of NEIGHBORS){const doll=createTraveler(source,true,n.look);await doll.ready();doll.root.name='neighbor-'+n.id;doll.root.scale.setScalar(1.4);doll.root.userData.neighbor=n.id;scene.add(doll.root);dolls.set(n.id,doll);}
 let clock=0,parcel=null,parcelKey='';const previous=new Map();
 function sync(dt=0){clock+=dt;for(const [id,doll]of dolls){const town=engine.state.neighbors[id].town,p=town.position,old=previous.get(id),moving=!!town.goal&&!!old&&Math.hypot(old.x-p.x,old.z-p.z)>.00001;doll.root.position.set(p.x,town.place==='outside'?.06:.08,p.z);doll.root.rotation.y=town.heading;doll.root.visible=town.place===(getPlace()||'outside');const handoff=engine.state.quest?.phase==='handoff'&&engine.state.quest.to===id;doll.animate(clock,{moving,gesture:handoff?'hold':engine.state.visit?.id===id&&engine.state.visit.phase==='staying'?'sit':'rest',height:doll.root.position.y});previous.set(id,{...p});}
  const q=engine.state.quest,key=q?q.from+':'+q.petId:'';if(key!==parcelKey){if(parcel)disposeParcelProp(parcel);parcel=null;parcelKey=key;if(q){parcel=createParcelProp(T,'neighbor-'+key,{sealed:true});parcel.name='neighbor-delivery';parcel.scale.setScalar(.7);scene.add(parcel);}}
  if(parcel&&q){const row=getRows().find(x=>x.entry.id===q.petId),root=row?.pet.root;parcel.visible=!!root&&row.entry.town.place===(getPlace()||'outside');if(root){const side=.2,a=root.rotation.y;parcel.position.set(root.position.x+Math.cos(a)*side,root.position.y+.22,root.position.z-Math.sin(a)*side);parcel.rotation.y=a;}}
 }
 function pick(ray){for(const[id,doll]of dolls)if(doll.root.visible&&ray.intersectObject(doll.root,true).length)return id;return null;}
 sync();return {dolls,sync,pick,get parcel(){return parcel;}};
}
