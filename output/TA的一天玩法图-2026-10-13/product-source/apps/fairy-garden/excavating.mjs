// Brushing is a temporary gesture; perform('gather') remains the only reward writer.
export const DUST_PATCHES=Object.freeze(Array.from({length:49},(_,i)=>({x:(i%7-3)*.18,z:(Math.floor(i/7)-3)*.18})).filter(p=>Math.hypot(p.x,p.z)<.62));
export function createExcavation(){
 const cleared=new Set();let stage='brush',elapsed=0,assist=0;
 return {get stage(){return stage;},get progress(){return cleared.size/DUST_PATCHES.length;},get lift(){return Math.min(1,elapsed/1.25);},
 brush(x,z){if(stage!=='brush'||!Number.isFinite(x)||!Number.isFinite(z))return 0;let count=0;DUST_PATCHES.forEach((p,i)=>{if(!cleared.has(i)&&Math.hypot(x-p.x,z-p.z)<.19){cleared.add(i);count++;}});if(this.progress>=.88)stage='ready';return count;},
 help(dt){if(stage!=='brush')return;assist+=Math.max(0,Math.min(.1,dt));if(assist>.12){assist=0;const p=DUST_PATCHES.find((_,i)=>!cleared.has(i));if(p)this.brush(p.x,p.z);}},
 finish(){if(stage!=='ready')return false;stage='lift';return true;},
 tick(dt,commit){if(stage!=='lift')return;elapsed+=Math.max(0,Math.min(.1,dt));if(elapsed>=1.25){stage='done';return commit();}},
 snapshot(){return {stage,progress:this.progress,lift:this.lift,cleared:[...cleared]};}};
}
