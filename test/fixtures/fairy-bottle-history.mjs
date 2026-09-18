import {freshState,sealBottle,keepBottleReply,drawBottle,restoreState,BOTTLE_DAYS} from '../../apps/fairy-garden/world.mjs';
// Every letter passes the production writers. Only game dates and reply text are test inputs.
export function bottleHistory(size=145){
 let s=freshState();
 for(let i=0;i<size;i++){
  s={...s,day:s.day+1,today:{}};
  s=sealBottle(s,'原句编号'+String(i).padStart(3,'0'));
  const b=s.bottles[0];s={...s,day:s.day+BOTTLE_DAYS};
  if(b.replyWanted)s=keepBottleReply(s,b.id,'回信编号'+String(i).padStart(3,'0')+'，'+ '测试用的长信正文。'.repeat(55),'署名'+i);
  s=drawBottle(s);
 }
 return restoreState(s);
}
