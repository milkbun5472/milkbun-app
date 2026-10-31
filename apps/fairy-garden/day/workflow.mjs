import {workControls} from './work-contacts.mjs?v=fg-bf2a8f69e3079bf5';
import {errandsTaskAt} from './errands-workflow.mjs?v=fg-bf2a8f69e3079bf5';
import {dailyTaskAt,DAILY_MOTIONS,DAILY_LABELS} from './daily-workflow.mjs?v=fg-bf2a8f69e3079bf5';
import {OCCUPATION_MOTIONS,occupationMotion,occupationTask,isOccupation} from './occupation-workflow.mjs?v=fg-bf2a8f69e3079bf5';
import {CHORES} from './chores.mjs?v=fg-bf2a8f69e3079bf5';
import {activityGroup,activityConfig,activityBeat} from './activity-groups.mjs?v=fg-bf2a8f69e3079bf5';
// Visual phases read the original currentSlot; they never create or save schedule events.
const FARM='dayFarm',FLEA='dayFleaMarket',OFFICE='dayOffice',CAMPUS='dayCampus',LAB='dayLaboratory',LIB='dayLibrary',CLINIC='dayClinic',STUDIO='dayStudio',REHEARSAL='dayRehearsal',STATION='dayStation',GYM='dayGym',MARKET='dayMarket';
const MOTIONS={
 ...OCCUPATION_MOTIONS,
 [FARM]:{records:'write',crops:'observe',supplies:'select',dock:'observe'},
 [FLEA]:{fabric:'market-pick',antiques:'market-pick',checkout:'checkout',packing:'market-pack',exit:'carry'},
 [OFFICE]:{computer:'type',notes:'write',meeting:'listen','meeting-notes':'write',presentation:'present',files:'select',print:'select'},
 [CAMPUS]:{listen:'listen',notes:'write',study:'write',blackboard:'paint',teach:'present',prepare:'write',lockers:'select'},
 [GYM]:{storage:'wait',treadmill:'treadmill','take-weights':'weight-pick',weights:'weights',stretch:'stretch'},
 [MARKET]:{basket:'basket-pick',produce:'market-pick',groceries:'market-pick',cold:'market-pick',checkout:'checkout',cashier:'cashier',packing:'market-pack',exit:'carry'},
 [LAB]:{bench:'experiment',observation:'observe',computer:'type',records:'write',archive:'select',materials:'select'},
 [LIB]:{'choose-book':'select','desk-reading':'read','study-notes':'write','window-reading':'read','return-book':'return'},
 [CLINIC]:{casework:'write',bedside:'observe',equipment:'select',casefiles:'select',handoff:'clipboard',preparation:'observe',duty:'clipboard'},
 [STUDIO]:{easel:'paint',drawing:'write',handcraft:'craft',materials:'select',storage:'tidy',gallery:'observe',drying:'tidy'},
 [REHEARSAL]:{practice:'rehearse',mirror:'rehearse',score:'read',piano:'piano',instruments:'guitar'},
 [STATION]:{entrance:'luggage',information:'look-sign',service:'ticket',luggage:'pack',waiting:'wait',reading:'read',platform:'wait',departure:'luggage',exit:'luggage'}
};
const LABELS={enter:'走进来',prepare:'准备资料',work:'做事',break:'稍歇一会儿',tidy:'收拾与归还',exit:'准备离开'};
export function workMotion(map,spot){return MOTIONS[map]?.[spot]||null;}
export function activityPhase(p,slot,at,{preview=false,space=null}={}){
 const group=activityGroup(p,space),cfg=group?.config,carryType=activityConfig(p.map)?.carry||null;
 const text=slot?.row?.deviation?.actual||slot?.actual||slot?.title||slot?.row?.title||'';
 const point=id=>space?.spots.find(s=>s.id===id);
 const motionFor=id=>occupationMotion(p.map,id,text)||(p.map===REHEARSAL&&['practice','mirror'].includes(id)&&/练舞|舞蹈|跳舞/.test(text)?'dance':workMotion(p.map,id))||(['tea','meal'].includes(point(id)?.action)?DAILY_MOTIONS[point(id).action]:null);
 const plain={...p,phase:'work',phaseLabel:LABELS.work,motion:motionFor(p.spot),carry:p.map===LIB&&p.spot==='return-book',carryType};
 if(p.map===GYM)plain.carryType=p.spot==='weights'?'weights':null;
 if(p.map===MARKET){plain.carry=p.spot!=='entrance'&&p.spot!=='cashier'&&p.spot!=='rest';if(p.spot==='cashier')plain.carryType=null;}
 if(['dayHome','dayCafe','dayWork'].includes(p.map)&&DAILY_MOTIONS[p.action]){plain.motion=DAILY_MOTIONS[p.action];plain.phaseLabel=DAILY_LABELS[p.action];}
 if(p.map==='dayHome'&&globalThis.CharDayHomeHobbies.activities[p.action]&&space&&!space.spots.some(s=>s.action===p.action))return {...plain,action:'rest',spot:space.spots.find(s=>s.action==='rest')?.id||null,gesture:'rest',motion:null,phase:'break',phaseLabel:'先摆好'+globalThis.CharDayHomeHobbies.activities[p.action].furnitureLabel,unavailableHobby:p.action};
 if(p.stageCarry&&!p.manual)return {...plain,carry:true,carryType:p.stageCarry,motion:'carry',phaseLabel:'在路上'};
 if(p.manual||!slot||preview||!Number.isFinite(slot.startAt)||!Number.isFinite(slot.endAt)||!Number.isFinite(at)||!group)return plain;
 const span=(slot.endAt-slot.startAt)/60000,elapsed=(at-slot.startAt)/60000;
 if(span<=0||elapsed<0||elapsed>=span)return {...p,motion:null,carry:false};
 if(!cfg&&span<3)return plain;
 const edge=cfg?Math.min(1.5,span*.12):0,entry=edge/3,closing=span-edge;
 let spot=p.spot,phase='work',motion=plain.motion,carry=!!carryType&&p.map!==STATION&&p.action!=='rest',options={};
 if(cfg&&elapsed<entry){spot=cfg.entry;phase='enter';motion=p.map===STATION?'luggage':null;carry=p.map===STATION;}
 else if(cfg&&elapsed<edge){spot=cfg.prepare(p);phase='prepare';motion=motionFor(spot);carry=false;}
 else if(cfg&&elapsed>=span-entry){spot=cfg.exit;phase='exit';motion=p.map===STATION?'luggage':null;carry=p.map===STATION;}
 else if(cfg&&elapsed>=closing){spot=cfg.tidy(p);phase='tidy';motion=p.map===GYM?(p.spot==='weights'?'weight-return':'wait'):[MARKET,FLEA].includes(p.map)?(p.spot==='cashier'?'cashier':'market-pack'):p.map===LIB?'return':p.map===STATION?'take-luggage':p.map===CLINIC?'return':'tidy';}
 else{
  const beat=activityBeat(group,elapsed-edge);
  if(beat){spot=beat.id;phase=beat.phase||'work';options=beat.options;
   if(cfg&&phase==='work'&&beat.length>=8&&beat.cycle>=5.5&&beat.cycle<6){phase='break';}
   motion=phase==='break'?null:motionFor(spot);
  }
 }
 // Furniture may have been stored since the group was selected. Edges use the
 // same live anchors as beats; an absent cabinet cannot receive a phantom task.
 if(space&&!point(spot))return plain;
 const action=options.action||point(spot)?.action||p.action,gesture=phase==='break'?(options.standing?'stretch':'rest'):point(spot)?.gesture||p.gesture;
 if(!cfg&&['dayHome','dayCafe','dayWork','dayStreet'].includes(p.map))motion=phase==='break'?null:DAILY_MOTIONS[action]||null;
 if(phase==='break')carry=false;
 if(p.map===LAB&&['records','computer','break'].includes(spot))carry=false;
 if(p.map===GYM)carry=p.spot==='weights'&&['work','tidy'].includes(phase)&&spot!=='water';
 if(p.map===MARKET){carry=p.spot!=='cashier'&&phase!=='enter'&&phase!=='prepare';motion=phase==='exit'?'carry':motion;if(phase==='tidy'&&p.spot!=='cashier'&&elapsed<closing+(edge-entry)/2){spot='checkout';motion='checkout';}}
 return {...p,spot,action,gesture,phase,phaseLabel:p.map===STATION&&phase==='prepare'?'放好随身行李':p.map===STATION&&phase==='tidy'?'取回随身行李':phase==='work'?(CHORES[action]?.personal?CHORES[action].label:motion===DAILY_MOTIONS[action]?DAILY_LABELS[action]:LABELS.work):options.stroll?'起身走走':options.standing?'起身活动一下':LABELS[phase],standing:!!options.standing,stroll:!!options.stroll,group:group.id,groupLabel:group.label,motion,carry,carryType:p.map===GYM?plain.carryType:p.map===MARKET&&p.spot==='cashier'?null:carryType};
}
// Keep the visible suitcase inside available floor space, including when seated.
export function luggagePosition(map,origin,heading=0){
 const s=Math.sin(heading),c=Math.cos(heading),valid=q=>Math.abs(q.x)<map.bounds.w/2-.18&&Math.abs(q.z)<map.bounds.d/2-.18&&!map.obstacles.some(o=>o.w&&o.d&&Math.abs(q.x-o.x)<o.w/2+.20&&Math.abs(q.z-o.z)<o.d/2+.20);
 for(const [x,z]of [[.30,-.14],[.30,.34],[-.30,.34],[0,.42],[0,-.42]]){const q={x:origin.x+x*c+z*s,y:map.floor,z:origin.z-x*s+z*c};if(valid(q))return q;}
 return {x:origin.x,y:map.floor,z:origin.z};
}
export function taskAt(stage,spot,map,elapsed,{moving=false,position,heading,motion=null,actor=null}={}){
 if(stage.stageCarry&&stage.action==='walk')return {kind:'carry',elapsed,progress:elapsed/5%1,carry:true,carryType:stage.stageCarry,bag:stage.stageCarry==='basket',phase:stage.phase,spot:stage.spot};
 if(stage.phase==='break'&&['dayHome','dayCafe','dayWork','dayStreet'].includes(map.id))return null;
 if(['dayHome','dayCafe','dayWork'].includes(map.id))return dailyTaskAt(stage,spot,map,elapsed,{moving,motion,position,actor});
 if(stage.phase!=='break'&&['tea','meal'].includes(spot?.action)&&![OFFICE,CAMPUS].includes(map.id))return dailyTaskAt({...stage,action:spot.action},spot,map,elapsed,{moving,motion,personal:true});
 const errands=errandsTaskAt(stage,spot,map,elapsed,{moving});if(errands!==undefined)return errands;
 if([OFFICE,CAMPUS].includes(stage.map)&&['tea','meal'].includes(spot?.action))return stage.phase==='break'?null:dailyTaskAt({...stage,action:spot.action},spot,{...map,id:stage.map},elapsed,{moving,motion,personal:true});
 if(stage.phase==='break')return null;
 if(isOccupation(stage.map)&&moving&&!stage.carry)return null;
 if(isOccupation(stage.map)&&['tea','meal','read'].includes(spot?.action))return dailyTaskAt({...stage,action:spot.action},spot,{...map,id:stage.map},elapsed,{moving,motion,personal:true});
 if(!stage.motion&&!stage.carry)return null;
 const carryType=stage.carryType||null,kind=moving?'carry':stage.motion||'carry';
 const origin=spot?.seat||spot?.target||map.spawn,yaw=spot?.heading||0,s=Math.sin(yaw),c=Math.cos(yaw);
 const forward=kind==='select'?.16:kind==='return'?.17:kind==='type'?.13:kind==='observe'?.18:.18;
 const p=map.furniture?.find(f=>f.id===spot?.furniture),top=map.floor+(p?.top??(kind==='select'?1.15:.85));
 const localX=kind==='experiment'?.15:.12;
 let target={x:origin.x+localX*c+forward*s,y:top+(kind==='write'?.11:kind==='experiment'?.13:kind==='select'?-.24:.05),z:origin.z-localX*s+forward*c};
 let contact={x:origin.x+localX*c+.37*s,y:top+.04,z:origin.z-localX*s+.37*c};
 const work=p?.work?.[stage.spot];
 if(work){contact={x:p.x+work.x,y:map.floor+work.y,z:p.z+work.z};if(kind==='write')target={x:contact.x,y:contact.y+.18,z:contact.z};if(kind==='paint')target={x:contact.x,y:contact.y-.04,z:origin.z-.18};if(kind==='piano')target={...contact};}
 const task={kind,elapsed,furniture:spot?.furniture,spot:stage.spot,phase:stage.phase,carry:!!stage.carry||kind==='select'&&[LAB,LIB,CLINIC,STUDIO,OFFICE,CAMPUS].includes(stage.map)&&elapsed>=2.5,carryType,progress:['select','return','tidy','pack','take-luggage'].includes(kind)?Math.min(1,elapsed/5):elapsed/5%1,target,contact};
 if(kind==='paint'){const dx=Math.sin(elapsed*2)*.03,dy=Math.cos(elapsed*1.7)*.025;task.contact.x+=dx;task.contact.y+=dy;task.target.x+=dx;task.target.y+=dy;}
 if(kind==='piano')task.leftTarget={...target,x:p.x+.12};
 if(kind==='paint'){task.tool=stage.map===CAMPUS?'chalk':'brush';if(task.tool==='chalk')task.target={x:task.contact.x,y:task.contact.y,z:task.contact.z+.09};}
 occupationTask(task,{...map,id:stage.map},spot,p);
 workControls(task,map,p);
 if(carryType==='luggage'){
  const rack=map.furniture.find(f=>f.id==='luggage-shelf'),storedAt={x:rack.x-.12,y:map.floor+.145,z:rack.z+.27};
  const stored=stage.phase==='work'&&!['pack','take-luggage'].includes(stage.motion)||stage.phase==='tidy'&&moving;
  const q=moving?position||origin:origin;
  task.luggage=stored?storedAt:luggagePosition(map,q,moving?heading??yaw:yaw);
  task.luggageHeld=!stored&&(moving||kind==='luggage'||kind==='carry');
  if(['pack','take-luggage'].includes(kind)&&!moving)task.stow=storedAt;
 }
 return task;
}
