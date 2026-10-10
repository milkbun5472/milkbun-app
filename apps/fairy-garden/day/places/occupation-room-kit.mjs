import {roomSeat} from './room-kit.mjs?v=fg-f9a3c901abadb37b';
import {cabinet} from './work-room-kit.mjs?v=fg-f9a3c901abadb37b';
// All new work rooms use the same physical chairs, approach anchors and batching.
export function furnishRoom(k,furniture,{cabinetColor='#819ca4'}={}){
 for(const p of furniture){
  if(p.kind==='table')k.table(p);else if(p.kind==='chair')k.chair(p);else if(p.kind==='bench')k.bench(p);
  else if(p.kind==='cabinet')cabinet(k,p,p.color||cabinetColor,p.doors||2);
  else if(p.kind==='plant'){const g=k.plant(p.x,p.z);g.name=p.id;}
 }
}
export function seatedSpot(furniture,{id,label,description,chair,approach,piece,action='work'}){
 const seat=roomSeat(furniture,chair,approach);
 return {id,label,description,action,gesture:({read:'read',tea:'tea',meal:'eat'}[action]||'rest'),seat,target:seat.approach,heading:seat.heading,furniture:piece};
}

export function benchFlask(k,p){
 const g=k.group('BenchFlask:'+p.id,{x:p.x+p.w/2-.30,z:p.z});
 k.cylinder('ThermosBody',{y:.675,r:.065,h:.29,color:'#b9c4af'},g);k.cylinder('ThermosCap',{y:.835,r:.067,h:.045,color:'#7e9489'},g);
}
