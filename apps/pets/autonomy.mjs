import {idlePetPose} from '../../art/pet-house/pet-action.mjs?v=fg-d1e14d4d1c374656';
import {RESIDENT_ACTS,restoreResidentChoices} from './resident-choice.mjs?v=fg-d1e14d4d1c374656';
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{x:p.x,z:p.z}:null;
const bound=(v,a,b,f)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):f;
export function nextRandom(state){state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296;}
// All residents use the real navigator. An occupied or unreachable goal is never
// a reason to teleport; wait and try a different local route on the next turn.
export function localRoute(nav,from,random,{radius=2,minDistance=.7,clear=()=>true}={}){
 for(let i=0;i<20;i++){const angle=random()*Math.PI*2,d=minDistance+random()*(radius-minDistance),goal={x:from.x+Math.sin(angle)*d,z:from.z+Math.cos(angle)*d};if(!nav.walkable(goal.x,goal.z)||!clear(goal))continue;const route=nav.path(from,goal);if(route?.length)return {goal,route};}return null;
}
export const IDLE_ACTIONS=['sniff','look'];
export const idlePose=idlePetPose;
export function restoreResident(raw){return {name:typeof raw?.name==='string'?raw.name.slice(0,80):'',outing:raw?.outing&&['outside','cafe'].includes(raw.outing.place)&&typeof raw.outing.date==='string'?{date:raw.outing.date.slice(0,16),place:raw.outing.place,point:finitePoint(raw.outing.point)}:null,choices:restoreResidentChoices(raw?.choices),life:raw?.life&&typeof raw.life==='object'?structuredClone(raw.life):{at:0,marks:{},notes:[]},id:typeof raw?.id==='string'?raw.id.slice(0,80):'',position:finitePoint(raw?.position),heading:bound(raw?.heading,-Math.PI*4,Math.PI*4,0),rng:bound(raw?.rng,1,4294967295,975312468),idle:bound(raw?.idle,0,60,0),activity:raw?.activity&&[...Object.keys(RESIDENT_ACTS),'sleep','meal'].includes(raw.activity.kind)?{kind:raw.activity.kind,phase:raw.activity.phase==='walking'?'walking':'doing',goal:finitePoint(raw.activity.goal),...(finitePoint(raw.activity.face)?{face:finitePoint(raw.activity.face)}:{}),...(typeof raw.activity.petId==='string'?{petId:raw.activity.petId.slice(0,80)}:{}),time:bound(raw.activity.time,0,30,0),duration:bound(raw.activity.duration,6,raw.activity.kind==='sleep'?86400:30,10)}:null};}
export function restoreOutdoorIdle(raw){return {rng:bound(raw?.rng,1,4294967295,864213579),wait:bound(raw?.wait,0,40,6),time:bound(raw?.time,0,40,0),action:IDLE_ACTIONS.includes(raw?.action)?raw.action:'look',goal:finitePoint(raw?.goal)};}
