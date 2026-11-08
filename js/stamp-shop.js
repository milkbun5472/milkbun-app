// One shop, one writer. Both the text page and the 3D host send operations here.
(function(g){
 'use strict';
 const KEY='x_stampShop',obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{},arr=x=>Array.isArray(x)?x:[],copy=x=>JSON.parse(JSON.stringify(x));
 const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
 const dateKey=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
 const cleanCustomer=x=>({...x,want:typeof x.want==='string'?x.want:'',got:Math.max(0,finite(x.got)),name:typeof x.name==='string'?x.name:'',fee:Math.max(0,finite(x.fee)),meet:Array.isArray(x.meet)?x.meet.filter(t=>typeof t==='string'):undefined,meetTurns:arr(x.meetTurns).filter(t=>t&&typeof t.text==='string'),meetCast:obj(x.meetCast)});
 function restore(raw){const s=obj(raw);return {...s,rev:Math.max(0,finite(s.rev)),day:Math.max(1,Math.floor(finite(s.day,1))),coins:s.coins==null?20:Math.max(0,finite(s.coins)),earned:Math.max(0,finite(s.earned)),date:typeof s.date==='string'?s.date:'',period:typeof s.period==='string'?s.period:'',phase:['plan','open','closed'].includes(s.phase)?s.phase:'plan',roster:{...obj(s.roster)},badge:{...obj(s.badge)},decor:[...new Set(arr(s.decor).filter(x=>typeof x==='string'))],decorLv:Object.fromEntries(Object.entries(obj(s.decorLv)).map(([k,v])=>[k,Math.max(1,Math.min(3,Math.floor(finite(v,1))))])),window:[...new Set(arr(s.window).filter(x=>typeof x==='string'))],customers:arr(s.customers).filter(x=>x&&typeof x.id==='string').map(cleanCustomer),closing:arr(s.closing).filter(x=>typeof x==='string'),notes:arr(s.notes).filter(x=>x&&typeof x.text==='string'),missed:s.missed&&typeof s.missed==='object'&&!Array.isArray(s.missed)?{...s.missed,day:Math.max(1,finite(s.missed.day,1)),earned:Math.max(0,finite(s.missed.earned)),lines:Array.isArray(s.missed.lines)?s.missed.lines.filter(x=>typeof x==='string'):undefined}:null,requests:{...obj(s.requests)}};}
 const token=s=>({date:s.date,period:s.period,rev:s.rev});
 function filterCards(cards,f={}){return arr(cards).filter(c=>c&&c.text&&(!f.who||c.charId===f.who)&&(!f.rar||c.rarity===f.rar)&&(!f.role||(g.StampDuel&&g.StampDuel.stampOf(c).role)===f.role)&&(!f.q||String(c.text.name||'').includes(String(f.q).trim())));}
 function sortedCards(cards,selected=[],f={}){const ids=new Set(selected);return arr(cards).filter(c=>c&&c.text&&(ids.has(c.id)||filterCards([c],f).length)).sort((a,b)=>Number(ids.has(b.id))-Number(ids.has(a.id))||({SSR:3,SR:2,R:1}[b.rarity]||0)-({SSR:3,SR:2,R:1}[a.rarity]||0)||(Number(b.lv)||0)-(Number(a.lv)||0));}
 function create({read,write,rules=()=>g.StampDuel,now=()=>new Date(),seed=()=>1,notify=()=>{}}){
  let queue=Promise.resolve(),failedOperation=null;const jobs=new Map(),results=new Map();
  const load=()=>restore(read());
  const person=(o,id)=>arr(o.characters).find(c=>String(c.id)===String(id));
  const name=(o,id)=>{const c=person(o,id);return c?c.remark||c.name||'店员':'';};
  const eligible=o=>arr(o.characters).filter(c=>arr(o.cards).some(k=>k&&k.charId===c.id&&k.text));
  function advance(s,o){const d=now(),date=dateKey(d),period=rules().shopPeriod(d),D=rules();
   if(s.date!==date){if(s.date&&s.phase==='open')s.missed={day:s.day,staffIds:D.SHOP.POSTS.map(p=>s.roster[p]).filter(Boolean),staff:D.SHOP.POSTS.filter(p=>s.roster[p]).map(p=>name(o,s.roster[p])+'在'+p).join('、'),first:D.SHOP.POSTS.map(p=>s.roster[p]).find(Boolean),earned:s.earned,customers:s.customers.filter(c=>c.done).map(c=>c.visitor?name(o,c.charId):c.name).join('、')};if(s.date)s.day++;Object.assign(s,{date,phase:'plan',customers:[],earned:0,closing:[],notes:[],period:'',requests:{}});}
   if(s.phase==='open'&&period!=='半夜'&&s.period!==period){const people=eligible(o).map(c=>c.id),duty=Object.values(s.roster);s.customers=D.shopCustomers(s,people.filter(id=>!duty.includes(id)),seed(),people,period).map(cleanCustomer);s.period=period;s.requests={};}
   return s;
  }
  async function transaction(fn,o={}){const task=queue.then(async()=>{const raw=read(),s=advance(restore(raw),o);const value=await fn(s);if(JSON.stringify(raw)!==JSON.stringify(s)){s.rev=(Number(s.rev)||0)+1;const ok=await write(copy(s));if(!ok){failedOperation=o.__operation||'sync';const error=Error('小店没有保存成功，请先重试刚才的操作。');error.code='SHOP_SAVE_FAILED';throw error;}failedOperation=null;notify(copy(s));}return value===undefined?copy(s):value;});queue=task.catch(()=>{});return task;}
  const guard=(s,o)=>{if(o.expected?.rev!=null&&o.expected.rev!==s.rev)throw Error('店里刚有变化，请按最新画面再选一次。');if(o.expected?.date&&o.expected.date!==s.date)throw Error('已经换天，请刷新店面后再操作。');};
  const customer=(s,o)=>{guard(s,o);if(o.expected?.period&&o.expected.period!==s.period)throw Error('这一批客人已经离开了。');const c=s.customers.find(c=>c.id===o.id);if(!c)throw Error('这位客人已经不在店里。');return c;};
  function apply(s,action,o){const D=rules();guard(s,o);const cOf=id=>arr(o.cards).find(c=>c&&c.id===id),persona=id=>{const c=person(o,id)||{};return [c.persona,c.description,c.desc,c.personality].filter(Boolean).join(' ');};
   if(action==='sync')return;
   if(action==='move'){
    if(s.phase!=='plan')throw Error('先在开门前排班。');if(!D.SHOP.POSTS.includes(o.from)||!D.SHOP.POSTS.includes(o.to))throw Error('岗位不存在。');const id=s.roster[o.from];if(!id||o.charId!==id)throw Error('这位店员刚换过岗。');if(o.from===o.to)return;if(s.roster[o.to])throw Error('目标岗位已经有人，先让该岗位空出来。');const badge=s.badge[o.from]||'';s.roster[o.from]='';s.badge[o.from]='';s.roster[o.to]=id;s.badge[o.to]=badge;
   }else if(action==='assign'){
    if(s.phase!=='plan')throw Error('先在开门前排班，明天可以再调整。');if(!D.SHOP.POSTS.includes(o.post))throw Error('岗位不存在。');
    if(o.expectedId!=null&&String(s.roster[o.post]||'')!==String(o.expectedId))throw Error('这个岗位刚换过人，请重新选择。');
    const id=o.charId||'';if(id&&!eligible(o).some(c=>c.id===id))throw Error('先为这位角色留一张可用的邮票。');if(id&&D.SHOP.POSTS.some(p=>p!==o.post&&s.roster[p]===id))throw Error('这个人已在另一个岗位，先让原岗位空出来。');s.roster[o.post]=id;s.badge[o.post]='';
   }else if(action==='badge'){
    if(!D.SHOP.POSTS.includes(o.post)||!s.roster[o.post])throw Error('先给这个岗位排人。');const c=cOf(o.cardId);if(o.cardId&&(!c||c.charId!==s.roster[o.post]||!c.text))throw Error('工牌要用这位店员自己的卡。');s.badge[o.post]=o.cardId||'';
   }else if(action==='window'){
    if(s.window.includes(o.cardId))s.window=s.window.filter(id=>id!==o.cardId);else {if(!cOf(o.cardId)?.text)throw Error('这张卡已不可用。');if(s.window.length>=D.shopWinSlots(s))throw Error('橱窗满了，先撤下一张。');s.window.push(o.cardId);}
   }else if(action==='decor'){
    const d=D.shopDecorOf(o.name);if(!d)throw Error('这件装修暂时没有出售。');const has=s.decor.includes(o.name),price=has?D.shopUpPrice(s,o.name):d.price;
    if(!has&&d.month&&d.month!==now().getMonth()+1)throw Error('这件限定装修要等对应月份再买。');if(!price)throw Error('已经翻新到头了。');if(s.coins<price)throw Error('邮花不够。');s.coins-=price;if(has)s.decorLv[o.name]=Math.min(3,(Number(s.decorLv[o.name])||1)+1);else s.decor.push(o.name);
   }else if(action==='open'){
    if(s.phase!=='plan')throw Error('今天已经开过门，明天再来。');if(D.shopPeriod(now())==='半夜')throw Error('半夜不开门，早上6点再来。');if(!Object.values(s.roster).some(Boolean))throw Error('至少排一个人上班。');s.phase='open';advance(s,o);
   }else if(action==='serve'||action==='fight'){
    const c=customer(s,o);if(c.done)return;if(s.phase!=='open'||D.shopPeriod(now())==='半夜')throw Error('店门已经关了。');if(action==='serve'&&c.tough)throw Error('这位客人要先打一局。');
    const mul=D.shopMul(s,s.roster,persona,cOf),has=c.wantChar?s.window.some(id=>cOf(id)?.charId===c.wantChar):true;
    const fee=action==='fight'?(o.won?Math.round(c.fee*mul*1.5):0):has?Math.round(c.fee*mul):0;s.coins+=fee;s.earned+=fee;Object.assign(c,{done:true,got:fee,miss:!!c.wantChar&&!has,...(action==='fight'?{won:!!o.won}:{})});
   }else if(action==='seenMeet'){const c=customer(s,o);c.meetSeen=true;}else if(action==='missedClear'){s.missed=null;}
   else throw Error('这个操作暂时不支持。');
  }
  const requestKey=(s,kind,o)=>s.date+'|'+(kind==='meet'?s.period+'|'+o.id:kind);
  async function story(kind,o){
   const s=load(),key=requestKey(s,kind,o);if(jobs.has(key))return jobs.get(key);
   const job=(async()=>{
    let request;
    const prepare=await transaction(s=>{guard(s,o);const keyNow=requestKey(s,kind,o);if(keyNow!==key)throw Error('店面时段已变，请重新打开。');
     if(kind==='close'&&s.phase==='closed')return {done:true,lines:s.closing};
     const c=kind==='meet'?customer(s,o):null;if(c?.meet?.length)return {done:true,lines:c.meet};
     if(kind==='missed'&&s.missed?.lines?.length)return {done:true,lines:s.missed.lines};
     if(results.has(key))return {cached:true};
     if(s.requests[key]?.state==='pending')throw Error('上次的结果还没确认，请先留在店里；可以只关门，不再生成。');
     const posts=rules().SHOP.POSTS,staff=posts.map(p=>s.roster[p]).filter(Boolean),post=posts.find(p=>s.roster[p]),staffId=s.roster[post];
     if(kind==='close'&&s.phase!=='open')throw Error('先开门接客，再打烊。');if(kind==='meet'&&(!c.visitor||!person(o,c.charId)||!staffId))throw Error('客人或店员已经不在店里。');if(kind==='missed'&&!s.missed)throw Error('没有待补写的打烊。');
     const cardLine=id=>{const c=arr(o.cards).find(c=>c&&c.id===id);return c?'「'+(c.text?.name||'')+'」（'+name(o,c.charId)+'的卡'+(c.text?.line?'，'+c.text.line:c.text?.gist?'，'+c.text.gist:'')+'）':'';};
     const data=kind==='meet'?{mode:'shopmeet',day:s.day,decor:s.decor.join('、'),visitor:name(o,c.charId),visitorId:c.charId,staffId,staffName:name(o,staffId),post}:{mode:'shopclose',day:s.day,decor:s.decor.map(k=>k+((s.decorLv[k]||1)>1?'（翻新'+s.decorLv[k]+'级）':'')).join('、'),staff:posts.filter(p=>s.roster[p]).map(p=>name(o,s.roster[p])+'在'+p).join('、'),staffIds:staff,window:s.window.map(cardLine).join('；'),badges:posts.filter(p=>s.badge[p]).map(p=>name(o,s.roster[p])+'挂着'+cardLine(s.badge[p])).join('；'),coins:s.earned,customers:s.customers.filter(c=>c.done).map(c=>c.visitor?name(o,c.charId):c.name+(c.tough?(c.won?'（打赢了）':'（没打过）'):'')).join('、')};
     if(kind==='missed')Object.assign(data,s.missed,{mode:'shopclose',missed:true,coins:s.missed.earned,staffIds:s.missed.staffIds||[s.missed.first]});
     request={data,charId:kind==='meet'?c.charId:kind==='missed'?s.missed.first:staff[0],staffId,visitorId:c?.charId,key,date:s.date,period:s.period,id:o.id};
     if(!request.charId||typeof o.onChat!=='function')throw Error('暂时没有能写这段话的角色或接口。');s.requests[key]={state:'pending',at:Date.now()};return {request};
    },o);
    if(prepare.done)return prepare.lines;
    if(!results.has(key)){
     request=prepare.request;
     try{const value=await o.onChat(request.charId,request.data),rows=Array.isArray(value)?value:arr(value?.lines),turns=rows.map(x=>typeof x==='string'?{text:x,speakerId:null}:{text:String(x?.text||''),speakerId:[request.staffId,request.visitorId].includes(x?.speakerId)?x.speakerId:null}).filter(x=>x.text.trim());if(!turns.length)throw Error('没有写出文字，请稍后重试。');results.set(key,{...request,turns,lines:turns.map(x=>x.text),notes:arr(value&&value.notes).filter(x=>x&&x.text)});}
     catch(e){await transaction(s=>{if(s.requests[key])s.requests[key]={state:'failed'};},o).catch(()=>{});throw e;}
    }
    const result=results.get(key);
    await transaction(s=>{if(s.date!==result.date||(kind==='meet'&&s.period!==result.period))throw Error('原来的日期或客人批次已经结束，结果没有写入新一天。');
     if(s.requests[key]?.state==='cancelled')throw Error('这次已经只关门，文字没有覆盖你的选择。');if(kind==='close'){s.phase='closed';s.closing=result.lines;s.notes=result.notes||[];s.closeCast=copy(s.roster);s.closedAt=Date.now();}
     else if(kind==='meet'){const c=s.customers.find(c=>c.id===result.id);if(!c)throw Error('原来的客人已经离开。');c.meet=result.lines;c.meetTurns=result.turns;c.meetCast={staffId:result.staffId,visitorId:result.visitorId};c.meetKey=key;}
     else if(s.missed)s.missed.lines=result.lines;
     s.requests[key]={state:'done'};
    },o);results.delete(key);return result.lines;
   })();jobs.set(key,job);try{return await job;}finally{jobs.delete(key);}
  }
  return {read:load,token,filterCards,sortedCards,hasResult:kind=>results.has(load().date+'|'+kind),busy:()=>jobs.size>0,
   failed:()=>!!failedOperation,sync:o=>failedOperation&&failedOperation!=='sync'?Promise.reject(Error('小店有未保存的操作，请先重试。')):transaction(()=>{},{...o,__operation:'sync'}),run:(action,o={})=>{const operation=JSON.stringify([action,o.id,o.post,o.cardId,o.name,o.from,o.to,o.charId]);if(failedOperation&&failedOperation!==operation)return Promise.reject(Error('请先重试刚才未保存的操作。'));o={...o,__operation:operation};const task=['close','meet','missed'].includes(action)?story(action,o):transaction(s=>{if(action==='closeLocal'){guard(s,o);if(s.phase==='plan')throw Error('先开门接客，再关门。');s.phase='closed';s.closing=[],s.notes=[];for(const k of Object.keys(s.requests))if(s.requests[k]?.state==='pending')s.requests[k]={state:'cancelled'};}else apply(s,action,o);},o);return task.then(value=>{if(failedOperation===operation)failedOperation=null;return value;},e=>{if(e.code!=='SHOP_SAVE_FAILED'&&failedOperation===operation)failedOperation=null;throw e;});}};
 }
 const shopSeed=()=>{let n=loadJSON('x_stampPatrolSalt',0);if(!n){n=(Math.random()*4294967295)>>>0||1;saveJSON('x_stampPatrolSalt',n);}return n;};
 let shared;
 const service=()=>shared||(shared=create({read:()=>loadJSON(KEY,null),write:async value=>{const r=await commitJSONDurable(KEY,value);return !!r?.durable&&r.live!==false;},seed:shopSeed,notify:s=>g.dispatchEvent?.(new CustomEvent('stamp-shop-change',{detail:s}))}));
 g.StampShop={KEY,seed:shopSeed,restore,token,filterCards,sortedCards,create,read:()=>service().read(),sync:o=>service().sync(o),run:(a,o)=>service().run(a,o),hasResult:k=>service().hasResult(k),busy:()=>service().busy(),failed:()=>service().failed()};
})(typeof window!=='undefined'?window:globalThis);
