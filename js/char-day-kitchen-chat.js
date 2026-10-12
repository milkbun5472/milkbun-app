// Kitchen dialogue has its own transcript in the original home writer.
(function(root){
 'use strict';
 function chatState(raw){return {...(raw&&typeof raw==='object'?raw:{}),rows:(Array.isArray(raw?.rows)?raw.rows:[]).filter(m=>m&&typeof m.id==='string'&&['user','assistant'].includes(m.role)&&typeof m.content==='string'),meal:raw?.meal&&Array.isArray(raw.meal.courses)?raw.meal:null};}
 function chatChange(raw,a){const s=chatState(raw);
  if(a.kind==='select')return {...s,meal:a.meal};
  if(a.kind==='user'){if(!a.id||!String(a.content||'').trim())throw Error('先写一句话。');if(s.rows.some(m=>m.id===a.id))return s;return {...s,rows:[...s.rows,{id:a.id,role:'user',content:String(a.content).trim(),at:a.at,status:'pending'}]};}
  if(a.kind==='reply'){if(!s.rows.some(m=>m.id===a.requestId&&m.role==='user'))throw Error('这句对话已经变了。');if(s.rows.some(m=>m.replyTo===a.requestId))return s;return {...s,rows:s.rows.map((m,i)=>m.role==='user'&&i<=s.rows.findIndex(q=>q.id===a.requestId)?{...m,status:'done'}:m).concat(a.parts.map((content,i)=>({id:a.requestId+':'+i,role:'assistant',content,replyTo:a.requestId,at:a.at})))};}
  throw Error('这条对话没有保存。');
 }
 function facts(homes,cid,raw){const K=root.CharDayKitchen,s=chatState(raw),p=K.kitchen(homes?.kitchens?.[cid]).pending,job=p?.kind==='cook'?p:null;
  return {map:'day-kitchen',meal:s.meal?root.CharDayLife.kitchenMealHint(s.meal):'',currentMeal:p?.kind==='meal'?root.CharDayLife.kitchenMealHint(root.CharDayLife.kitchenMealFor(homes,cid,p.id)):'',cooking:job?{dish:K.dishName({recipeId:job.recipeId,variation:job.cooking?.variation}),taste:job.cooking?K.tasteDescription(job.cooking.variation):'未记录',lead:job.cooking?.lead||'未记录',stage:job.ready?'已完成':job.cooking?K.cookingSpec(job).label:'准备中',ingredients:job.cooking?.progress?.table?.items.map(q=>({name:K.INGREDIENTS[q.ingredient],where:({basket:'食材篮',board:'砧板',pan:'锅里',plate:'盘里'})[q.zone],cut:q.cut,ready:K.tableReady(q,K.recipe(job.recipeId).method)}))||[]}:null};
 }
 const exchanges=new Map();
 const exchange=cid=>{if(!exchanges.has(cid))exchanges.set(cid,{busy:false,answer:null,error:'',detail:''});return exchanges.get(cid);};
 const changed=cid=>root.dispatchEvent(new CustomEvent('char-day-kitchen-dialogue',{detail:{cid}}));
 function KitchenChat({character,profile,apiFor,active,homes,onHomes,btn,ink,soft,footerStyle}){
  const R=root.React,h=R.createElement,{useState,useRef,useEffect}=R,cid=String(character.id);
  const pending=exchange(cid),[draft,setDraft]=useState(''),[busy,setBusy]=useState(pending.busy),[error,setError]=useState(pending.error),[detail,setDetail]=useState(pending.detail),[limit,setLimit]=useState(40),rowsRef=useRef(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;const refresh=e=>{if(e.detail.cid!==cid)return;setBusy(pending.busy);setError(pending.error);setDetail(pending.detail);onHomes(root.loadJSON('x_charDayHomes',{}));};root.addEventListener('char-day-kitchen-dialogue',refresh);return()=>{alive.current=false;root.removeEventListener('char-day-kitchen-dialogue',refresh);};},[cid]);
  const state=chatState(homes.kitchenChats?.[cid]),rows=state.rows;
  useEffect(()=>{if(rowsRef.current)rowsRef.current.scrollTop=rowsRef.current.scrollHeight;},[rows.length,busy]);
  const write=async a=>{const next=await root.CharDayKit.saveHomeChange(cid,'kitchenChats',raw=>chatChange(raw,a));if(alive.current)onHomes(next);changed(cid);return next;};
  async function reply(text){if(pending.busy)return;pending.busy=true;pending.error='';pending.detail='';changed(cid);try{
   if(pending.answer){await write(pending.answer);pending.answer=null;return;}
   let current=root.loadJSON?root.loadJSON('x_charDayHomes',{}):homes;
   if(text){await write({kind:'user',id:root.crypto.randomUUID(),content:text,at:Date.now()});if(alive.current)setDraft('');current=root.loadJSON('x_charDayHomes',{});}
   const s=chatState(current.kitchenChats?.[cid]),request=s.rows.filter(m=>m.role==='user'&&m.status!=='done').at(-1);if(!request)throw Error('先发一句话，再让TA回复。');
   const result=await root.FairyGardenService.ask({active:apiFor?apiFor(character.id):active,character,profile,world:facts(current,cid,s),history:s.rows.slice(-80),text:request.content});
   const action={kind:'reply',requestId:request.id,parts:result.parts,at:Date.now()};pending.answer=action;await write(action);pending.answer=null;
  }catch(e){pending.error=pending.answer?'回复到了，但还没保存。点“保存回复”重试。':e.message||'这次没有接上，可以重试。';pending.detail=e.detail||'';}finally{pending.busy=false;changed(cid);}}
  const label=pending.answer?'保存回复':'让TA回复';
  return h('section',{"data-wk":"cdaykitchenchat",className:'flex-1 min-h-0 flex flex-col',style:{color:ink}},
   h('div',{"data-wk":"cdaykitchenmsgs",ref:rowsRef,className:'flex-1 min-h-0 overflow-y-auto',style:{padding:'12px 18px',lineHeight:1.8}},
    h('p',{style:{fontSize:11,color:soft,marginTop:0}},state.meal?'聊这桌菜：'+state.meal.courses.map(root.CharDayKitchen.dishName).join('、'):'边做饭，边说说话。'),
    !rows.length&&h('p',{style:{fontSize:13,color:soft}},'这里留着你们在厨房说的话。'),
    rows.length>limit&&h('button',{"data-wk":"cdaykitchenolder",style:{...btn,width:'100%'},onClick:()=>setLimit(n=>n+40)},'看看前面的对话'),
    ...rows.slice(-limit).map(m=>h('div',{key:m.id,"data-wk":"cdaykitchenmsg",'data-me':m.role==='user'?'1':'0',style:{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:12}},h('div',{style:{maxWidth:'87%',padding:'9px 12px',borderRadius:m.role==='user'?'14px 4px 14px 14px':'4px 14px 14px 14px',background:m.role==='user'?'#e6eddc':'#fffdf7',border:'1px solid #dde2d4',fontSize:13,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},m.content))),
    busy&&h('p',{role:'status',style:{fontSize:12,color:soft}},'TA正在接话…'),error&&h('div',{role:'status',style:{fontSize:12,color:'#9b674d'}},error,detail&&h('details',null,h('summary',null,'看看原因'),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},detail)))),
   h('form',{"data-wk":"cdaykitchencompose",className:'shrink-0',style:{...footerStyle,display:'flex',alignItems:'center',gap:6},onSubmit:e=>{e.preventDefault();if(draft.trim())reply(draft.trim());}},
    h('input',{"data-wk":"cdaykitcheninput",'aria-label':'在厨房说句话',value:draft,onChange:e=>setDraft(e.target.value),disabled:busy,placeholder:'和TA说句话…',style:{...btn,flex:1,minWidth:0,fontSize:16}}),
    h('button',{"data-wk":"cdaykitchensend",type:'submit',disabled:busy||!draft.trim(),style:btn},'发送'),
    h('button',{"data-wk":"cdaykitchenreply",type:'button',disabled:busy||!rows.some(m=>m.role==='user'&&m.status!=='done')&&!pending.answer,style:btn,onClick:()=>reply('')},label)));
 }
 root.CharDayKitchenChat={chatState,chatChange,facts,View:KitchenChat};
})(window);
