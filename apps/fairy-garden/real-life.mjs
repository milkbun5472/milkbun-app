import {syncRealWorld} from './world.mjs?v=fg-5bbee1935867dc12';
import {makeCompanionController} from './companion.mjs?v=fg-5bbee1935867dc12';
export function recoverGardenLife(state,at=Date.now()){
 if(!state.clock||!state.lifeAt||at-state.lifeAt<60000)return {...state,lifeAt:at};
 let out=state,cursor=Math.max(state.lifeAt,at-3*86400000);const controller=makeCompanionController();
 while(cursor<at){const end=Math.min(at,cursor+900000),seconds=(end-cursor)/1000;
  out=syncRealWorld({...out,clock:{...out.clock,day:out.clock.startDay},routineAt:end},end);
  if(out.companion.mode==='routine')for(let i=0;i<Math.min(seconds,180)*10;i++){const result=controller.tick(out,.1,{allowCare:false,autonomous:true});out=result.state;if(!controller.view().moving&&i>100)break;}
  cursor=end;
 }
 const {routineAt,...saved}=out;return {...syncRealWorld(saved,at),lifeAt:at};
}
