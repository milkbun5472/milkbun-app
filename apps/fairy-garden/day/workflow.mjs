// These phases describe the current task's visual process, without writing a schedule.
const LAB='dayLaboratory',LIB='dayLibrary';
const RECIPES={
  [LAB]:{
    bench:[['bench',6],['observation',2],['records',2],['break',1]],
    observation:[['observation',8],['records',2],['break',1]],
    computer:[['computer',12],['records',2],['break',1]],
    records:[['records',12],['break',1]]
  },
  [LIB]:{
    'desk-reading':[['desk-reading',12],['study-notes',2],['desk-reading',2]],
    'window-reading':[['window-reading',14],['window-reading',1]],
    'study-notes':[['study-notes',12],['desk-reading',3],['study-notes',1]]
  }
};
const MOTIONS={
  [LAB]:{bench:'experiment',observation:'observe',computer:'type',records:'write',archive:'select',materials:'select'},
  [LIB]:{'choose-book':'select','desk-reading':'read','study-notes':'write','window-reading':'read','return-book':'return'}
};
const LABELS={enter:'走进来',prepare:'准备资料',work:'做事',break:'稍歇一会儿',tidy:'收拾与归还',exit:'准备离开'};
export function workMotion(map,spot){return MOTIONS[map]?.[spot]||null;}
export function activityPhase(p,slot,at,{preview=false}={}){
  const plain={...p,phase:'work',phaseLabel:LABELS.work,motion:workMotion(p.map,p.spot),carry:p.map===LIB&&p.spot==='return-book'};
  const recipe=RECIPES[p.map]?.[p.spot];
  if(!recipe||!slot||preview||!Number.isFinite(slot.startAt)||!Number.isFinite(slot.endAt)||!Number.isFinite(at))return plain;
  const span=(slot.endAt-slot.startAt)/60000,elapsed=(at-slot.startAt)/60000;
  if(span<=0||elapsed<0||elapsed>=span)return {...p,motion:null,carry:false};
  const edge=Math.min(1.5,span*.12),entry=edge/3,closing=span-edge;
  let spot=p.spot,phase='work',motion=plain.motion,carry=p.map===LIB;
  if(elapsed<entry){spot=p.map===LAB?'entrance':'exit';phase='enter';motion=null;carry=false;}
  else if(elapsed<edge){spot=p.map===LIB?'choose-book':['bench','observation'].includes(p.spot)?'materials':'archive';phase='prepare';motion='select';carry=false;}
  else if(elapsed>=span-entry){spot=p.map===LAB?'entrance':'exit';phase='exit';motion=null;carry=false;}
  else if(elapsed>=closing){spot=p.map===LIB?'return-book':p.spot;phase='tidy';motion=p.map===LIB?'return':'tidy';}
  else{
    const duration=recipe.reduce((n,b)=>n+b[1],0);let cycle=(elapsed-edge)%duration;
    for(let i=0;i<recipe.length;i++){
      const [id,length]=recipe[i];if(cycle<length){spot=id;phase=p.map===LAB&&id==='break'||p.map===LIB&&i===recipe.length-1?'break':'work';motion=phase==='break'?null:workMotion(p.map,spot);break;}cycle-=length;
    }
  }
  return {...p,spot,phase,phaseLabel:LABELS[phase],motion,carry};
}
export function taskAt(stage,spot,map,elapsed,{moving=false}={}){
  if(!stage.motion&&!stage.carry)return null;
  const kind=moving?'carry':stage.motion||'carry';
  const origin=spot?.seat||spot?.target||map.spawn,heading=spot?.heading||0;
  const s=Math.sin(heading),c=Math.cos(heading),forward=kind==='select'?.16:kind==='return'?.17:kind==='type'?.13:kind==='observe'?.18:.18;
  const p=map.furniture?.find(f=>f.id===spot?.furniture),top=map.floor+(p?.top??(kind==='select'?1.15:.85));
  const localX=kind==='experiment'?.15:kind==='write'?.12:.12;
  const target={x:origin.x+localX*c+forward*s,y:top+(kind==='write'?.11:kind==='experiment'?.13:kind==='select'?-.24:.05),z:origin.z-localX*s+forward*c};
  return {kind,carry:!!stage.carry||kind==='select'&&stage.map===LIB&&elapsed>=2.5,progress:['select','return','tidy'].includes(kind)?Math.min(1,elapsed/5):elapsed/5%1,target,contact:{x:origin.x+localX*c+.37*s,y:top+.04,z:origin.z-localX*s+.37*c}};
}
