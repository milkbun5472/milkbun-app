// Formal shifts share the career writer with accompanied trials.
export const autonomousWork=job=>job?.type==='shift';
export function chooseWorkOption(job,event,care,random){
 if(!event?.options.length)return null;
 if(event.kind==='deduction')return event.options.find(o=>o.id==='leave')||null;
 if(job.profession==='courier'){
  const preferred=job.index===0?'check':job.index===2?(care.energy<45?'easy':'receipt'):job.delivery.activeWrong?'redirect':job.delivery.issue==='absent'&&!job.delivery.attempts?'revisit':care.energy<45?'gentle':'deliver';
  const option=event.options.find(o=>o.id===preferred);if(option)return option;
 }
 if(job.profession==='stall'&&job.index===1&&job.market.offers[job.market.cursor]?.reluctant)return event.options.find(o=>o.id==='keep')||null;
 const weights=event.options.map(o=>1+(o.trait?(care.traits[o.trait]||0)*3:0)+(o.like||0)*4+(care.energy<45?Math.max(0,o.energy||0):0));
 let pick=random()*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<weights.length;i++){pick-=weights[i];if(pick<0)return event.options[i];}
 return event.options.at(-1);
}
