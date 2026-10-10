// These phases are visual projections of one existing schedule interval.
export const OCCUPATION_RECIPES={
 dayInvestigation:{clues:[['clues',8],['notes',2],['rest',1,'break']],notes:[['notes',12],['files',1],['rest',1,'break']],computer:[['computer',12],['notes',2],['rest',1,'break']],briefing:[['briefing',10],['duty',2]],duty:[['duty',12],['rest',1,'break']]},
 dayService:{prep:[['prep',10],['wash',1],['rest',1,'break']],cook:[['cook',10],['prep',2],['wash',1],['rest',1,'break']],coffee:[['coffee',8],['serve',2],['wash',1],['rest',1,'break']],mix:[['mix',8],['serve',2],['wash',1],['rest',1,'break']],serve:[['serve',10],['cashier',2],['rest',1,'break']],cashier:[['cashier',12],['rest',1,'break']]},
 dayFilm:{makeup:[['makeup',10],['costume',1],['rest',1,'break']],script:[['script',12],['rest',1,'break']],perform:[['perform',10],['script',2],['rest',1,'break']],pose:[['pose',10],['rest',1,'break']],camera:[['camera',10],['review',2],['lighting',1],['rest',1,'break']],review:[['review',12],['rest',1,'break']]},
 dayBroadcast:{script:[['script',12],['rest',1,'break']],voice:[['voice',10],['script',2],['rest',1,'break']],sing:[['sing',10],['script',2],['rest',1,'break']],mix:[['mix',12],['rest',1,'break']],stream:[['stream',12],['rest',1,'break']],edit:[['edit',12],['rest',1,'break']]}
};
export const OCCUPATION_CONFIG={
 dayInvestigation:{entry:'entrance',prepare:p=>p.spot==='briefing'?'duty':'files',tidy:()=> 'files',exit:'exit',carry:'book'},
 dayService:{entry:'entrance',prepare:p=>['prep','cook'].includes(p.spot)?'storage':p.spot,tidy:p=>p.spot==='cashier'?'cashier':'wash',exit:'exit'},
 dayFilm:{entry:'entrance',prepare:p=>['camera','review'].includes(p.spot)?'lighting':p.spot==='makeup'?'costume':'script',tidy:p=>['camera','review'].includes(p.spot)?'camera':'costume',exit:'exit'},
 dayBroadcast:{entry:'entrance',prepare:()=> 'gear',tidy:()=> 'gear',exit:'exit'}
};
export const OCCUPATION_MOTIONS={
 dayInvestigation:{clues:'investigate',notes:'write',computer:'type',files:'select',evidence:'select',briefing:'present',duty:'write'},
 dayService:{storage:'select',prep:'prep',cook:'cook',wash:'wash',coffee:'barista',mix:'shake',serve:'serve',cashier:'cashier'},
 dayFilm:{makeup:'makeup',script:'read',costume:'select',perform:'act',pose:'pose',camera:'camera',lighting:'select',review:'type'},
 dayBroadcast:{gear:'select',script:'read',voice:'voice',sing:'sing',mix:'console',stream:'stream',edit:'type'}
};
export function occupationMotion(map,spot,text){
 if(map==='dayBroadcast'&&spot==='stream'&&/游戏|电竞|实况|打游戏/.test(text))return 'type';
 return OCCUPATION_MOTIONS[map]?.[spot]||null;
}
export function isOccupation(map){return Object.hasOwn(OCCUPATION_CONFIG,map);}
export function occupationTask(task,map,spot,p){
 if(!isOccupation(map.id||map.renderer))return task;
 const kind=task.kind,contact=task.contact;
 if(['prep','cook'].includes(kind)){
  task.daily=true;task.carry=false;task.progress=task.elapsed/(kind==='cook'?7:5)%1;
  task.target={...contact,y:contact.y+(kind==='cook'?.14:.18),z:contact.z+(kind==='prep'?.10:0)};
  if(kind==='cook')task.pot={...contact,y:contact.y-.07};
 }
 if(['barista','console','wash','camera'].includes(kind))task.target={...contact,y:contact.y+.035};
 if(kind==='investigate'){task.target={...contact,z:contact.z+.13};task.tool='marker';}
 if(kind==='serve'||kind==='shake'){
  const grip=kind==='shake'?.06:.16;task.target={...contact,x:contact.x+grip,y:contact.y+.16};task.leftTarget={...task.target,x:contact.x-grip};task.carry=false;
 }
 if(kind==='stream'){
  // One hand remains near the keyboard; the other can speak to the camera.
  task.leftTarget={...contact,x:contact.x+.25};task.target=null;
 }
 if(['voice','sing','act','pose','makeup'].includes(kind))task.target=null;
 return task;
}
