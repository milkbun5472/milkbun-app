// A case owns prose and deduction facts; wages, traits and actions stay in the local career engine.
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max?v.trim():null;
export function normalizeCase(raw){
 if(!raw||typeof raw!=='object')return null;
 const id=text(raw.id,1,80),title=text(raw.title,2,48),intro=text(raw.intro,4,360),ending=text(raw.ending,4,500),hint=text(raw.hint,4,180);
 if(!id||!title||!intro||!ending||!hint||!Array.isArray(raw.clues)||raw.clues.length!==3||!Array.isArray(raw.options)||raw.options.length!==3)return null;
 const clues=raw.clues.map(x=>text(x,4,240)),options=raw.options.map(x=>({id:text(x?.id,1,24),label:text(x?.label,3,100)}));
 if(clues.some(x=>!x)||new Set(clues).size!==3||options.some(x=>!x.id||!x.label||x.id==='leave')||new Set(options.map(x=>x.id)).size!==3||new Set(options.map(x=>x.label)).size!==3||!options.some(x=>x.id===raw.answer))return null;
 const source=['local','series','model'].includes(raw.source)?raw.source:'classic';
 const c={id,title,intro,clues,options,answer:raw.answer,ending,hint,source,family:text(raw.family,1,40)||source};
 if(source==='model'){
  const ids=options.map(x=>x.id),proof=raw.proof;
  if(!Array.isArray(proof)||proof.length!==3)return null;
  const valid=list=>Array.isArray(list)&&new Set(list).size===list.length&&list.every(x=>ids.includes(x));
  if(proof.some(x=>!valid(x?.supports)||!valid(x?.excludes)||x.supports.some(id=>x.excludes.includes(id))||x.excludes.includes(c.answer)))return null;
  const candidates=ids.filter(id=>!proof.some(x=>x.excludes.includes(id)));
  if(candidates.length!==1||candidates[0]!==c.answer||proof.filter(x=>x.supports.includes(c.answer)).length<2||proof.some(x=>!x.supports.length&&!x.excludes.length))return null;
  c.proof=proof.map(x=>({supports:x.supports.slice(),excludes:x.excludes.slice()}));
 }
 if(source==='series'){
  if(!['gift-1','gift-2','gift-3'].includes(id))return null;
  c.serial={id:'street-gift',name:'街角的筹备',chapter:Number(id.slice(-1)),total:3};
 }
 return c;
}
export const caseSourceLabel=c=>c?.serial?c.serial.name+' · 第 '+c.serial.chapter+'/'+c.serial.total+' 回':c?.source==='model'?'模型小案':c?.source==='local'?'小镇日常小案':'初到小巷';
