// Scene-only coordination. It never changes a calendar, conversation or identity.
export function canTravelTogether(before,after,visitor,policy){
 return !!(before&&after&&before.charId===after.charId&&before.presentation.map!==after.presentation.map&&
  policy.setting(before)&&policy.setting(after)&&visitor?.present&&!visitor.leaving&&
  after.socialPreferences?.followDates!==false&&
  !(after.presentation.map==='dayHome'&&after.visitorData?.homePresence==='away'));
}
export function automaticPairChoices(actions,{posture='stand',sleeping=false,style='gentle',last=''}={}){
 const rest=globalThis.CharDaySocial?.rest||{};
 return actions.filter(({kind})=>!['cook','meal','browse','stretch'].includes(kind)&&(!sleeping||rest[kind]?.quiet)&&
  (posture!=='lie'||rest[kind]?.posture==='lie')).map(({kind})=>{
   const p=rest[kind]?.posture,fit=p===posture||posture==='sit'&&['hand','pat','shoulder','cuddle'].includes(kind);
   return {kind,weight:(fit?4:p? .65:1)*(style==='clingy'&&/hug|lean|cuddle|hand/.test(kind)?1.7:1)*(kind===last?.08:1)};
  });
}
export function createAutoInteraction({random=Math.random}={}){
 let wait=18,last='';
 return {
  reset(){wait=18;},
  tick(dt,{enabled,eligible,visitor,ready,actions,start,posture='stand',sleeping=false,profile={}}){
   if(!enabled||!eligible||!visitor?.present||visitor?.control!=='auto'){wait=18;return false;}
   if(!ready||visitor.busy||visitor.leaving||visitor.interaction)return false;
   wait-=Math.max(0,dt);if(wait>0)return false;
   const style=profile?.style||'gentle',chance={shy:.34,gentle:.58,active:.78,clingy:.88}[style]||.58;
   wait=42+random()*28+(style==='shy'?15:0);
   if(random()>chance)return false;
   const choices=automaticPairChoices(actions,{posture,sleeping,style,last});
   while(choices.length){let pick=random()*choices.reduce((n,q)=>n+q.weight,0),index=0;while(index<choices.length-1&&pick>=choices[index].weight)pick-=choices[index++].weight;
    const [{kind}]=choices.splice(index,1);
    if(start(kind,{automatic:true,initiator:'a'}).ok){last=kind;return true;}
   }
   return false;
  }
 };
}
