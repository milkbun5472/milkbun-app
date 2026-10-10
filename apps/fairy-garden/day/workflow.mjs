import {dailyTaskAt,DAILY_MOTIONS,DAILY_LABELS} from './daily-workflow.mjs?v=fg-5ee68d467e4124cc';
// Visual phases read the original currentSlot; they never create or save schedule events.
const LAB='dayLaboratory',LIB='dayLibrary',CLINIC='dayClinic',STUDIO='dayStudio',REHEARSAL='dayRehearsal',STATION='dayStation';
const RECIPES={
 [LAB]:{bench:[['bench',6],['observation',2],['records',2],['break',1,'break']],observation:[['observation',8],['records',2],['break',1,'break']],computer:[['computer',12],['records',2],['break',1,'break']],records:[['records',12],['break',1,'break']]},
 [LIB]:{'desk-reading':[['desk-reading',12],['study-notes',2],['desk-reading',2,'break']],'window-reading':[['window-reading',14],['window-reading',1,'break']],'study-notes':[['study-notes',12],['desk-reading',3],['study-notes',1,'break']]},
 [CLINIC]:{casework:[['casework',9],['handoff',3],['duty',2],['rest',1,'break']],bedside:[['bedside',6],['casework',5],['rest',1,'break']],handoff:[['handoff',8],['casework',3],['rest',1,'break']],duty:[['duty',12],['handoff',2],['rest',1,'break']]},
 [STUDIO]:{easel:[['easel',8],['gallery',2],['drawing',2],['rest',1,'break']],drawing:[['drawing',10],['gallery',2],['rest',1,'break']],handcraft:[['handcraft',10],['gallery',2],['rest',1,'break']]},
 [REHEARSAL]:{practice:[['practice',8],['mirror',2],['score',2],['rest',1,'break']],mirror:[['mirror',8],['practice',2],['rest',1,'break']],piano:[['piano',12],['score',2],['rest',1,'break']],instruments:[['instruments',10],['score',2],['rest',1,'break']],score:[['score',10],['practice',2],['rest',1,'break']]},
 [STATION]:{waiting:[['waiting',12],['reading',2],['information',1]],reading:[['reading',12],['waiting',2],['information',1]],platform:[['platform',12],['waiting',2]],departure:[['waiting',8],['information',2],['departure',3]],luggage:[['waiting',12],['information',2]]}
};
const CONFIG={
 [LAB]:{entry:'entrance',prepare:p=>['bench','observation'].includes(p.spot)?'materials':'archive',tidy:p=>p.spot,exit:'entrance'},
 [LIB]:{entry:'exit',prepare:()=> 'choose-book',tidy:()=> 'return-book',exit:'exit',carry:'book'},
 [CLINIC]:{entry:'entrance',prepare:()=> 'casefiles',tidy:()=> 'casefiles',exit:'entrance',carry:'clipboard'},
 [STUDIO]:{entry:'entrance',prepare:()=> 'materials',tidy:p=>p.spot==='easel'?'drying':'storage',exit:'exit'},
 [REHEARSAL]:{entry:'entrance',prepare:()=> 'score',tidy:()=> 'score',exit:'exit'},
 [STATION]:{entry:'entrance',prepare:()=> 'luggage',tidy:()=> 'luggage',exit:'departure',carry:'luggage'}
};
const MOTIONS={
 [LAB]:{bench:'experiment',observation:'observe',computer:'type',records:'write',archive:'select',materials:'select'},
 [LIB]:{'choose-book':'select','desk-reading':'read','study-notes':'write','window-reading':'read','return-book':'return'},
 [CLINIC]:{casework:'write',bedside:'observe',equipment:'select',casefiles:'select',handoff:'clipboard',preparation:'observe',duty:'clipboard'},
 [STUDIO]:{easel:'paint',drawing:'write',handcraft:'craft',materials:'select',storage:'tidy',gallery:'observe',drying:'tidy'},
 [REHEARSAL]:{practice:'rehearse',mirror:'rehearse',score:'read',piano:'piano',instruments:'guitar'},
 [STATION]:{entrance:'luggage',information:'look-sign',service:'ticket',luggage:'pack',waiting:'wait',reading:'read',platform:'wait',departure:'luggage',exit:'luggage'}
};
const LABELS={enter:'走进来',prepare:'准备资料',work:'做事',break:'稍歇一会儿',tidy:'收拾与归还',exit:'准备离开'};
export function workMotion(map,spot){return MOTIONS[map]?.[spot]||null;}
export function activityPhase(p,slot,at,{preview=false}={}){
 const cfg=CONFIG[p.map],carryType=cfg?.carry||null;
 const plain={...p,phase:'work',phaseLabel:LABELS.work,motion:workMotion(p.map,p.spot),carry:p.map===LIB&&p.spot==='return-book',carryType};
 const recipe=RECIPES[p.map]?.[p.spot];
 const text=slot?.row?.deviation?.actual||slot?.actual||slot?.title||slot?.row?.title||'';
 const motionFor=id=>p.map===REHEARSAL&&['practice','mirror'].includes(id)&&/练舞|舞蹈|跳舞/.test(text)?'dance':workMotion(p.map,id);
 plain.motion=motionFor(p.spot);
 if(['dayHome','dayCafe','dayWork'].includes(p.map)&&DAILY_MOTIONS[p.action]){plain.motion=DAILY_MOTIONS[p.action];plain.phaseLabel=DAILY_LABELS[p.action];}
 if(!recipe||!slot||preview||!Number.isFinite(slot.startAt)||!Number.isFinite(slot.endAt)||!Number.isFinite(at))return plain;
 const span=(slot.endAt-slot.startAt)/60000,elapsed=(at-slot.startAt)/60000;
 if(span<=0||elapsed<0||elapsed>=span)return {...p,motion:null,carry:false};
 const edge=Math.min(1.5,span*.12),entry=edge/3,closing=span-edge;
 let spot=p.spot,phase='work',motion=plain.motion,carry=!!carryType&&p.map!==STATION;
 if(elapsed<entry){spot=cfg.entry;phase='enter';motion=p.map===STATION?'luggage':null;carry=p.map===STATION;}
 else if(elapsed<edge){spot=cfg.prepare(p);phase='prepare';motion=motionFor(spot);carry=false;}
 else if(elapsed>=span-entry){spot=cfg.exit;phase='exit';motion=p.map===STATION?'luggage':null;carry=p.map===STATION;}
 else if(elapsed>=closing){spot=cfg.tidy(p);phase='tidy';motion=p.map===LIB?'return':p.map===STATION?'take-luggage':p.map===CLINIC?'return':'tidy';}
 else{
  const duration=recipe.reduce((n,b)=>n+b[1],0);let cycle=(elapsed-edge)%duration;
  for(const [id,length,phaseOverride] of recipe){if(cycle<length){spot=id;phase=phaseOverride||'work';motion=phase==='break'?null:motionFor(spot);break;}cycle-=length;}
 }
 return {...p,spot,phase,phaseLabel:p.map===STATION&&phase==='prepare'?'放好随身行李':p.map===STATION&&phase==='tidy'?'取回随身行李':LABELS[phase],motion,carry,carryType};
}
// Keep the visible suitcase inside available floor space, including when seated.
export function luggagePosition(map,origin,heading=0){
 const s=Math.sin(heading),c=Math.cos(heading),valid=q=>Math.abs(q.x)<map.bounds.w/2-.18&&Math.abs(q.z)<map.bounds.d/2-.18&&!map.obstacles.some(o=>o.w&&o.d&&Math.abs(q.x-o.x)<o.w/2+.20&&Math.abs(q.z-o.z)<o.d/2+.20);
 for(const [x,z]of [[.30,-.14],[.30,.34],[-.30,.34],[0,.42],[0,-.42]]){const q={x:origin.x+x*c+z*s,y:map.floor,z:origin.z-x*s+z*c};if(valid(q))return q;}
 return {x:origin.x,y:map.floor,z:origin.z};
}
export function taskAt(stage,spot,map,elapsed,{moving=false,position,heading}={}){
 if(['dayHome','dayCafe','dayWork'].includes(map.id))return dailyTaskAt(stage,spot,map,elapsed,{moving});
 if(!stage.motion&&!stage.carry)return null;
 const carryType=stage.carryType||null,kind=moving?'carry':stage.motion||'carry';
 const origin=spot?.seat||spot?.target||map.spawn,yaw=spot?.heading||0,s=Math.sin(yaw),c=Math.cos(yaw);
 const forward=kind==='select'?.16:kind==='return'?.17:kind==='type'?.13:kind==='observe'?.18:.18;
 const p=map.furniture?.find(f=>f.id===spot?.furniture),top=map.floor+(p?.top??(kind==='select'?1.15:.85));
 const localX=kind==='experiment'?.15:.12;
 let target={x:origin.x+localX*c+forward*s,y:top+(kind==='write'?.11:kind==='experiment'?.13:kind==='select'?-.24:.05),z:origin.z-localX*s+forward*c};
 let contact={x:origin.x+localX*c+.37*s,y:top+.04,z:origin.z-localX*s+.37*c};
 const work=p?.work?.[stage.spot];
 if(work){contact={x:p.x+work.x,y:map.floor+work.y,z:p.z+work.z};if(kind==='paint')target={x:contact.x,y:contact.y-.04,z:origin.z-.18};if(kind==='piano')target={...contact};}
 const task={kind,carry:!!stage.carry||kind==='select'&&[LIB,CLINIC].includes(stage.map)&&elapsed>=2.5,carryType,progress:['select','return','tidy','pack','take-luggage'].includes(kind)?Math.min(1,elapsed/5):elapsed/5%1,target,contact};
 if(kind==='paint'){const dx=Math.sin(elapsed*2)*.03,dy=Math.cos(elapsed*1.7)*.025;task.contact.x+=dx;task.contact.y+=dy;task.target.x+=dx;task.target.y+=dy;}
 if(kind==='piano')task.leftTarget={...target,x:p.x+.12};
 if(kind==='paint')task.tool='brush';
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
