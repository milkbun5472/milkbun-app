import {CHORES} from './chores.mjs?v=fg-bf2a8f69e3079bf5';
import {OCCUPATION_RECIPES,OCCUPATION_CONFIG} from './occupation-workflow.mjs?v=fg-bf2a8f69e3079bf5';
// One set of activity groups for all scenes. Beats project the original slot;
// anchors come from the live map, so stored or moved furniture is respected.
const FARM='dayFarm',FLEA='dayFleaMarket';
const OFFICE='dayOffice',CAMPUS='dayCampus',LAB='dayLaboratory',LIB='dayLibrary',CLINIC='dayClinic',STUDIO='dayStudio',REHEARSAL='dayRehearsal',STATION='dayStation',GYM='dayGym',MARKET='dayMarket';
const RECIPES={
 ...OCCUPATION_RECIPES,
 [FARM]:{records:[['records',12],['rest',1,'break']],crops:[['crops',6],['records',3],['rest',1,'break']],dock:[['dock',8],['rest',1,'break']]},
 [FLEA]:{fabric:[['fabric',5],['antiques',3],['rest',1,'break']],antiques:[['antiques',5],['fabric',3],['rest',1,'break']],checkout:[['checkout',6]]},
 [OFFICE]:{computer:[['computer',12],['notes',2],['tea',1,'break']],notes:[['notes',12],['files',1],['tea',1,'break']],meeting:[['meeting',12],['meeting-notes',2]],'meeting-notes':[['meeting-notes',12],['meeting',2]],presentation:[['presentation',10],['meeting',2]]},
 [CAMPUS]:{listen:[['listen',10],['notes',3]],notes:[['notes',10],['listen',3]],study:[['study',12],['rest',1,'break']],blackboard:[['blackboard',6],['teach',4],['prepare',1]],teach:[['teach',10],['blackboard',3],['prepare',1]],prepare:[['prepare',12],['rest',1,'break']]},
 [GYM]:{treadmill:[['treadmill',8],['stretch',2],['rest',1,'break']],weights:[['weights',8],['stretch',2],['rest',1,'break']],stretch:[['stretch',8],['rest',1,'break']]},
 [MARKET]:{produce:[['produce',3],['groceries',3],['cold',2]],groceries:[['groceries',5],['produce',2]],cold:[['cold',5],['groceries',2]],checkout:[['checkout',7]],cashier:[['cashier',12],['rest',1,'break']]},
 [LAB]:{bench:[['bench',6],['observation',2],['records',2],['break',1,'break']],observation:[['observation',8],['records',2],['break',1,'break']],computer:[['computer',12],['records',2],['break',1,'break']],records:[['records',12],['break',1,'break']]},
 [LIB]:{'desk-reading':[['desk-reading',12],['study-notes',2],['window-reading',2,'break']],'window-reading':[['window-reading',12],['choose-book',1],['window-reading',1],['window-reading',1,'break',{standing:true}]],'study-notes':[['study-notes',12],['desk-reading',3],['study-notes',1,'break']]},
 [CLINIC]:{casework:[['casework',9],['handoff',3],['duty',2],['rest',1,'break']],bedside:[['bedside',6],['casework',5],['rest',1,'break']],handoff:[['handoff',8],['casework',3],['rest',1,'break']],duty:[['duty',12],['handoff',2],['rest',1,'break']]},
 [STUDIO]:{easel:[['easel',8],['gallery',2],['drawing',2],['rest',1,'break']],drawing:[['drawing',10],['gallery',2],['rest',1,'break']],handcraft:[['handcraft',10],['gallery',2],['rest',1,'break']]},
 [REHEARSAL]:{practice:[['practice',8],['mirror',2],['score',2],['rest',1,'break']],mirror:[['mirror',8],['practice',2],['rest',1,'break']],piano:[['piano',12],['score',2],['rest',1,'break']],instruments:[['instruments',10],['score',2],['rest',1,'break']],score:[['score',10],['practice',2],['rest',1,'break']]},
 [STATION]:{waiting:[['waiting',12],['reading',2],['information',1]],reading:[['reading',12],['waiting',2],['information',1]],platform:[['platform',12],['waiting',2]],departure:[['waiting',8],['information',2],['departure',3]],luggage:[['waiting',12],['information',2]]}
};
const CONFIG={
 ...OCCUPATION_CONFIG,
 [FARM]:{entry:'entrance',prepare:p=>p.spot==='records'?'records':'supplies',tidy:p=>p.spot,exit:'exit'},
 [FLEA]:{entry:'entrance',prepare:p=>p.spot,tidy:()=> 'packing',exit:'exit',carry:'basket'},
 [OFFICE]:{carry:'book',entry:'entrance',prepare:p=>['meeting','meeting-notes','presentation'].includes(p.spot)?p.spot:'files',tidy:p=>p.spot,exit:'exit'},
 [CAMPUS]:{entry:'entrance',prepare:p=>['teach','blackboard','prepare'].includes(p.spot)?'prepare':'lockers',tidy:p=>['teach','blackboard','prepare'].includes(p.spot)?'prepare':'lockers',exit:'exit',carry:'book'},
 [GYM]:{entry:'entrance',prepare:p=>p.spot==='weights'?'take-weights':'storage',tidy:p=>p.spot==='weights'?'take-weights':'storage',exit:'exit'},
 [MARKET]:{entry:'entrance',prepare:p=>p.spot==='cashier'?'cashier':'basket',tidy:p=>p.spot==='cashier'?'cashier':'packing',exit:'exit',carry:'basket'},
 [LAB]:{carry:'sample',entry:'entrance',prepare:p=>['bench','observation'].includes(p.spot)?'materials':'archive',tidy:p=>p.spot,exit:'entrance'},
 [LIB]:{entry:'exit',prepare:()=> 'choose-book',tidy:()=> 'return-book',exit:'exit',carry:'book'},
 [CLINIC]:{entry:'entrance',prepare:()=> 'casefiles',tidy:()=> 'casefiles',exit:'entrance',carry:'clipboard'},
 [STUDIO]:{entry:'entrance',prepare:()=> 'materials',tidy:p=>p.spot==='easel'?'drying':'storage',exit:'exit'},
 [REHEARSAL]:{entry:'entrance',prepare:()=> 'score',tidy:()=> 'score',exit:'exit'},
 [STATION]:{entry:'entrance',prepare:()=> 'luggage',tidy:()=> 'luggage',exit:'departure',carry:'luggage'}
};

