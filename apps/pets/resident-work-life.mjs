import {TOWN_RESIDENTS} from './town-residents.mjs?v=fg-bf2a8f69e3079bf5';
import {weightedChoice} from './resident-choice.mjs?v=fg-bf2a8f69e3079bf5';

const copy=v=>structuredClone(v);
const num=(v,max=1e15)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const words=(v,n=120)=>typeof v==='string'?v.slice(0,n):'';
export const workDate=at=>{const d=new Date(at);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export const workKey=c=>c.role==='custom'?'custom-'+workHash(c.title):c.role;
export const workHash=s=>[...String(s)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,17);
export const WORK_DIRECTIONS={steady:{label:'踏实做现在这份',need:0},selective:{label:'挑选合适的委托',need:3},mentor:{label:'带人一起做',need:8},independent:{label:'开自己的小店或工作室',need:12,price:120}};
export const AFTER_CHOICES={company:'陪TA坐坐',listen:'听TA讲讲',space:'让TA独处一会儿',meal:'一起吃晚餐'};
const stages={writer:['梳理提纲','写成初稿','校读修改','装订交付'],artist:['构思画面','铺色绘制','调整画稿','整理成画'],designer:['确认需求','制作草稿','讨论修改','交付方案'],teacher:['准备主题','安排课堂','回看调整','整理课堂手记'],doctor:['准备交班','核对记录','复核整理','完成值班手札'],baker:['试配方','揉制试烤','调整口味','整理出炉记录'],barista:['搭配风味','调制试饮','调整比例','留下饮品配方'],florist:['确认用花','制作花束','调整搭配','完成花艺订单'],bookseller:['选择书目','准备荐书','整理反馈','完成阅读小册']};
export const projectSteps=c=>stages[c.role]||({field:['规划走访','实地记录','核实整理','交付观察册'],business:['确认订单','准备安排','核对交付','整理经营记录']}[c.form])||['准备资料','制作与处理','讨论修改','整理交付'];
const choices={
 order:{title:'临时来了一个小委托',options:[{id:'take',label:'接下这份委托',fatigue:4,rapport:2,tags:['explore','active'],style:'多试了一种做法'},{id:'negotiate',label:'商量一个合适的交期',fatigue:1,rapport:1,tags:['attentive','cautious'],style:'把交期和细节商量清楚'},{id:'decline',label:'先做好手头的安排',fatigue:0,rapport:0,tags:['quiet','rest'],style:'保留精力完成原定计划'}]},
 cover:{title:'工作伙伴想请TA搭把手',options:[{id:'help',label:'腾一点时间帮忙',fatigue:3,rapport:2,tags:['gentle','social'],style:'和伙伴一起完成交接'},{id:'plan',label:'一起重新分配事情',fatigue:1,rapport:1,tags:['tidy','attentive'],style:'重新安排了彼此的工作'},{id:'boundary',label:'说明今天能帮的范围',fatigue:0,rapport:0,tags:['cautious','quiet'],style:'约好了各自负责的部分'}]},
 revision:{title:'对方对作品有了不同想法',options:[{id:'discuss',label:'一起看看怎么修改',fatigue:2,rapport:2,tags:['social','patient'],style:'听取反馈后共同修改'},{id:'explain',label:'说明自己保留的设计',fatigue:1,rapport:0,friction:1,tags:['attentive','explore'],style:'解释并保留了自己的方案'},{id:'compare',label:'做两个方案再比较',fatigue:4,rapport:1,tags:['tidy','patient'],style:'拿出两种方案一起比较'}]}
};

export function restoreWorkLife(raw){
 const s=raw||{},bonds={};
 for(const n of TOWN_RESIDENTS){const b=s.bonds?.[n.id]||{};bonds[n.id]={rapport:Math.max(-20,Math.min(100,Number(b.rapport)||0)),contacts:num(b.contacts,1e6),meets:num(b.meets,1e6),friction:num(b.friction,1e6),lastAt:num(b.lastAt),meetDate:words(b.meetDate,12),last:words(b.last,240)};}
 const projects=Object.fromEntries(Object.entries(s.projects||{}).filter(([k,p])=>/^[\w-]+$/.test(k)&&typeof p?.id==='string').map(([k,p])=>[k,{...copy(p),done:num(p.done,3),history:Array.isArray(p.history)?p.history.filter(x=>typeof x?.id==='string').map(copy):[]}]));
 const paths=Object.fromEntries(Object.entries(s.paths||{}).filter(([k,p])=>/^[\w-]+$/.test(k)&&Object.hasOwn(WORK_DIRECTIONS,p?.mode)).map(([k,p])=>[k,{mode:p.mode,name:words(p.name,40),at:num(p.at),mentored:num(p.mentored,1e6),opened:p.opened===true}]));
 const after=s.after&&typeof s.after.id==='string'&&['quiet','share','celebrate','flowers','dinner'].includes(s.after.kind)?{...copy(s.after),time:num(s.after.time,300),phase:['waiting','going','shopping','returning','doing','done'].includes(s.after.phase)?s.after.phase:'waiting'}:null;
 const meeting=s.meeting&&TOWN_RESIDENTS.some(n=>n.id===s.meeting.peer)&&['coming','talking'].includes(s.meeting.phase)?{...copy(s.meeting),time:num(s.meeting.time,60)}:null;
 const contact=s.contact&&TOWN_RESIDENTS.some(n=>n.id===s.contact.peer)?{...copy(s.contact),time:num(s.contact.time,60)}:null;
 return {version:1,roomForm:['office','clinic','classroom','studio','business'].includes(s.roomForm)?s.roomForm:null,bonds,projects,paths,events:Array.isArray(s.events)?s.events.filter(e=>typeof e?.id==='string'&&Object.hasOwn(choices,e.kind)).map(copy):[],after,meeting,contact,pauseUntil:num(s.pauseUntil),careStyle:['auto','flowers','dinner','none'].includes(s.careStyle)?s.careStyle:'auto',careDate:words(s.careDate,12)};
}
const peerFor=c=>c.place==='bakery'?'baker':c.place==='florist'?'florist':c.place==='cafe'?'regular':TOWN_RESIDENTS[workHash(c.title)%TOWN_RESIDENTS.length].id;
const peerName=id=>TOWN_RESIDENTS.find(n=>n.id===id)?.name||'工作伙伴';
export function beginWorkProject(state,s,job){
 const k=workKey(s.contract),skill=state.skills[k],number=state.works.filter(w=>w.role===k).length+1;
 let p=state.life.projects[k];
 if(!p||p.done>=3)p=state.life.projects[k]={id:state.ownerId+':'+k+':project:'+number,role:k,title:(job?.product||s.contract.title+'的作品')+' · '+number,steps:projectSteps(s.contract),done:skill?.project||0,history:[],at:s.startAt};
 s.projectId=p.id;s.projectStep=p.done;s.skillKey=k;
 if(state.life.after)state.life.after.phase='done';state.life.contact=null;state.life.meeting=null;
 const path=state.life.paths[k];
 if(path?.mode==='independent'&&path.opened){s.contract={...s.contract,title:path.name||s.contract.title+'的小铺',place:'workroom',form:'business',independent:true};}
 if(s.contract.place==='workroom')state.life.roomForm=s.contract.form;
}
export function workEvent(state,s,preferences,at,{automatic=false,option}={}){
 if(s.worked<s.duration*.25)return null;
 let e=state.life.events.find(x=>x.id===s.id+':choice');
 if(!e){const kind=Object.keys(choices)[workHash(s.id)%3],d=choices[kind];e={id:s.id+':choice',shift:s.id,kind,title:d.title,peer:peerFor(s.contract),at,selected:null};state.life.events.push(e);}
 if(e.selected)return e;
 const d=choices[e.kind];
 if(!option&&!automatic)return e;
 const selective=state.life.paths[s.skillKey]?.mode==='selective';
 const pick=option||weightedChoice(d.options.map(o=>({id:o.id,weight:Math.exp(Math.max(-3,Math.min(3,o.tags.reduce((n,t)=>n+(preferences[t]||0),0)*.5+(state.fatigue>60?-o.fatigue*.6:0)+(selective&&['negotiate','boundary','decline'].includes(o.id)?1.5:0))))})),()=>workHash(e.id)/4294967296);
 const o=d.options.find(o=>o.id===pick);if(!o)return null;
 e.selected=o.id;e.automatic=!option;e.resolvedAt=at;e.summary=o.style;e.label=o.label;
 state.fatigue=Math.min(97,state.fatigue+o.fatigue);
 const b=state.life.bonds[e.peer];b.contacts++;b.rapport=Math.min(100,b.rapport+o.rapport);const fit=(TOWN_RESIDENTS.find(n=>n.id===e.peer)?.workTags||[]).reduce((n,t)=>n+(preferences[t]||0),0);if(fit<0){b.rapport=Math.max(-20,b.rapport-1);b.friction++;}b.friction+=o.friction||0;b.lastAt=at;b.last=o.style;
 const p=Object.values(state.life.projects).find(p=>p.id===s.projectId);if(p)p.history.push({id:e.id,at,text:o.style,peer:e.peer});
 return e;
}
export function settleWorkDay(state,s,at,preferences,{complete=false,offline=false,job=null}={}){
 const k=s.skillKey||workKey(s.contract),p=state.life.projects[k],e=workEvent(state,s,preferences,at,{automatic:true});
 if(complete&&p&&!p.history.some(h=>h.id===s.id)){p.done=Math.min(3,p.done+1);p.history.push({id:s.id,at,text:p.steps[p.done-1]+'，这一班已完成'});}
 const path=state.life.paths[k];if(complete&&path?.mode==='mentor'&&s.mentored)path.mentored++;
 const w=state.works.find(w=>w.id===s.id+':work');if(w&&p){w.process=copy(p.history);w.steps=copy(p.steps);w.direction=path?.mode||'steady';}
 let kind=state.fatigue>65?'quiet':w?(preferences.social>0?'celebrate':'share'):preferences.quiet>preferences.social?'quiet':preferences.social>0?'share':'quiet';
 const style=state.life.careStyle,hour=new Date(at).getHours();
 if(complete&&state.fatigue<65&&hour>=8&&hour<21&&state.life.careDate!==workDate(at)&&style!=='none'){
  if((style==='dinner'||style==='auto'&&hour>=16&&(preferences.attentive||0)+(preferences.gentle||0)>1)&&state.balance>=38)kind='dinner';
  else if((style==='flowers'||style==='auto'&&(preferences.plants||0)>1)&&state.balance>=32)kind='flowers';
 }
 const wishes={quiet:'想安静歇一会儿',share:'想给你看看今天做的东西',celebrate:'想和你庆祝项目完成',flowers:'想顺路带一束花回家',dinner:'想准备一份两人晚餐'};
 state.life.after={id:s.id+':after',shift:s.id,kind,wish:wishes[kind],phase:'waiting',time:0,at,workTitle:s.contract.title,tool:job?.tool||'paper',decision:e?.summary||s.decision,offline,responded:false};state.life.contact=null;
}
export function workLifeRequest(state,action,o,{at,preferences,shift,home,available,log}){
 const l=state.life,no=text=>({accepted:false,text}),yes=text=>({accepted:true,text});
 if(action==='work-choice'){
  if(!shift||shift.phase!=='work')return no('到岗遇到这件事后，再一起商量。');
  const e=l.events.find(x=>x.id===o.id&&x.shift===shift.id);if(!e||e.selected)return no('这件事已经处理好了。');
  if(!choices[e.kind].options.some(x=>x.id===o.option))return no('选一个处理方式。');
  workEvent(state,shift,preferences,at,{option:o.option});log('decision',peerName(e.peer)+'的工作往来：'+e.summary,at,e.id+':resolved');return yes('已记下这次商量，会影响项目做法、相处和精力。');
 }
 if(action==='care-style'){if(!['auto','flowers','dinner','none'].includes(o.kind))return no('选好想带回家的心意。');l.careStyle=o.kind;return yes('已记住。收工后精力和工资足够时，再实际顺路准备；每个现实日最多一份。');}
 if(action==='career-rest'){
  if(shift)return no('先完成或结束这一班，再休息。');if(![1,3,7].includes(o.days))return no('选择休息一天、三天或一周。');
  const d=new Date(at);d.setHours(0,0,0,0);d.setDate(d.getDate()+o.days);l.pauseUntil=d.getTime();log('career','约好暂停出勤'+o.days+'天，职业和已有作品保留。',at);return yes('休息期间暂停两份排班，到约好的日期再恢复。');
 }
 if(action==='career-resume'){l.pauseUntil=0;state.at=at;return yes('休息告一段落，继续按原来的安排生活。');}
 if(action==='career-direction'){
  if(shift)return no('先结束这一班，再商量接下来的方向。');const c=state[o.slot==='side'?'side':'primary'],d=WORK_DIRECTIONS[o.mode];if(!c||!d)return no('先安排一份职业。');
  const k=workKey(c),skill=state.skills[k];if((skill?.shifts||0)<d.need)return no('这个方向需要先实际完成'+d.need+'班，慢慢积累。');
  const old=l.paths[k]||{mentored:0,opened:false};if(o.mode==='independent'&&!old.opened){if(state.balance<d.price)return no('自己的小店或工作室需要120工作零钱。');const id='resident-shop:'+k;state.balance-=d.price;state.ledger.push({id,at,kind:'spend',amount:-d.price,title:'布置自己的小店或工作室',note:'职业馆的独立工位，使用TA自己的工作零钱'});old.opened=true;}
  l.paths[k]={...old,mode:o.mode,name:words(o.name,40)||old.name||c.title+'的小铺',at};log('career','商量好了接下来：'+d.label+'。',at);return yes(o.mode==='independent'?'独立小店或工作室布置好了，下次出勤会沿路去职业馆的经营工位。':'下次出勤按这个方向安排；原职业和排班保留。');
 }
 if(action==='after-response'){
  const a=l.after;if(!a||a.phase==='done')return no('等TA收工回家，再一起待一会儿。');if(shift||!home)return no('先实际回到家里，再陪TA。');if(!Object.hasOwn(AFTER_CHOICES,o.kind))return no('选一种此刻的陪伴。');if(o.kind==='meal'&&!(a.kind==='dinner'&&a.delivered))return no('等TA把晚餐准备好，再一起吃。');
  if(a.responded)return no('这次陪伴已经约好了，回到场景一起待一会儿。');a.response=o.kind;a.spot=null;a.responded=true;a.phase='waiting';a.time=0;return yes('约好了，TA会走到家里合适的位置，再一起待一会儿。');
 }
 if(action==='meet-colleague'||action==='invite-colleague'){
  if(!TOWN_RESIDENTS.some(n=>n.id===o.peer)||!available(o.peer))return no('这位街坊正在赴约或忙自己的事，空下来再商量。');if(l.meeting||l.contact&&l.contact.phase!=='done')return no('先陪完这一次碰面。');
  if(action==='invite-colleague'){if(!shift||shift.phase!=='work')return no('到岗后再请工作伙伴过来商量。');l.contact={id:shift.id+':contact',peer:o.peer,phase:'coming',time:0,at};}
  else {if(shift)return no('先收工，再去见工作伙伴。');if(l.after)l.after.phase='done';l.meeting={id:'colleague:'+o.peer+':'+workDate(at),peer:o.peer,phase:'coming',time:0,at};}
  return yes('约好和'+peerName(o.peer)+'见面了，沿路走近后再打招呼。');
 }
 return null;
}
export function rememberWorkMeeting(state,m,at,log){const b=state.life.bonds[m.peer];if(b.meetDate!==workDate(at)){b.meets++;b.rapport=Math.min(100,b.rapport+1);b.meetDate=workDate(at);b.lastAt=at;b.last='和TA实际碰面，聊了聊工作';log('colleague','和'+peerName(m.peer)+'走近打过招呼，聊了聊工作。',at,m.id+':met');}}
export function workLifeView(state,{available=()=>false}={}){
 const l=state.life,s=state.shift,p=s&&l.projects[s.skillKey||workKey(s.contract)],event=s&&l.events.find(x=>x.shift===s.id&&!x.selected);
 return {...copy(l),people:TOWN_RESIDENTS.map(n=>({...n,canMeet:available(n.id),look:undefined,bond:copy(l.bonds[n.id]),relation:l.bonds[n.id].rapport<0?'还在磨合的工作伙伴':l.bonds[n.id].contacts>=6?'经常来往的工作伙伴':l.bonds[n.id].contacts?'有工作往来的街坊':l.bonds[n.id].meets?'见过面的街坊':'还在慢慢认识',role:state.primary?.place===n.shop||state.side?.place===n.shop?'同事与熟客':'客户与街坊'})),currentProject:p?copy(p):null,pending:event?{...copy(event),peerName:peerName(event.peer),options:copy(choices[event.kind].options).map(({id,label,fatigue})=>({id,label,fatigue}))}:null,directions:copy(WORK_DIRECTIONS),responses:{...AFTER_CHOICES}};
}
