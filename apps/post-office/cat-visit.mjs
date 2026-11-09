import {COUNTER_SURFACE,SHOP_FLOOR} from './furniture.mjs?v=fg-f1dad9727add9f99';
export const CAT_APPROACH={x:1.04,z:1.95},CAT_COUNTER={x:.14,z:1.2};
const RISE=COUNTER_SURFACE-SHOP_FLOOR;
export const isPostalCat=u=>u?.kind==='guest'&&!u.visitor&&u.npcStyle==='rare_cat'&&u.look?.npcSpecies==='cat';
export function stepCatVisit(u,dt,{go}={}){
 if(!isPostalCat(u)||u.phase==='waiting-entry'||u.phase==='leaving')return;
 if(u.phase==='queuing'&&u.arrived){u.phase='cat-jump';u.catTime=0;u.catFrom={...u.position};u.heading=Math.atan2(CAT_COUNTER.x-u.position.x,CAT_COUNTER.z-u.position.z);u.path=[];}
 if(u.phase==='cat-jump'){
  u.catTime+=dt;const t=Math.min(1,u.catTime/.7);u.position={x:u.catFrom.x+(CAT_COUNTER.x-u.catFrom.x)*t,z:u.catFrom.z+(CAT_COUNTER.z-u.catFrom.z)*t};u.catHeight=RISE*t+Math.sin(t*Math.PI)*.32;
  if(t===1){u.phase='cat-counter';u.catTime=0;u.arrived=true;}
 }else if(u.phase==='cat-counter'){
  u.catTime+=dt;u.catHeight=RISE;u.bubble=u.catTime>.85&&u.catTime<1.55?'喵':'';u.catDropProgress=Math.max(0,Math.min(1,(u.catTime-.4)/.35));
  if(u.catDropProgress===1)u.catLeafDropped=true;
  if(u.catTime>1.9){u.phase='cat-down';u.catTime=0;u.catFrom={...u.position};u.bubble='';u.heading=Math.atan2(CAT_APPROACH.x-u.position.x,CAT_APPROACH.z-u.position.z);}
 }else if(u.phase==='cat-down'){
  u.catTime+=dt;const t=Math.min(1,u.catTime/.6);u.position={x:u.catFrom.x+(CAT_APPROACH.x-u.catFrom.x)*t,z:u.catFrom.z+(CAT_APPROACH.z-u.catFrom.z)*t};u.catHeight=RISE*(1-t)+Math.sin(t*Math.PI)*.18;
  if(t===1){u.catHeight=0;u.phase='leaving';u.letter=false;go(u,{x:3.32,z:4.7});}
 }
}
