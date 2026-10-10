import {choosePetToy} from './habits.mjs?v=fg-6941d9cc1b32d96f';
// Physical requests grow out of completed care, rather than assigned roles.
export const YOU_SPOT={x:-.65,z:1.72};
export const TOY_SPOTS={ball:{x:.45,z:.95},mouse:{x:-.45,z:.9}};
export const SEEK_KINDS=['waitFood','invitePlay','invitePet','askSnack'];
export const VISIT_STAGES=['fetch','carry','lower','waiting','cuddle'];
import {homePoint as homePoint} from './room-layout.mjs?v=fg-6941d9cc1b32d96f';
export {homePoint};
export function choosePetPerson(state,kind,people,random){
 const available=(people||[]).filter(p=>p.available!==false&&p.key&&homePoint(p.position));if(!available.length)return null;
 const scores=available.map(p=>{const r=state.relationships?.[p.key]||{};let n=1;
  if(kind==='food')n+=(r.food||0)*.8+(r.snack||0)*1.4;
  if(kind==='snack')n+=(r.snack||0)*1.8;
  if(kind==='play')n+=(r.play||0)*1.5;
  if(kind==='pet')n+=(r.pet||0)*1.4+(r.rest||0)*.4;
  if(kind==='sleep')n+=(r.rest||0)*1.6+(r.pet||0)*.8;
  return Math.max(.35,Math.min(20,n)-(r.refused||0)*.08);
 });
 let pick=Math.max(0,Math.min(.999999,Number(random)||0))*scores.reduce((a,b)=>a+b,0);
 for(let i=0;i<available.length;i++){pick-=scores[i];if(pick<0)return available[i];}return available.at(-1);
}
export function initiativeFor(state,people,random){
 if(state.satiety<50&&state.bowl<=0){const person=choosePetPerson(state,'food',people,random());return person?{kind:'waitFood',place:'feeding',person}:null;}
 if(state.energy<48){const person=choosePetPerson(state,'sleep',people,random());return person?{kind:'sleep',place:'person',person}:null;}
 if(state.satiety<83&&Object.values(state.relationships||{}).some(r=>r.snack>0)&&random()<.28){const person=choosePetPerson(state,'snack',people,random());return person?{kind:'askSnack',place:'person',person}:null;}
 const play=state.energy>40&&state.satiety>25&&random()<state.traits.active*.65;
 const person=choosePetPerson(state,play?'play':'pet',people,random());
 return person?{kind:play?'invitePlay':'invitePet',place:play?'toy':'person',person,toy:choosePetToy(state,random)}:null;
}
