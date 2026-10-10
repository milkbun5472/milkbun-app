import {restoreDomestic,restoreDomesticPet} from './domestic.mjs?v=fg-dfbc36ab1020098c';
import {chatRatio} from './chat-layout.mjs?v=fg-dfbc36ab1020098c';
import {restoreJournal} from './weekly-journal.mjs?v=fg-dfbc36ab1020098c';
import {restoreTogether} from './together.mjs?v=fg-dfbc36ab1020098c';
import {restoreNeighborhood} from './neighborhood.mjs?v=fg-dfbc36ab1020098c';
import {upgradeRoomLayout,ROOM_LAYOUT_VERSION} from './room-layout.mjs?v=fg-dfbc36ab1020098c';
import {restoreHousehold} from './home-chores.mjs?v=fg-dfbc36ab1020098c';
import {restoreTownLife} from './town-life.mjs?v=fg-dfbc36ab1020098c';
import {restoreSocial} from './social.mjs?v=fg-dfbc36ab1020098c';
import {restoreResident} from './autonomy.mjs?v=fg-dfbc36ab1020098c';
import {restoreCareer,PET_DAY_SECONDS} from './career.mjs?v=fg-dfbc36ab1020098c';
import {restoreCare} from './care.mjs?v=fg-dfbc36ab1020098c';
import {normalizeCatLook} from '../../art/pet-house/cat-dye.mjs?v=fg-dfbc36ab1020098c';
import {restorePetBirth,newPetBirth} from './birth.mjs?v=fg-dfbc36ab1020098c';
import {restoreWalkMemory} from './walk-life.mjs?v=fg-dfbc36ab1020098c';
import {restoreLivingAlbum} from './living-photos.mjs?v=fg-dfbc36ab1020098c';
const bound=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export const PET_LIMIT=4;
export const petDefaultName=(species,newcomer=false)=>(newcomer?'新来的':'')+(species==='dog'?'狗狗':'猫猫');
export function petSpeciesProfile(profile,species){const next=species==='dog'?'dog':'cat',name=profile?.name;return {...profile,species:next,name:name===petDefaultName(profile?.species)?petDefaultName(next):name===petDefaultName(profile?.species,true)?petDefaultName(next,true):name};}
export function petProfile(value){const species=value?.species==='dog'?'dog':'cat',fallback=petDefaultName(species);return {species,name:typeof value?.name==='string'?value.name.trim().slice(0,24)||fallback:fallback,look:normalizeCatLook(value?.look),weight:bound(value?.weight,.8,1.25,1),size:bound(value?.size,.7,1.3,1)};}
export function petEntry(raw,id,{at=Date.now(),random=Math.random}={}){const care=restoreCare(raw?.care);return {id,domestic:restoreDomesticPet(raw?.domestic),walk:restoreWalkMemory(raw?.walk),birth:restorePetBirth(raw?.birth)||(raw?.configured===true?newPetBirth({at,random,legacy:true}):null),life:{at:bound(raw?.life?.at,0,1e15,0),wakeUntil:bound(raw?.life?.wakeUntil,0,1e15,0),marks:raw?.life?.marks&&typeof raw.life.marks==='object'?{...raw.life.marks}:{},notes:Array.isArray(raw?.life?.notes)?raw.life.notes.filter(x=>typeof x?.text==='string'&&Number.isFinite(x.at)).slice(-12).map(x=>({at:x.at,text:x.text.slice(0,160)})):[]},town:restoreTownLife(raw?.town),profile:petProfile(raw?.profile),configured:raw?.configured===true,care,career:restoreCareer(raw?.career||{day:Math.floor(care.elapsed/PET_DAY_SECONDS)+1})};}
// Stable identity lives in the world save, never in a species or array index.
// The top-level projection preserves the existing single-pet API and old backups.
export function projectActivePet(state){const p=state.pets.find(p=>p.id===state.activePetId)||state.pets[0];state.activePetId=p.id;state.profile=p.profile;state.care=p.care;state.career=p.career;state.configured=p.configured;return state;}
export function restorePetState(raw,world,{at=Date.now(),random=Math.random}={}){raw=upgradeRoomLayout(raw);const saved=world.restore(raw),used=new Set(),rows=Array.isArray(raw?.pets)&&raw.pets.length?raw.pets:[raw||{}];const pets=rows.map((r,i)=>{let id=typeof r?.id==='string'&&/^[\w-]{1,80}$/.test(r.id)?r.id:'pet-'+(i+1);while(used.has(id))id+='-copy';used.add(id);return petEntry(r,id,{at,random});});return projectActivePet({version:10,domestic:restoreDomestic(raw?.domestic,pets.map(p=>p.id)),album:restoreLivingAlbum(raw?.album),ui:{chatRatio:chatRatio(raw?.ui?.chatRatio)},journal:restoreJournal(raw?.journal),together:restoreTogether(raw?.together),neighborhood:restoreNeighborhood(raw?.neighborhood,pets.map(p=>p.id),pets),roomLayoutVersion:ROOM_LAYOUT_VERSION,household:restoreHousehold(raw?.household),epoch:typeof raw?.epoch==='string'?raw.epoch:'',...(raw?.clock?{clock:structuredClone(raw.clock)}:{}),observation:raw?.observation?structuredClone(raw.observation):null,social:restoreSocial(raw?.social,pets.map(p=>p.id)),resident:{...restoreResident(raw?.resident),...(raw?.resident?.town?{town:restoreTownLife(raw.resident.town)}:{})},pets,activePetId:raw?.activePetId,day:Math.floor(bound(raw?.day,1,100000,1)),map:saved.room||'outside',...saved});}
export function snapshotPetState(state,view){const saved=structuredClone({...state,position:{...view.position},outdoor:view.outdoor?structuredClone(view.outdoor):null,room:view.room,map:view.room||'outside',evening:view.evening,profile:petProfile(state.profile)});const p=saved.pets?.find(p=>p.id===saved.activePetId);if(p){p.profile=petProfile(saved.profile);p.care=structuredClone(saved.care);p.career=structuredClone(saved.career);p.configured=saved.configured;}return saved;}
export function newPetEntry(profile,existing,random=Math.random,at=Date.now()){let id;do{id='pet-'+Math.floor(random()*0xffffffff).toString(36)+'-'+at.toString(36)+'-'+existing.length;}while(existing.some(p=>p.id===id));const seed=Math.max(1,Math.floor(random()*0xffffffff)),p=petEntry({profile,configured:true,birth:newPetBirth({at,random}),career:{rng:(seed^0x5f3759df)>>>0},care:{rng:seed,traits:{active:.3+random()*.5,social:.3+random()*.5,bold:.25+random()*.5}}},id);return p;}
// A body-only rest-mesh deformation. Feet, face, eyes and ears stay unchanged.
export function bodyWidth(x,y,z,height,weight){const h=y/height,fade=Math.max(0,Math.min(1,(h-.12)/.12))*Math.max(0,Math.min(1,(.54-h)/.14));return x*(1+(weight-1)*fade);}
