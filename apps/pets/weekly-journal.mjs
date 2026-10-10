import {PARCEL_ITEMS,parcelSourceTitle} from './parcels.mjs?v=fg-8c013226fd2a4c96';
export const JOURNAL_KINDS={work:'打工',care:'照料',friends:'朋友',collection:'小收藏',together:'结伴',life:'日常'};
const dateKey=at=>{const d=new Date(at);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
const text=s=>typeof s==='string'?s.slice(0,240):'';
export function restoreJournal(raw){const days={};for(const [date,rows]of Object.entries(raw?.days||{})){if(!dateOK(date)||!Array.isArray(rows))continue;days[date]=rows.filter(x=>JOURNAL_KINDS[x?.kind]&&text(x.text)&&Number.isFinite(x.first)&&Number.isFinite(x.last)).map(x=>({kind:x.kind,actor:text(x.actor),text:text(x.text),count:Math.max(1,Math.floor(x.count||1)),first:x.first,last:x.last}));}return {version:1,startedAt:Number.isFinite(raw?.startedAt)?raw.startedAt:Date.now(),seen:Array.isArray(raw?.seen)?raw.seen.filter(x=>typeof x==='string').slice(-1024):[],days};}
export function journalFact(j,{id,at,kind,actor='',text:message}){if(!id||!Number.isFinite(at)||at<=0||!JOURNAL_KINDS[kind]||!text(message)||j.seen.includes(id))return false;const rows=j.days[dateKey(at)]||(j.days[dateKey(at)]=[]),old=rows.find(x=>x.kind===kind&&x.actor===actor&&x.text===text(message));if(old){old.count++;old.first=Math.min(old.first,at);old.last=Math.max(old.last,at);}else rows.push({kind,actor:text(actor),text:text(message),count:1,first:at,last:at});j.seen.push(id);j.seen=j.seen.slice(-1024);return true;}
// Only original completed writers carry a timestamp. Old undated game-day rows
// are left in their existing books instead of assigning them a guessed date.
export function collectJournal(state,at=Date.now()){const j=state.journal||(state.journal=restoreJournal()),active=[];let changed=false;const add=x=>{active.push(x.id);changed=journalFact(j,x)||changed;};for(const p of state.pets||[]){const actor=p.profile?.name||'它',id=p.id;
 for(const x of p.domestic?.memories||[])add({id:'domestic:'+id+':'+x.id,at:x.at,kind:x.kind==='gift'?'friends':'life',actor,text:x.text});
 for(const x of p.care?.recent||[])if(x.completed&&x.wallAt)add({id:'care:'+id+':'+x.at+':'+x.wallAt+':'+x.text,at:x.wallAt,kind:'care',actor,text:x.text});
 for(const x of p.life?.notes||[])add({id:'life:'+id+':'+x.at+':'+x.text,at:x.at,kind:'life',actor,text:x.text});
 for(const x of p.career?.history||[])if(x.kind!=='rest'&&x.wallAt)add({id:'work:'+id+':'+x.id,at:x.wallAt,kind:'work',actor,text:x.text+' · 这一班赚了 ￥'+x.wage});
 for(const x of p.career?.ledger||[])if(x.wallAt&&x.amount<0)add({id:'ledger:'+id+':'+x.id,at:x.wallAt,kind:'collection',actor,text:x.text+' · 花了 ￥'+Math.abs(x.amount)});
 for(const x of p.career?.parcels?.opened||[])if(x.openedAt)add({id:'bag:'+id+':'+x.id,at:x.openedAt,kind:'collection',actor,text:'拆开'+parcelSourceTitle(x.source)+'的小袋子，收好了'+Object.entries(x.items).map(([k,n])=>PARCEL_ITEMS[k].name+' '+n+' '+PARCEL_ITEMS[k].unit).join('、')+'。'});
 for(const [peer,bond]of Object.entries(state.neighborhood?.neighbors||{}))for(const x of bond.met?.[id]?.recent||[])add({id:'friend:'+id+':'+peer+':'+x.at+':'+x.text,at:x.at,kind:'friends',actor,text:x.text});
 }
 for(const x of state.social?.recent||[])if(x.at)add({id:'social:'+x.id,at:x.at,kind:'friends',text:x.text});
 for(const x of state.resident?.life?.notes||[])add({id:'resident:'+x.at+':'+x.text,at:x.at,kind:'life',actor:state.resident.name||'TA',text:x.text});
 for(const x of state.household?.recent||[])if(x.completed)add({id:'chore:'+x.at+':'+x.text,at:x.at,kind:'care',text:x.text});
 for(const x of state.neighborhood?.recent||[])if(x.completed)add({id:'neighbor:'+x.at+':'+x.text,at:x.at,kind:'friends',text:x.text});
 // Retain guards for facts that are still present in the bounded source books.
 j.seen=[...new Set([...j.seen.slice(-512),...active])];return changed;}
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function shiftDate(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function journalWeek(j,date=dateKey(Date.now())){const start=weekStart(date),end=shiftDate(start,6),days=Array.from({length:7},(_,i)=>{const date=shiftDate(start,i),facts=structuredClone(j.days[date]||[]).sort((a,b)=>b.last-a.last);return {date,facts};}),counts=Object.fromEntries(Object.keys(JOURNAL_KINDS).map(kind=>[kind,days.flatMap(x=>x.facts).filter(x=>x.kind===kind).reduce((sum,x)=>sum+x.count,0)]));return {start,end,days,counts,total:Object.values(counts).reduce((a,b)=>a+b,0),startedAt:j.startedAt,weeks:[...new Set([weekStart(dateKey(Date.now())),weekStart(date),...Object.keys(j.days).map(weekStart)])].sort().reverse(),kinds:JOURNAL_KINDS};}
