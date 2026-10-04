import {restoreTownLife} from './town-life.mjs?v=fg-c2be65f088459562';
import {restoreSocial} from './social.mjs?v=fg-c2be65f088459562';
import {restoreResident} from './autonomy.mjs?v=fg-c2be65f088459562';
import {restoreCareer,PET_DAY_SECONDS} from './career.mjs?v=fg-c2be65f088459562';
import {restoreCare} from './care.mjs?v=fg-c2be65f088459562';
import {normalizeCatLook} from '../../art/pet-house/cat-dye.mjs?v=fg-c2be65f088459562';
const bound=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export const PET_LIMIT=4;
export function petProfile(value){const species=value?.species==='dog'?'dog':'cat',fallback=species==='dog'?'狗狗':'猫猫';return {species,name:typeof value?.name==='string'?value.name.trim().slice(0,24)||fallback:fallback,look:normalizeCatLook(value?.look),weight:bound(value?.weight,.8,1.25,1),size:bound(value?.size,.7,1.3,1)};}
export function petEntry(raw,id){const care=restoreCare(raw?.care);return {id,town:restoreTownLife(raw?.town),profile:petProfile(raw?.profile),configured:raw?.configured===true,care,career:restoreCareer(raw?.career||{day:Math.floor(care.elapsed/PET_DAY_SECONDS)+1})};}
// Stable identity lives in the world save, never in a species or array index.
// The top-level projection preserves the existing single-pet API and old backups.
export function projectActivePet(state){const p=state.pets.find(p=>p.id===state.activePetId)||state.pets[0];state.activePetId=p.id;state.profile=p.profile;state.care=p.care;state.career=p.career;state.configured=p.configured;return state;}
export function restorePetState(raw,world){const saved=world.restore(raw),used=new Set(),rows=Array.isArray(raw?.pets)&&raw.pets.length?raw.pets:[raw||{}];const pets=rows.map((r,i)=>{let id=typeof r?.id==='string'&&/^[\w-]{1,80}$/.test(r.id)?r.id:'pet-'+(i+1);while(used.has(id))id+='-copy';used.add(id);return petEntry(r,id);});return projectActivePet({version:4,observation:raw?.observation?structuredClone(raw.observation):null,social:restoreSocial(raw?.social,pets.map(p=>p.id)),resident:{...restoreResident(raw?.resident),...(raw?.resident?.town?{town:restoreTownLife(raw.resident.town)}:{})},pets,activePetId:raw?.activePetId,day:Math.floor(bound(raw?.day,1,100000,1)),map:saved.room||'outside',...saved});}
export function snapshotPetState(state,view){const saved=structuredClone({...state,position:{...view.position},outdoor:view.outdoor?structuredClone(view.outdoor):null,room:view.room,map:view.room||'outside',evening:view.evening,profile:petProfile(state.profile)});const p=saved.pets?.find(p=>p.id===saved.activePetId);if(p){p.profile=petProfile(saved.profile);p.care=structuredClone(saved.care);p.career=structuredClone(saved.career);p.configured=saved.configured;}return saved;}
export function newPetEntry(profile,existing,random=Math.random){let id;do{id='pet-'+Math.floor(random()*0xffffffff).toString(36)+'-'+Date.now().toString(36)+'-'+existing.length;}while(existing.some(p=>p.id===id));const seed=Math.max(1,Math.floor(random()*0xffffffff)),p=petEntry({profile,configured:true,career:{rng:(seed^0x5f3759df)>>>0},care:{rng:seed,traits:{active:.3+random()*.5,social:.3+random()*.5,bold:.25+random()*.5}}},id);return p;}
// A body-only rest-mesh deformation. Feet, face, eyes and ears stay unchanged.
export function bodyWidth(x,y,z,height,weight){const h=y/height,fade=Math.max(0,Math.min(1,(h-.12)/.12))*Math.max(0,Math.min(1,(.54-h)/.14));return x*(1+(weight-1)*fade);}
