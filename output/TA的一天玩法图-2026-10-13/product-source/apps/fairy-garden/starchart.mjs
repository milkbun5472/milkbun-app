// 星图那一夜的手感（她 2026-09-18：「不然一直点点点好单调」）。
// 纯状态机：六片星图散在桌上，一片片拖到自己的位置；拼齐才亮，亮了才结算。
// ⚠️只管手感，不管资格：攒够没有、两个人在不在旧塔、是不是夜里，全在 world.starNightReady。
//   完成时才 commit 一次；中途关掉零消耗，跟画咒那套一个约定。
const SLOTS=6,RADIUS=.78,SNAP=.3,SPREAD=1.55;
const seeded=key=>{let h=2166136261;for(const ch of String(key))h=Math.imul(h^ch.charCodeAt(0),16777619);return ()=>{h=Math.imul(h^(h>>>13),16777619)>>>0;return h/4294967296;};};
export function createStarChart(seed='night'){
 const rand=seeded(seed);
 const slots=Array.from({length:SLOTS},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/SLOTS;return {x:Math.cos(a)*RADIUS,y:Math.sin(a)*RADIUS};});
 // 散开时避开正中间那一圈，不然一开始就有两片压在自己的位置上
 const pieces=slots.map((slot,i)=>{let x,y;do{x=(rand()*2-1)*SPREAD;y=(rand()*2-1)*SPREAD*.7;}while(Math.hypot(x-slot.x,y-slot.y)<SNAP*1.6);return {x,y,placed:false,slot:i};});
 let stage='place',held=-1,elapsed=0,assist=0;
 const placed=()=>pieces.filter(p=>p.placed).length;
 return {slots,pieces,get stage(){return stage;},get held(){return held;},get count(){return placed();},
  get progress(){return stage==='send'?Math.min(1,elapsed/2.2):placed()/SLOTS;},
  grab(x,y){if(stage!=='place'||!Number.isFinite(x)||!Number.isFinite(y))return false;let best=-1,bd=SNAP;pieces.forEach((p,i)=>{if(p.placed)return;const d=Math.hypot(x-p.x,y-p.y);if(d<bd){bd=d;best=i;}});held=best;return held>=0;},
  drag(x,y){if(held<0||!Number.isFinite(x)||!Number.isFinite(y))return;const p=pieces[held];p.x=Math.max(-SPREAD,Math.min(SPREAD,x));p.y=Math.max(-SPREAD,Math.min(SPREAD,y));},
  drop(){if(held<0)return false;const p=pieces[held],s=slots[p.slot];held=-1;if(Math.hypot(p.x-s.x,p.y-s.y)<=SNAP){p.x=s.x;p.y=s.y;p.placed=true;if(placed()===SLOTS)stage='ready';return true;}return false;},
  help(dt){if(stage!=='place')return;assist+=Math.max(0,Math.min(.1,dt));if(assist>=.6){assist=0;const p=pieces.find(x=>!x.placed);if(p){held=-1;p.x=slots[p.slot].x;p.y=slots[p.slot].y;p.placed=true;if(placed()===SLOTS)stage='ready';}}},
  send(){if(stage!=='ready')return false;stage='send';return true;},
  tick(dt,commit){if(stage!=='send')return;elapsed+=Math.max(0,Math.min(.1,dt));if(elapsed>=2.2){stage='done';return commit();}},
  snapshot(){return {stage,count:placed(),held,progress:this.progress,pieces:pieces.map(p=>({x:p.x,y:p.y,placed:p.placed}))};}};
}
