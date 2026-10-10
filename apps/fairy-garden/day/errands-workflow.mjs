// These tasks are a visual projection of the current schedule, never a workout or purchase ledger.
export function errandsTaskAt(stage,spot,map,elapsed,{moving=false}={}){
 if(!['dayGym','dayMarket'].includes(stage.map))return undefined;
 if(!stage.motion&&!stage.carry)return null;
 const kind=moving?'carry':stage.motion||'carry',progress=['weight-pick','weight-return','basket-pick','market-pack'].includes(kind)?Math.min(1,elapsed/4):(elapsed/4)%1;
 const task={kind,elapsed,progress,furniture:spot?.furniture,spot:stage.spot,phase:stage.phase,carryType:stage.carryType,carry:!!stage.carry};
 if(stage.map==='dayGym'){
  task.weights=kind==='weights'||['weight-pick','weight-return'].includes(kind)&&progress>.6||moving&&stage.carryType==='weights'&&stage.carry;
  if(kind==='weight-return')task.weights=progress<.6;
  if(!moving&&['weight-pick','weight-return'].includes(kind)){const p=map.furniture.find(f=>f.id===spot?.furniture),w=p?.work?.[spot.id];if(w){task.contact={x:p.x+w.x,y:map.floor+w.y,z:p.z+w.z};task.target={...task.contact};task.leftTarget={...task.target,x:p.x-w.x};}}
  return task;
 }
 const p=map.furniture.find(f=>f.id===spot?.furniture),work=p?.work?.[stage.spot];
 task.basket=stage.carryType==='basket'&&(kind==='basket-pick'?progress>.55:!['enter','prepare'].includes(stage.phase)&&kind!=='market-pack'&&stage.spot!=='exit');
 task.bag=stage.carryType==='basket'&&(kind==='market-pack'&&progress>.55||stage.spot==='exit');
 if(work){task.contact={x:p.x+work.x,y:map.floor+work.y,z:p.z+work.z};if(kind==='basket-pick')task.leftTarget={...task.contact};else task.target={...task.contact};}
 task.product=!moving&&['market-pick','checkout','market-pack'].includes(kind)&&progress>.38&&progress<.82;
 return task;
}
