// Only the gesture lives here. The original drawBottle transaction owns all rewards.
export function createScoop(){
 let stage='aim',elapsed=0;
 return {get stage(){return stage;},get progress(){return Math.min(1,elapsed/1.25);},
 release(distance){if(stage!=='aim')return false;if(!Number.isFinite(distance)||distance>.58)return false;stage='lift';return true;},
 tick(dt,commit){if(stage!=='lift')return;elapsed+=Math.max(0,Math.min(.1,dt));if(elapsed>=1.25){stage='done';commit();}},
 snapshot(){return {stage,progress:this.progress};}};
}
