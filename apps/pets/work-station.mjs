import {roomPoint} from './room-layout.mjs?v=fg-a12fdcde83e5b78e';
// Floor positions beside the authored furniture, transformed with that room.
// The same target gates live work and offline recovery; no work is credited at
// the entry door. People retain their space through the shared navigation.
const STATIONS={
 bakery:{zone:'counter',label:'面包柜台',focus:{x:1.25,z:-.72},points:[[0,.65],[-.8,.95],[.85,.65]]},
 florist:{zone:'worktable',label:'包花台旁',focus:{x:1.15,z:-1.22},points:[[-.8,.6],[.6,.45],[1.6,.9]]},
 store:{zone:'checkout',label:'收银台旁',focus:{x:1.68,z:-.1},points:[[-.3,.85],[-1,.9],[.2,.85]]},
 cafe:{zone:'bar',label:'咖啡柜台',focus:{x:1.03,z:-1.24},points:[[1.55,.7],[.1,.7],[.75,.85]]},
 alley:{zone:'clues',label:'线索旁',focus:{x:-2.62,z:-.45},points:[[-1.5,.3],[.4,-.35],[1.65,.35]]}
};
export function petWorkStation(job,navigation,position=null,{moving=false}={}){
 const spec=STATIONS[job?.profession];if(!spec)return null;
 const [x,z]=spec.points[Math.max(0,Math.min(2,job.index||0))],anchor=roomPoint(job.profession,spec.zone,{x,z}),focus=roomPoint(job.profession,spec.zone,spec.focus);
 // An established, clear stance remains the actual work position. Moving
 // people must not make it chase the originally preferred anchor every frame.
 const settled=position&&!moving&&(job.time>0||['choice','ready'].includes(job.phase))&&Math.hypot(position.x-anchor.x,position.z-anchor.z)<=1.2&&navigation.walkable(position.x,position.z)&&navigation.clearPoint(position);
 const point=settled?{...position}:navigation.freePoint(anchor,anchor);
 return {label:spec.label,point,heading:point?Math.atan2(focus.x-point.x,focus.z-point.z):0};
}