const DAILY_READ=[['read',7],['tea',1],['read',1],['rest',.7,'break'],['read',.3,'break',{standing:true,stroll:true}]];
const DAILY_REST=[['rest',3],['tea',1],['rest',.7,'break'],['rest',.3,'break',{standing:true,stroll:true}]];
const DAILY_MEAL=[['meal',5],['tea',.6],['rest',.4,'break']];
const DAILY_TEA=[['tea',2],['rest',.7,'break'],['tea',.3,'break',{standing:true,stroll:true}]];
const DAILY_GROUPS={
 dayHome:{read:DAILY_READ,rest:DAILY_REST,meal:DAILY_MEAL,tea:DAILY_TEA,work:[['rest',10,'work',{action:'work'}],['tea',1],['rest',1,'break'],['rest',.5,'break',{standing:true,stroll:true}]],cook:[['cook',4],['cook',.5,'break']],shower:[['shower',.75],['rest',3,'break']],toilet:[['toilet',.5],['wash-hands',.5],['rest',3,'break']],'wash-hands':[['wash-hands',.5],['rest',3,'break']]},
 dayWork:{work:[['work',10],['read',2],['rest',1.05,'break'],['work',.45,'break',{standing:true,stroll:true}]],read:[['read',8],['rest',.7,'break'],['read',.3,'break',{standing:true,stroll:true}]],rest:[['rest',4],['rest',1,'break',{standing:true,stroll:true}]]},
 dayCafe:{read:DAILY_READ,meal:DAILY_MEAL,tea:DAILY_TEA,rest:DAILY_REST},
 dayStreet:{walk:[['walk',4],['rest',1.5,'break']],rest:[['rest',4],['rest',1,'break',{standing:true,stroll:true}]]}
};
for(const kind of Object.keys(globalThis.CharDayHomeHobbies.activities))DAILY_GROUPS.dayHome[kind]=[[kind,['weights','stretch'].includes(kind)?5:10],['tea',1],[kind,1,'break',{standing:true}]];
const GROUP_LABELS={read:'阅读与整理',work:'工作与整理',practice:'练习与调整',exercise:'训练与放松',shop:'挑选与整理',wait:'候车与走动',rest:'休息与活动',walk:'散步与歇脚',meal:'用餐与稍歇',tea:'喝茶与稍歇',cook:'料理与等候',shower:'洗澡与休息',toilet:'如厕与洗手','wash-hands':'洗手与稍歇'};
export function activityConfig(map){return CONFIG[map]||null;}
export function activityGroup(p,space){
 if(p.action==='sleep')return null;
 const cfg=CONFIG[p.map],daily=DAILY_GROUPS[p.map]?.[p.action];
 let primary=p.spot||space?.spots.find(s=>s.action===p.action)?.id||space?.spots.find(s=>s.action==='rest')?.id;
 const recipe=RECIPES[p.map]?.[primary];
 let beats=daily||recipe;
 // A shelf, water point, or rest seat may also receive a long slot. Keep its
 // purpose and use a real rest anchor; never switch to another job's station.
 if(!beats&&space&&!['entrance','exit','departure'].includes(primary)){
  const rest=space.spots.find(s=>s.action==='rest'&&s.seat)?.id||primary;
  const drink=space.spots.find(s=>['tea','meal'].includes(s.action)&&s.seat&&s.action==='tea')?.id;
  beats=primary===rest&&drink?[[primary,8],[drink,1],[primary,.5,'break',{standing:true}]]:[[primary,8],[rest,1,'break'],[primary,.5,'break',{standing:true}]];
 }
 if(!beats)return null;
 if(space){
  const available=new Set(space.spots.map(s=>s.id));
  beats=beats.filter(([id])=>available.has(id));
  if(!beats.length)return null;
  const rest=space.spots.find(s=>s.action==='rest'&&s.seat)?.id;
  if(recipe&&rest&&!beats.some(b=>b[2]==='break'))beats=[...beats,[rest,1,'break']];
 }
 const label=GROUP_LABELS[p.action]||'做事与稍歇';
 const home=p.map==='dayHome',once=home&&!!CHORES[p.action]?.personal;
 const interrupts=home&&!once?(['meal','cook'].includes(p.action)?[{at:0,beats:[['wash-hands',.5]]}]:['read','rest','work','tea'].includes(p.action)?[{at:6,every:45,beats:[['toilet',.5],['wash-hands',.5]]},...(p.action==='rest'?[{at:14,beats:[['shower',.75]]}]:[])]:[]):[];
 const available=space&&new Set(space.spots.map(s=>s.id));
 if(once&&CHORES[beats.at(-1)[0]]?.personal)beats=[...beats,[beats.at(-1)[0],.1,'break',{action:'rest',standing:true}]];
 return {id:p.map+':'+(p.spot||p.action),label,beats,config:recipe?cfg:null,...(once?{once:true}:{}),interrupts:interrupts.map(q=>({...q,beats:q.beats.filter(([id])=>!available||available.has(id))})).filter(q=>q.beats.length)};
}

// All scenes use this selector. Bathroom visits are short inserts into the same
// read-only slot clock; reloads do not enqueue or replay finished visits.
export function activityBeat(group,elapsed){
 function choose(beats,cycle){for(const [id,length,phase,options]of beats){if(cycle<length)return {id,length,phase,options:options||{},cycle};cycle-=length;}return null;}
 for(const q of group.interrupts||[]){if(elapsed<q.at)continue;const cycle=q.every?(elapsed-q.at)%q.every:elapsed-q.at,beat=choose(q.beats,cycle);if(beat)return beat;}
 const duration=group.beats.reduce((n,b)=>n+b[1],0);
 if(group.once&&elapsed>=duration){const [id,length,phase,options]=group.beats.at(-1);return {id,length,phase,options:options||{},cycle:elapsed-duration};}
 return choose(group.beats,group.once?elapsed:elapsed%duration);
}
