import * as T from 'three';
import {DAY_PLACES} from './maps.mjs?v=fg-bf2a8f69e3079bf5';
import {PLACE_MODULES,placeModules} from './modules.mjs?v=fg-bf2a8f69e3079bf5';
export {DAY_PLACES};
export const DAY_FACTORIES=Object.fromEntries(Object.entries(PLACE_MODULES).map(([id,p])=>[id,async options=>{
 const mod=await placeModules.load(id),view=mod[p.create](options);
 const {applyProfessionalView}=await import('../professional-view.mjs?v=fg-bf2a8f69e3079bf5');
 return applyProfessionalView(view,id,options);
}]));
// Registration needs only the light map data; geometry loads when a place is entered.
export function registerDayPlaces(maps){Object.assign(maps,DAY_PLACES);}
export function placeList(){return Object.entries(DAY_PLACES).map(([id,m])=>({id,label:m.label,spots:m.spots.map(({id,label,description,action,gesture},index)=>({id,label,description,action,gesture,number:index+1}))}));}
export function createPlaceMarkers(map){
  const root=new T.Group();root.name='PlaceMarkers';
  DAY_PLACES[map].spots.forEach((s,i)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#f4efe0';c.beginPath();c.arc(48,48,42,0,Math.PI*2);c.fill();c.strokeStyle='#7d9687';c.lineWidth=5;c.stroke();c.fillStyle='#3e5c4c';c.font='bold 48px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),48,50);const texture=new T.CanvasTexture(canvas),sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));sprite.position.set(s.target.x,.22,s.target.z);sprite.scale.set(.48,.48,.48);sprite.renderOrder=5;root.add(sprite);});return root;
}
