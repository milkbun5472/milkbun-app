import {renderPhoto} from './photo-render.mjs?v=fg-127ffe874240ba15';
// Preserve the live rig's world transform and isolate it for a keepsake.
// The offscreen viewport must be square; never crop the main phone viewport.
export function captureWorkPhoto(T,renderer,pet,scene){
 const parent=pet.root.parent,portrait=new T.Scene();portrait.background=new T.Color('#eee8df');portrait.add(new T.HemisphereLight('#fff4e6','#b1a090',2.4));const light=new T.DirectionalLight('#fff6e9',3);portrait.add(light);
 const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),q=pet.root.getWorldPosition(new T.Vector3()),size=pet.root.scale.x,camera=new T.PerspectiveCamera(30,1,.01,60),visible=pet.root.visible;
 const yaw=pet.root.rotation.y;camera.position.copy(q).add(new T.Vector3(Math.sin(yaw)*2.45+Math.cos(yaw)*.65,.70,Math.cos(yaw)*2.45-Math.sin(yaw)*.65).multiplyScalar(size));camera.lookAt(q.clone().add(new T.Vector3(0,.42*size,0)));light.position.copy(camera.position).add(new T.Vector3(-size,1.5*size,0));light.target.position.copy(q);portrait.add(light.target);
 try{portrait.add(pet.root);pet.root.visible=true;return renderPhoto(T,renderer,portrait,camera,{width:256,height:256,quality:.72});}catch{return '';}finally{pet.root.removeFromParent();parent?.add(pet.root);pet.root.visible=visible;renderer.setRenderTarget(target);renderer.setViewport(viewport);}
}
