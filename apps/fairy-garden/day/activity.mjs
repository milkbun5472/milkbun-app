import {DUR,EXTRA_ACTIONS} from '../../companion/motion.mjs?v=fg-3d4a02824fdd16a8';

// Cosmetic movement stays inside the current schedule scene; it does not invent tasks or moods.
const WORK_BEATS=[
  {emotion:'chin',duration:EXTRA_ACTIONS.chin.duration},
  {emotion:'peek',duration:EXTRA_ACTIONS.peek.duration},
  {duration:2.6}
];
export function activityPose(p,elapsed,{hasSlot=true,seated=false}={}){
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
