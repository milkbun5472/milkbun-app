import {libraryMap,createLibrary} from './library.mjs?v=fg-dfbc36ab1020098c';
import {laboratoryMap,createLaboratory} from './laboratory.mjs?v=fg-dfbc36ab1020098c';
import {clinicMap,createClinic} from './clinic.mjs?v=fg-dfbc36ab1020098c';
import {studioMap,createStudio} from './studio.mjs?v=fg-dfbc36ab1020098c';
import {rehearsalMap,createRehearsal} from './rehearsal.mjs?v=fg-dfbc36ab1020098c';
import {stationMap,createStation} from './station.mjs?v=fg-dfbc36ab1020098c';
import {gymMap,createGym} from './gym.mjs?v=fg-dfbc36ab1020098c';
import {marketMap,createMarket} from './market.mjs?v=fg-dfbc36ab1020098c';
import {officeMap,createOffice} from './office.mjs?v=fg-dfbc36ab1020098c';
import {campusMap,createCampus} from './campus.mjs?v=fg-dfbc36ab1020098c';
import {investigationMap,createInvestigation} from './investigation.mjs?v=fg-dfbc36ab1020098c';
import {serviceMap,createService} from './service.mjs?v=fg-dfbc36ab1020098c';
import {filmMap,createFilm} from './film.mjs?v=fg-dfbc36ab1020098c';
import {broadcastMap,createBroadcast} from './broadcast.mjs?v=fg-dfbc36ab1020098c';
import * as T from 'three';
export const DAY_PLACES={dayLaboratory:laboratoryMap,dayLibrary:libraryMap,dayClinic:clinicMap,dayStudio:studioMap,dayRehearsal:rehearsalMap,dayStation:stationMap,dayGym:gymMap,dayMarket:marketMap,dayOffice:officeMap,dayCampus:campusMap,dayInvestigation:investigationMap,dayService:serviceMap,dayFilm:filmMap,dayBroadcast:broadcastMap};
export const DAY_FACTORIES={dayLaboratory:createLaboratory,dayLibrary:createLibrary,dayClinic:createClinic,dayStudio:createStudio,dayRehearsal:createRehearsal,dayStation:createStation,dayGym:createGym,dayMarket:createMarket,dayOffice:createOffice,dayCampus:createCampus,dayInvestigation:createInvestigation,dayService:createService,dayFilm:createFilm,dayBroadcast:createBroadcast};
// Only the read-only day viewer installs these maps. Persistent game worlds keep their own registry.
export function registerDayPlaces(maps){Object.assign(maps,DAY_PLACES);}
export function placeList(){return Object.entries(DAY_PLACES).map(([id,m])=>({id,label:m.label,spots:m.spots.map(({id,label,description,action,gesture},index)=>({id,label,description,action,gesture,number:index+1}))}));}
export function createPlaceMarkers(map){
  const root=new T.Group();root.name='PlaceMarkers';
  DAY_PLACES[map].spots.forEach((s,i)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#f4efe0';c.beginPath();c.arc(48,48,42,0,Math.PI*2);c.fill();c.strokeStyle='#7d9687';c.lineWidth=5;c.stroke();c.fillStyle='#3e5c4c';c.font='bold 48px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),48,50);const texture=new T.CanvasTexture(canvas),sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));sprite.position.set(s.target.x,.22,s.target.z);sprite.scale.set(.48,.48,.48);sprite.renderOrder=5;root.add(sprite);});return root;
}
