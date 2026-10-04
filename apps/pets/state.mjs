import {restoreCareer,PET_DAY_SECONDS} from './career.mjs?v=fg-ea391396cda97f42';
import {restoreCare} from './care.mjs?v=fg-ea391396cda97f42';
import {normalizeCatLook} from '../../art/pet-house/cat-dye.mjs?v=fg-ea391396cda97f42';
const bound=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export function petProfile(value){return {species:value?.species==='dog'?'dog':'cat',name:typeof value?.name==='string'?value.name.trim().slice(0,24)||'猫猫':'猫猫',look:normalizeCatLook(value?.look),weight:bound(value?.weight,.8,1.25,1),size:bound(value?.size,.7,1.3,1)};}
export function restorePetState(raw,world){const saved=world.restore(raw),care=restoreCare(raw?.care);return {version:3,career:restoreCareer(raw?.career||{day:Math.floor(care.elapsed/PET_DAY_SECONDS)+1}),care,day:Math.floor(bound(raw?.day,1,100000,1)),map:saved.room||'outside',...saved,profile:petProfile(raw?.profile),configured:raw?.configured===true};}
export function snapshotPetState(state,view){return {...state,position:{...view.position},outdoor:view.outdoor?structuredClone(view.outdoor):null,room:view.room,map:view.room||'outside',evening:view.evening,profile:petProfile(state.profile)};}
// A body-only rest-mesh deformation. Feet, face, eyes and ears stay unchanged.
export function bodyWidth(x,y,z,height,weight){const h=y/height,fade=Math.max(0,Math.min(1,(h-.12)/.12))*Math.max(0,Math.min(1,(.54-h)/.14));return x*(1+(weight-1)*fade);}
