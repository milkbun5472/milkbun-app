// One shop, one writer. Both the text page and the 3D host send operations here.
(function(g){
 'use strict';
 const KEY='x_stampShop',obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{},arr=x=>Array.isArray(x)?x:[],copy=x=>JSON.parse(JSON.stringify(x));
 const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
 const dateKey=d=>d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
 const STORY_ACTIONS=g.CharacterStoryActions.ids;
 const cleanTurns=(rows,allowed=null,names=null)=>arr(rows).map(x=>{const r=typeof x==='string'?{text:x}:obj(x),id=k=>typeof r[k]==='string'&&(!allowed||allowed.includes(r[k]))?r[k]:null,text=typeof r.text==='string'?r.text:'';if(typeof r.action!=='string'){const A=g.CharacterStoryActions,who=A.mentioned(text,names).filter(x=>!allowed||allowed.includes(x)),speaker=id('speakerId'),actor=speaker||who[0]||null;const target=who.find(x=>x!==actor)||null;return {text,speakerId:speaker,actorId:actor,targetId:target,action:A.normalize(A.infer(text),!!target)};}return {text,speakerId:id('speakerId'),actorId:id('actorId')||id('speakerId'),targetId:id('targetId'),action:STORY_ACTIONS.includes(r.action)?r.action:'talk'};}).filter(x=>x.text.trim());
 const cleanNotes=(rows,allowed=null)=>arr(rows).filter(x=>x&&typeof x.text==='string').map(x=>({...x,speakerId:typeof x.speakerId==='string'&&(!allowed||allowed.includes(x.speakerId))?x.speakerId:null}));
 const cleanCast=raw=>Object.fromEntries(Object.entries(obj(raw)).filter(([,id])=>typeof id==='string'&&id));
 const storyKey=s=>s.date?'date:'+s.date:'day:'+s.day;
 function cleanStory(raw){const s=obj(raw);return {...s,date:typeof s.date==='string'?s.date:'',day:Math.max(1,Math.floor(finite(s.day,1))),lines:arr(s.lines).filter(t=>typeof t==='string'),turns:cleanTurns(s.turns),notes:cleanNotes(s.notes),cast:cleanCast(s.cast)};}
 function retainStory(s,record){const item=cleanStory(record);if(!item.lines.length)return;item.key=storyKey(item);const at=s.closingHistory.findIndex(r=>storyKey(r)===item.key);if(at<0)s.closingHistory.push(item);else s.closingHistory[at]={...s.closingHistory[at],...item};}
 function retainCurrent(s){if(s.closing.length)retainStory(s,{date:s.date,day:s.day,lines:s.closing,turns:s.closingTurns,notes:s.notes,cast:s.closeCast,at:s.closedAt,earned:s.earned,served:servedOf(s)});if(s.missed?.lines?.length)retainStory(s,{...s.missed,cast:s.missed.cast,turns:s.missed.turns});}
 // 店铺日记（她 2026-11-09）：那天招待过谁、收了多少；来访对话也按天收着，客人走了还翻得到
 function servedOf(s){return arr(s.customers).filter(c=>c&&c.done).map(c=>({name:typeof c.name==='string'?c.name:'',charId:c.visitor?c.charId:'',got:finite(c.got),tough:!!c.tough,won:!!c.won,match:!!c.match}));}
 function diary(raw){const s=restore(raw),days=new Map(),day=(date,n)=>{if(!days.has(date))days.set(date,{date,day:n,story:null,visits:[]});return days.get(date);};
  history(raw).forEach(r=>{const d=day(r.date,r.day);if(!d.story)d.story=r;});arr(s.visits).forEach(v=>day(v.date,v.day).visits.push(v));
  if(s.date&&s.phase!=='plan'){const d=day(s.date,s.day);d.today={earned:s.earned,served:servedOf(s),cast:{...s.roster}};const have=new Set(d.visits.map(v=>v.key));arr(s.customers).filter(c=>c&&arr(c.meet).length&&!have.has(c.meetKey)).forEach(c=>d.visits.push({key:c.meetKey,date:s.date,day:s.day,period:s.period,visitorId:c.charId,staffId:c.meetCast?.staffId,lines:c.meet,turns:c.meetTurns}));}
  const order=d=>{const [y,m,dd]=String(d.date).split('-').map(Number);return Number.isFinite(y+m+dd)?y*10000+m*100+dd:d.day;};return [...days.values()].sort((a,b)=>order(b)-order(a));}
 // 一直玩下去的那几样（她 2026-11-09）：口碑、每周大单、熟客、熟练度
 const weekKey=d=>{const t=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7));return dateKey(t);};
 function bumpOrder(s,k,n=1){(s.orders?.list||[]).forEach(o=>{if(o.done||o.k!==k)return;o.prog=Math.min(o.n,(o.prog||0)+n);if(o.prog>=o.n){o.done=true;s.coins+=o.pay;s.rep=(s.rep||0)+o.rep;s.orderDone=(s.orderDone||0)+1;}});}
 function meetRegular(s,c){if(!c.regularId||c.visitor||c.tough||c.rareId||c.left)return;const D=g.StampDuel,regs=s.regulars,tag=c.need?.post||(c.need?.card?'卡':'');let r=regs[c.regularId];
  if(!r){r=regs[c.regularId]={id:c.regularId,name:c.name,want:c.want,fee:Math.round((c.fee||8)/(c.urgent?2:1)),need:tag,bond:0,stories:[],since:s.date};
   const live=Object.values(regs).filter(x=>!x.gone);if(live.length>40){const low=live.filter(x=>x.id!==r.id).sort((a,b)=>(a.bond||0)-(b.bond||0))[0];if(low)low.gone=s.date;}}
  r.gone=null;r.bond=(r.bond||0)+1;r.last=s.date;bumpOrder(s,'regular');
  if(r.bond%3===0){const text=D.shopRegStory(r.bond/3);r.stories=arr(r.stories).concat([{date:s.date,text}]).slice(-30);c.story=text;}
  if(r.bond%5===0){const gift=15+r.bond;s.coins+=gift;c.gift=gift;}}
 // 她没来招待的普通客人，过了时段由店员按原价招待掉（她 2026-11-09），不加成；难缠客人没人打一局还是会走
 function autoServe(s){if(s.phase!=='open')return;arr(s.customers).forEach(c=>{if(c.done||c.tough||c.visitor)return;const fee=Math.round(c.fee||0);c.done=true;c.got=fee;c.auto=true;s.coins+=fee;s.earned+=fee;s.rep=(s.rep||0)+5;bumpOrder(s,'serve');bumpOrder(s,'earn',fee);if(c.urgent)bumpOrder(s,'urgent');meetRegular(s,c);});}
 function history(raw){const s=restore(raw);retainCurrent(s);const order=r=>{const [y,m,d]=r.date.split('-').map(Number);return Number.isFinite(y+m+d)?y*10000+m*100+d:r.day;};return s.closingHistory.map(copy).sort((a,b)=>order(b)-order(a));}
 const cleanCustomer=x=>({...x,want:typeof x.want==='string'?x.want:'',got:Math.max(0,finite(x.got)),name:typeof x.name==='string'?x.name:'',fee:Math.max(0,finite(x.fee)),meet:Array.isArray(x.meet)?x.meet.filter(t=>typeof t==='string'):undefined,meetTurns:cleanTurns(x.meetTurns),meetCast:obj(x.meetCast)});
 function restore(raw){const s=obj(raw);return {...s,rev:Math.max(0,finite(s.rev)),day:Math.max(1,Math.floor(finite(s.day,1))),coins:s.coins==null?20:Math.max(0,finite(s.coins)),earned:Math.max(0,finite(s.earned)),date:typeof s.date==='string'?s.date:'',period:typeof s.period==='string'?s.period:'',phase:['plan','open','closed'].includes(s.phase)?s.phase:'plan',roster:{...obj(s.roster)},badge:{...obj(s.badge)},decor:[...new Set(arr(s.decor).filter(x=>typeof x==='string'))],decorLv:Object.fromEntries(Object.entries(obj(s.decorLv)).map(([k,v])=>[k,Math.max(1,Math.min(3,Math.floor(finite(v,1))))])),window:[...new Set(arr(s.window).filter(x=>typeof x==='string'))],customers:arr(s.customers).filter(x=>x&&typeof x.id==='string').map(cleanCustomer),closing:arr(s.closing).filter(x=>typeof x==='string'),closingTurns:cleanTurns(s.closingTurns),notes:cleanNotes(s.notes),closeCast:cleanCast(s.closeCast),rep:Math.max(0,finite(s.rep)),rareSeen:{...obj(s.rareSeen)},skill:{...obj(s.skill)},pair:{...obj(s.pair)},regulars:{...obj(s.regulars)},orders:s.orders&&typeof s.orders==='object'&&Array.isArray(s.orders.list)?s.orders:null,visits:arr(s.visits).filter(v=>v&&typeof v==='object'&&typeof v.date==='string'&&(arr(v.lines).length||arr(v.turns).length)),closingHistory:arr(s.closingHistory).filter(x=>x&&typeof x==='object').map(cleanStory).filter(x=>x.lines.length),missed:s.missed&&typeof s.missed==='object'&&!Array.isArray(s.missed)?{...s.missed,day:Math.max(1,finite(s.missed.day,1)),earned:Math.max(0,finite(s.missed.earned)),lines:Array.isArray(s.missed.lines)?s.missed.lines.filter(x=>typeof x==='string'):undefined}:null,requests:{...obj(s.requests)}};}
 const token=s=>({date:s.date,period:s.period,rev:s.rev});
 function filterCards(cards,f={}){return arr(cards).filter(c=>c&&c.text&&(!f.who||c.charId===f.who)&&(!f.rar||c.rarity===f.rar)&&(!f.role||(g.StampDuel&&g.StampDuel.stampOf(c).role)===f.role)&&(!f.q||String(c.text.name||'').includes(String(f.q).trim())));}
 function sortedCards(cards,selected=[],f={}){const ids=new Set(selected);return arr(cards).filter(c=>c&&c.text&&(ids.has(c.id)||filterCards([c],f).length)).sort((a,b)=>Number(ids.has(b.id))-Number(ids.has(a.id))||({SSR:3,SR:2,R:1}[b.rarity]||0)-({SSR:3,SR:2,R:1}[a.rarity]||0)||(Number(b.lv)||0)-(Number(a.lv)||0));}
 function create({read,write,rules=()=>g.StampDuel,now=()=>new Date(),seed=()=>1,notify=()=>{}}){
  let queue=Promise.resolve(),failedOperation=null;const jobs=new Map(),results=new Map(),cancelled=new Set();
  const load=()=>restore(read());
  const person=(o,id)=>arr(o.characters).find(c=>String(c.id)===String(id));
  const name=(o,id)=>{const c=person(o,id);return c?c.remark||c.name||'店员':'';};
  const eligible=o=>arr(o.characters).filter(c=>arr(o.cards).some(k=>k&&k.charId===c.id&&k.text));
  function advance(s,o){const d=now(),date=dateKey(d),period=rules().shopPeriod(d),D=rules();for(const [key,request]of Object.entries(s.requests))if(request?.state==='cancelled')cancelled.add(key);retainCurrent(s);
   {const wk=weekKey(d);if(!s.orders||s.orders.week!==wk)s.orders={week:wk,list:D.shopOrders(D.shopRepLv(s),wk,String(seed()))};}
   if(s.date!==date)autoServe(s);
   if(s.date!==date){if(s.date&&s.phase==='open')s.missed={date:s.date,day:s.day,cast:copy(s.roster),staffIds:D.SHOP.POSTS.map(p=>s.roster[p]).filter(Boolean),staff:D.SHOP.POSTS.filter(p=>s.roster[p]).map(p=>name(o,s.roster[p])+'在'+p).join('、'),first:D.SHOP.POSTS.map(p=>s.roster[p]).find(Boolean),earned:s.earned,customers:s.customers.filter(c=>c.done).map(c=>c.visitor?name(o,c.charId):c.name).join('、')};if(s.date)s.day++;Object.assign(s,{date,phase:'plan',customers:[],earned:0,closing:[],closingTurns:[],notes:[],closeCast:{},closedAt:0,period:'',requests:{}});}
   if(s.phase==='open'&&s.period&&s.period!==period)autoServe(s);if(s.phase==='open'&&period!=='半夜'&&s.period!==period){const people=eligible(o).map(c=>c.id),duty=Object.values(s.roster);s.windowRar=s.window.map(id=>(arr(o.cards).find(c=>c&&c.id===id)||{}).rarity).filter(Boolean);s.customers=D.shopCustomers(s,people.filter(id=>!duty.includes(id)),seed(),people,period).map(cleanCustomer);if(s.customers.some(c=>c.rareId))s.rareDay=s.date;s.period=period;s.requests={};}
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
    if(s.phase!=='plan')throw Error('今天已经开过门，明天再来。');if(D.shopPeriod(now())==='半夜')throw Error('半夜不开门，早上6点再来。');if(!Object.values(s.roster).some(Boolean))throw Error('至少排一个人上班。');s.phase='open';const duty=D.SHOP.POSTS.filter(p=>s.roster[p]);duty.forEach(p=>{const k=s.roster[p]+'|'+p;s.skill[k]=(s.skill[k]||0)+1;});const ids=[...new Set(duty.map(p=>String(s.roster[p])))].sort();for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=ids[i]+'|'+ids[j];s.pair[k]=(s.pair[k]||0)+1;}bumpOrder(s,'days');advance(s,o);
   }else if(action==='serve'||action==='fight'){
    const c=customer(s,o);if(c.done)return;if(s.phase!=='open'||D.shopPeriod(now())==='半夜')throw Error('店门已经关了。');if(action==='serve'&&c.tough)throw Error('这位客人要先打一局。');
    const mul=D.shopMul(s,s.roster,persona,cOf),has=c.wantChar?s.window.some(id=>cOf(id)?.charId===c.wantChar):true;
    const onDuty=D.SHOP.POSTS.filter(p=>s.roster[p]),staffPost=o.staffId?onDuty.find(p=>String(s.roster[p])===String(o.staffId)):(onDuty.length===1?onDuty[0]:''),pick=o.cardId&&s.window.includes(o.cardId)?cOf(o.cardId):null;const match=action==='serve'&&!c.visitor&&(c.need?.post?staffPost===c.need.post:c.need?.card?D.shopCardFits(c.need,pick):c.wantChar?!!pick&&pick.charId===c.wantChar:false),apt=match&&staffPost&&D.shopApt(persona(s.roster[staffPost]),staffPost)?1.1:1;const pr=action==='serve'&&!c.visitor?D.shopPrice(c,o.price,s.regulars[c.regularId]?.bond):{mul:1,rep:0,bond:0,say:''};const fee=action==='fight'?(o.won?Math.round(c.fee*mul*1.5):0):has?Math.round(c.fee*mul*(match?(o.auto?1.15:1.3)*apt:1)*pr.mul):0;s.coins+=fee;s.earned+=fee;const kind=c.need?.post||(c.need?.card||c.wantChar?'卡':''),pool=match&&D.SHOP_THANKS[kind]||[];Object.assign(c,{done:true,got:fee,miss:!!c.wantChar&&!has,...(action==='fight'?{won:!!o.won}:{}),...(action==='serve'&&!c.visitor?{match,by:staffPost?s.roster[staffPost]:'',cardGiven:pick?pick.id:'',thanks:match?(D.faceThanks(c.name,c.id.length+s.day)||(pool.length?pool[(c.id.length+s.day)%pool.length]:'')):''}:{})});if(fee>0){bumpOrder(s,'earn',fee);}if(action==='serve'&&!c.visitor){c.price=o.price||'mid';c.priceSay=pr.say;if(pr.left)c.left=true;s.rep=Math.max(0,(s.rep||0)+pr.rep);if(pr.bond&&c.regularId&&s.regulars[c.regularId])s.regulars[c.regularId].bond+=pr.bond;if(c.rareId){s.rareSeen={...obj(s.rareSeen)};const r0=s.rareSeen[c.rareId]||{n:0,first:s.date};s.rareSeen[c.rareId]={...r0,n:r0.n+1,last:s.date};}}if(action==='serve'){s.rep=(s.rep||0)+(match?15:10);bumpOrder(s,'serve');if(match)bumpOrder(s,'match');if(c.urgent)bumpOrder(s,'urgent');meetRegular(s,c);}else if(o.won){s.rep=(s.rep||0)+25;bumpOrder(s,'win');}
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
     const data=kind==='meet'?{mode:'shopmeet',day:s.day,decor:s.decor.join('、'),visitor:name(o,c.charId),visitorId:c.charId,staffId,staffName:name(o,staffId),post}:{mode:'shopclose',day:s.day,decor:s.decor.map(k=>k+((s.decorLv[k]||1)>1?'（翻新'+s.decorLv[k]+'级）':'')).join('、'),staff:posts.filter(p=>s.roster[p]).map(p=>name(o,s.roster[p])+'在'+p).join('、'),staffIds:staff,window:s.window.map(cardLine).join('；'),badges:posts.filter(p=>s.badge[p]).map(p=>name(o,s.roster[p])+'挂着'+cardLine(s.badge[p])).join('；'),coins:s.earned,customers:s.customers.filter(c=>c.done).map(c=>c.visitor?name(o,c.charId):c.name+(c.tough?(c.won?'（打赢了）':'（没打过）'):'')).join('、'),pairs:Object.keys(s.pair||{}).filter(k=>{const [a,b]=k.split('|');return staff.map(String).includes(a)&&staff.map(String).includes(b)&&s.pair[k]>=5;}).map(k=>{const [a,b]=k.split('|');return name(o,a)+'和'+name(o,b)+'一起值过 '+s.pair[k]+' 个班';}).join('；'),regulars:s.customers.filter(c=>c.done&&c.regularId&&s.regulars[c.regularId]&&s.regulars[c.regularId].bond>1).map(c=>c.name+'（来过 '+s.regulars[c.regularId].bond+' 回'+(c.story?'，今天'+c.story:'')+'）').join('、')};
     if(kind==='missed')Object.assign(data,s.missed,{mode:'shopclose',missed:true,coins:s.missed.earned,staffIds:s.missed.staffIds||[s.missed.first]});
     request={data,cast:copy(kind==='missed'?s.missed.cast||{}:s.roster),storyDate:kind==='missed'?s.missed.date||'':s.date,storyDay:kind==='missed'?s.missed.day:s.day,allowed:[...new Set([...(data.staffIds||[]),data.visitorId,data.staffId].filter(Boolean))],names:Object.fromEntries([...new Set([...(data.staffIds||[]),data.visitorId,data.staffId].filter(Boolean))].map(id=>[id,name(o,id)])),charId:kind==='meet'?c.charId:kind==='missed'?s.missed.first:staff[0],staffId,visitorId:c?.charId,key,date:s.date,period:s.period,id:o.id};
     if(!request.charId||typeof o.onChat!=='function')throw Error('暂时没有能写这段话的角色或接口。');s.requests[key]={state:'pending',at:Date.now()};return {request};
    },o);
    if(prepare.done)return prepare.lines;
    if(!results.has(key)){
     request=prepare.request;
     try{const value=await o.onChat(request.charId,request.data),rows=Array.isArray(value)?value:arr(value?.lines),turns=cleanTurns(rows,request.allowed,request.names);if(!turns.length)throw Error('没有写出文字，请稍后重试。');results.set(key,{...request,turns,lines:turns.map(x=>x.text),notes:cleanNotes(value&&value.notes,request.allowed)});}
     catch(e){await transaction(s=>{if(s.requests[key])s.requests[key]={state:'failed'};},o).catch(()=>{});throw e;}
    }
    const result=results.get(key);
    await transaction(s=>{if(cancelled.has(key)||s.requests[key]?.state==='cancelled')throw Error('这次已经只关门，文字没有覆盖你的选择。');if(s.date!==result.date&&kind!=='meet'){retainStory(s,{date:result.storyDate,day:result.storyDay,lines:result.lines,turns:result.turns,notes:result.notes,cast:result.cast,at:Date.now()});return;}if(s.date!==result.date||(kind==='meet'&&s.period!==result.period))throw Error('原来的日期或客人批次已经结束，结果没有写入新一天。');
     if(s.requests[key]?.state==='cancelled')throw Error('这次已经只关门，文字没有覆盖你的选择。');if(kind==='close'){s.phase='closed';s.closing=result.lines;s.closingTurns=result.turns;s.notes=result.notes||[];s.closeCast=result.cast;s.closedAt=Date.now();retainStory(s,{date:result.storyDate,day:result.storyDay,lines:result.lines,turns:result.turns,notes:result.notes,cast:result.cast,at:s.closedAt});}
     else if(kind==='meet'){const c=s.customers.find(c=>c.id===result.id);if(!c)throw Error('原来的客人已经离开。');c.meet=result.lines;c.meetTurns=result.turns;c.meetCast={staffId:result.staffId,visitorId:result.visitorId};c.meetKey=key;s.visits=arr(s.visits).filter(v=>v.key!==key).concat([{key,date:s.date,day:s.day,period:s.period,visitorId:result.visitorId||c.charId,staffId:result.staffId,lines:result.lines,turns:result.turns,at:Date.now()}]).slice(-400);}
     else if(s.missed){s.missed.lines=result.lines;s.missed.turns=result.turns;s.missed.notes=result.notes;retainStory(s,{date:result.storyDate,day:result.storyDay,lines:result.lines,turns:result.turns,notes:result.notes,cast:result.cast,at:Date.now()});}
     s.requests[key]={state:'done'};
    },o);results.delete(key);return result.lines;
   })();jobs.set(key,job);try{return await job;}finally{jobs.delete(key);}
  }
  return {read:load,token,filterCards,sortedCards,hasResult:kind=>results.has(load().date+'|'+kind),busy:()=>jobs.size>0,
   failed:()=>!!failedOperation,sync:o=>failedOperation&&failedOperation!=='sync'?Promise.reject(Error('小店有未保存的操作，请先重试。')):transaction(()=>{},{...o,__operation:'sync'}),run:(action,o={})=>{const operation=JSON.stringify([action,o.id,o.post,o.cardId,o.name,o.from,o.to,o.charId]);if(failedOperation&&failedOperation!==operation)return Promise.reject(Error('请先重试刚才未保存的操作。'));o={...o,__operation:operation};const task=['close','meet','missed'].includes(action)?story(action,o):transaction(s=>{if(action==='closeLocal'){guard(s,o);if(s.phase==='plan')throw Error('先开门接客，再关门。');if(s.phase==='closed')return;s.phase='closed';s.closing=[];s.closingTurns=[];s.notes=[];s.closeCast={};for(const k of Object.keys(s.requests))if(s.requests[k]?.state==='pending'){s.requests[k]={state:'cancelled'};cancelled.add(k);}}else apply(s,action,o);},o);return task.then(value=>{if(failedOperation===operation)failedOperation=null;return value;},e=>{if(e.code!=='SHOP_SAVE_FAILED'&&failedOperation===operation)failedOperation=null;throw e;});}};
 }
 const shopSeed=()=>{let n=loadJSON('x_stampPatrolSalt',0);if(!n){n=(Math.random()*4294967295)>>>0||1;saveJSON('x_stampPatrolSalt',n);}return n;};
 let shared;
 const service=()=>shared||(shared=create({read:()=>loadJSON(KEY,null),write:async value=>{const r=await commitJSONDurable(KEY,value);return !!r?.durable&&r.live!==false;},seed:shopSeed,notify:s=>g.dispatchEvent?.(new CustomEvent('stamp-shop-change',{detail:s}))}));
 g.StampShop={KEY,diary,STORY_ACTIONS,history,seed:shopSeed,restore,token,filterCards,sortedCards,create,read:()=>service().read(),sync:o=>service().sync(o),run:(a,o)=>service().run(a,o),hasResult:k=>service().hasResult(k),busy:()=>service().busy(),failed:()=>service().failed()};
})(typeof window!=='undefined'?window:globalThis);
