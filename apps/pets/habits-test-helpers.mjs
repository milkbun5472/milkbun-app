// Test fixtures use the public career/care/town writers, never a fabricated job or habit.
import{createPetCareer}from'./career.mjs?v=fg-8c013226fd2a4c96';import{createPetCare}from'./care.mjs?v=fg-8c013226fd2a4c96';import{createTownLife,newTownLife}from'./town-life.mjs?v=fg-8c013226fd2a4c96';import{workRoom}from'./workplaces.mjs?v=fg-8c013226fd2a4c96';
export function writeHabitShift(id,world,{seed=1,keep=true}={}){
 let body,career,town;for(let rng=seed;rng<seed+100;rng++){body=createPetCare({energy:100,mood:100,satiety:80},{real:true});career=createPetCareer({rng,selected:id,balance:100});town=createTownLife(newTownLife(workRoom(id),{x:-.28,z:.55},1),{world});const ctx={care:body.state,room:town.state.place,position:town.state.position};if(id==='stall'){career.request('stall-pack',{item:'snack',delta:1},ctx);career.request('stall-pack',{item:'snack',delta:1},ctx);}if(career.request('invite',{},ctx).accepted)break;}
 const ctx=()=>({care:body.state,room:town.state.place,position:town.state.position});let rounds=0;
 while(career.state.job?.phase!=='ready'){
  if(++rounds>20)throw Error('fixture choices stalled: '+id);
  for(let i=0;i<30000&&career.state.job.phase==='working';i++){
   if(!career.atDestination(ctx())&&(!town.state.goal||town.state.target!==career.destination()))town.go(career.destination(),career.destinationPoint());
   town.tick(.2,{blocked:career.atDestination(ctx()),stayHome:true,position:town.state.position,heading:town.state.heading});career.tick(.2,ctx());
  }
  if(career.state.job.phase!=='choice')throw Error('fixture route stalled: '+id);
  const e=career.summary().event,pick=e.options.find(o=>o.id===(id==='stall'&&keep?'keep':e.kind==='deduction'?'leave':'redirect'))||e.options.find(o=>['deliver','gentle'].includes(o.id))||e.options[0];if(!career.request('choose',{eventId:e.id,choice:pick.id},ctx()).accepted)throw Error('fixture decision rejected: '+pick.id);
 }
 if(career.summary().event?.kind==='deduction'){const e=career.summary().event;career.request('choose',{eventId:e.id,choice:'leave'},ctx());}
 if(!career.request('finish',{},ctx()).accepted)throw Error('fixture finish rejected');
 // Buy through the original treasury writer; this is the actually owned toy used by stash.
 career.request('buy',{item:'toy'},ctx());if(id==='stall')career.request('buy',{item:'box'},ctx());
 return {body,career,town};
}
