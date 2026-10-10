import {createParcelProp,disposeParcelProp} from './parcel-prop.mjs?v=fg-bb00e9e166d5c29c';
export function createCourierProps(T,{scene,pet,getState,getPlace}){const held=createParcelProp(T,'delivery-held',{sealed:true});held.visible=false;held.position.set(.3,.17,0);pet.root.add(held);let placed=null,key='';
 function sync(){const s=getState(),d=s.job?.delivery,p=s.courier.pending;held.visible=!!(d?.picked&&['carrying','returning','holding'].includes(d.status)&&!d.holdPlaced||p&&!p.holdPlaced);if(p?.holdPlaced&&p.position){if(key!==p.id){if(placed)disposeParcelProp(placed);placed=createParcelProp(T,p.id,{sealed:true});placed.userData.entrusted=true;scene.add(placed);key=p.id;}placed.position.set(p.position.x,.05,p.position.z);placed.scale.setScalar(pet.root.scale.x);placed.visible=getPlace()==='home';}else if(placed){disposeParcelProp(placed);placed=null;key='';}}
 return {sync,held,placed:()=>placed,dispose:()=>{disposeParcelProp(held);if(placed)disposeParcelProp(placed);}};
}
