import {realTime} from '../fairy-garden/real-clock.mjs?v=fg-8e92d657ad09bbcc';
const DAY=86400000;
// Stored civil dates stay fixed. Today's ordinal comes from the same real
// calendar as the town, so DST and the game's season/day counters cannot age a pet.
function ordinal(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
 return y>=100&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?Math.floor(date.getTime()/DAY):null;
}
const dateOf=day=>new Date(day*DAY).toISOString().slice(0,10);
export function restorePetBirth(raw){
 const born=ordinal(raw?.birthday),registered=ordinal(raw?.registeredOn),adopted=raw?.adoptedOn===null?null:ordinal(raw?.adoptedOn);
 if(born===null||registered===null||born>registered||raw?.adoptedOn!==null&&(adopted===null||adopted<born||adopted>registered))return null;
 return {birthday:raw.birthday,registeredOn:raw.registeredOn,adoptedOn:adopted===null?null:raw.adoptedOn};
}
export function newPetBirth({at=Date.now(),random=Math.random,legacy=false,ageDays}={}){
 const today=realTime(null,at),known=Number.isInteger(ageDays)&&ageDays>=56&&ageDays<=84,roll=known?0:Number(random());
 const age=known?ageDays:56+Math.floor((Number.isFinite(roll)?Math.max(0,Math.min(.999999999,roll)):.5)*29);
 return {birthday:dateOf(today.calendarDay-1-age),registeredOn:today.date,adoptedOn:legacy?null:today.date};
}
// The preview may cross midnight; adoption is recorded when it is confirmed.
// Keep the already drawn starting age while anchoring it to that actual date.
export function adoptPetBirth(entry,options={}){
 const old=restorePetBirth(entry.birth),ageDays=old?ordinal(old.registeredOn)-ordinal(old.birthday):undefined;
 entry.birth=newPetBirth({...options,ageDays});return entry.birth;
}
export function petBirthView(raw,at=Date.now()){
 const birth=restorePetBirth(raw);if(!birth)return null;
 const today=realTime(null,at),born=ordinal(birth.birthday),current=Math.max(born,today.calendarDay-1),days=current-born;
 const b=new Date(born*DAY),d=new Date(current*DAY);
 const monthDay=months=>{const y=b.getUTCFullYear(),m=b.getUTCMonth()+months,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return Math.floor(Date.UTC(y,m,Math.min(b.getUTCDate(),last))/DAY);};
 let months=(d.getUTCFullYear()-b.getUTCFullYear())*12+d.getUTCMonth()-b.getUTCMonth();if(current<monthDay(months))months--;
 const remainder=current-monthDay(months),years=Math.floor(months/12),weeks=Math.floor(days/7);
 const label=months<6?weeks+' 周'+(days%7?' '+days%7+' 天':''):years?(years+' 岁'+(months%12?' '+months%12+' 个月':'')+(remainder?' '+remainder+' 天':'')):months+' 个月'+(remainder?' '+remainder+' 天':'');
 return {...birth,days,weeks,months,years,label,birthdayLabel:b.getUTCFullYear()+' 年 '+(b.getUTCMonth()+1)+' 月 '+b.getUTCDate()+' 日',estimated:true,legacy:birth.adoptedOn===null};
}
