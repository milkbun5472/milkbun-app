// Scene-only coordination. It never changes a calendar, conversation or identity.
export function canTravelTogether(before,after,visitor,policy){
 return !!(before&&after&&before.charId===after.charId&&before.presentation.map!==after.presentation.map&&
  policy.setting(before)&&policy.setting(after)&&visitor?.present&&!visitor.leaving&&
  after.socialPreferences?.followDates!==false&&
  !(after.presentation.map==='dayHome'&&after.visitorData?.homePresence==='away'));
}
export function createAutoInteraction(){
 let wait=18,index=0;
 return {
  reset(){wait=18;},
  tick(dt,{enabled,eligible,visitor,ready,actions,start}){
   if(!enabled||!eligible||!visitor?.present||visitor?.control!=='auto'){wait=18;return false;}
   if(!ready||visitor.busy||visitor.leaving||visitor.interaction)return false;
   wait-=Math.max(0,dt);if(wait>0)return false;
   wait=42;
   const kinds=['look','cup','closer'].filter(kind=>actions.some(a=>a.kind===kind));
   for(let n=0;n<kinds.length;n++)if(start(kinds[index++%kinds.length]).ok)return true;
   return false;
  }
 };
}
