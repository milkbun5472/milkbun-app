import {DUR,EXTRA_ACTIONS} from '../../companion/motion.mjs?v=fg-03615deb8e6d070f';

// Cosmetic movement stays inside the current schedule scene; it does not invent tasks or moods.
const WORK_BEATS=[
  {emotion:'chin',duration:EXTRA_ACTIONS.chin.duration},
  {emotion:'peek',duration:EXTRA_ACTIONS.peek.duration},
  {duration:2.6}
];
export function activityPose(p,elapsed,{hasSlot=true,seated=false}={}){
  if(p.phase==='break')return {gesture:p.standing&&elapsed<6?'stretch':'rest',progress:Math.min(1,elapsed/6),emotion:null};
  const base={gesture:p.gesture||'rest',progress:elapsed/4%1};
  if(p.action==='work'&&hasSlot&&!seated){
    let phase=Math.max(0,elapsed)%WORK_BEATS.reduce((n,b)=>n+b.duration,0);
    for(const beat of WORK_BEATS){
      if(phase<beat.duration)return {...base,emotion:beat.emotion||null,progress:phase/beat.duration};
      phase-=beat.duration;
    }
  }
  if(!hasSlot||p.action==='rest'){
    const phase=Math.max(0,elapsed)%(DUR.stretch+12);
    if(phase<DUR.stretch)return {gesture:'stretch',progress:phase/DUR.stretch};
  }
  return base;
}
