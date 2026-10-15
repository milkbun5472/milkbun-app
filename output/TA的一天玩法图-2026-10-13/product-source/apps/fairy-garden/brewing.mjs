// Inventory rules and the hands-on sequence are separate: previews never spend materials.
export const BREWS=Object.freeze({sand:{name:'星砂月露',items:[{key:'sand',label:'星砂',count:3,color:'#e6c47f'}]},herbs:{name:'草木月露',items:[{key:'herbs',label:'铃叶草',count:2,color:'#90bb8c'},{key:'mushrooms',label:'荧光菇',count:1,color:'#b4abdd'},{key:'water',label:'清水',count:1,color:'#a4dadd'}]}});
export const brewKey=s=>s.sand>=3?'sand':'herbs';
export function brewError(s,key=brewKey(s)){const r=BREWS[key];return !r?'没有这种月露配方。':r.items.some(x=>(s[x.key]||0)<x.count)?'月露配方：铃叶草 ×2、荧光菇 ×1、清水 ×1；或者星砂 ×3。':'';}
export function brewResult(s,key=brewKey(s)){if(brewError(s,key))return s;const next={...s,potions:s.potions+1};for(const x of BREWS[key].items)next[x.key]-=x.count;return next;}
export function createBrewSequence(items){
 let stage='ingredients',added=new Set(),turn=0,last=null,direction=0,pour=0,committed=false;
 return {get stage(){return stage;},get turn(){return turn;},get pour(){return pour;},get count(){return added.size;},
  add(i){if(stage!=='ingredients'||!Number.isInteger(i)||i<0||i>=items.length||added.has(i))return false;added.add(i);if(added.size===items.length)stage='stir';return true;},
  release(){last=null;},
  stir(angle){if(stage!=='stir'||!Number.isFinite(angle))return;if(last!==null){const d=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));if(Math.abs(d)<.7){const sign=Math.sign(d);if(sign&&direction&&sign!==direction)turn=Math.max(0,turn-Math.abs(d));else turn+=Math.abs(d);if(sign)direction=sign;}}last=angle;if(turn>=Math.PI*4){stage='ready';last=null;}},
  assist(dt){if(stage==='stir'){turn+=Math.max(0,Math.min(dt,.05))*2.5;if(turn>=Math.PI*4)stage='ready';}},
  finish(){if(stage!=='ready')return false;stage='pour';return true;},
  tick(dt,commit){if(stage!=='pour')return;pour=Math.min(1,pour+Math.max(0,Math.min(dt,.05))/2.6);if(pour===1&&!committed){committed=true;stage='done';return commit();}},
  snapshot(){return {stage,added:[...added],turn,pour,committed};}
 };
}
