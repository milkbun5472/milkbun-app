import {windowSeat,SHOP_CHAIR,SHOP_FLOOR} from './furniture.mjs?v=fg-8471d3c70eba9722';
import {realTime} from '../fairy-garden/real-clock.mjs?v=fg-8471d3c70eba9722';
import {calendarEnvironment} from '../pets/environment.mjs?v=fg-8471d3c70eba9722';
import {npcLook} from './npc-appearance.mjs?v=fg-8471d3c70eba9722';
import {seatLook} from '../fairy-garden/wardrobe.mjs?v=fg-8471d3c70eba9722';
export {npcLook};
// Read-only projection. The writer and its clock remain StampDuel's text shop.
export const POSTS=Object.freeze({
  柜台:{x:-1.45,z:.1,yaw:0,gesture:'rest'},
  分拣:{x:-2.25,z:-1.65,yaw:Math.PI,gesture:'rest'},
  送信:{x:3.25,z:3.55,yaw:-.35,gesture:'rest'},
  看店:{x:SHOP_CHAIR.x,z:SHOP_CHAIR.z,yaw:0,gesture:'sit',seatHeight:SHOP_FLOOR+SHOP_CHAIR.seat,seat:windowSeat()}
});
export const DECOR_BUILDERS=Object.freeze({'旧木招牌':'sign','一盆绿萝':'plant','暖黄的吊灯':'lamp','靠窗的长凳':'bench','铜铃门帘':'bells','整面墙的信格':'cubbies','会走的老座钟':'clock','二楼的小阁楼':'loft'});
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const list=x=>Array.isArray(x)?x:[];
export function projectShop(raw,{characters=[],cards=[],lookFor=()=>({}),period='半夜',today='',shopRules,time=null,weatherSeed=1,stories=[]}={}){
  const roleLook=c=>{let saved={};try{saved=record(lookFor(c));}catch{}return seatLook('companion',saved,c.ta||'TA');};
  const shop=record(raw),roster=record(shop.roster),decorLv=record(shop.decorLv),night=period==='半夜';
  const phase=shop.date&&today&&shop.date!==today?'plan':['plan','open','closed'].includes(shop.phase)?shop.phase:'plan';
  // A saved closed sign only applies to that civil day; the text writer carries
  // the roster into tomorrow and resets its phase when it is next opened.
  const closed=night||phase==='closed';
  const cardOf=id=>list(cards).find(c=>c&&c.id===id);
  function staffFor(saved){const result=[];for(const post of shopRules?.SHOP.POSTS||Object.keys(POSTS)){const id=record(saved)[post],c=list(characters).find(c=>c&&String(c.id)===String(id));if(id==null||id===''||!c||!POSTS[post])continue;result.push({post,id:String(c.id),name:String(c.remark||c.name||'店员'),look:structuredClone(roleLook(c)),badge:cardOf(record(shop.badge)[post])||null,...POSTS[post],kind:'staff'});}return result;}
  const staff=closed?[]:staffFor(roster),storyOf=s=>({...s,staff:staffFor(record(s).cast)});
  const dateParts=String(today||shop.date||'2026-1-1').split('-').map(Number),fallback=new Date(dateParts[0]||2026,(dateParts[1]||1)-1,dateParts[2]||1,({上午:10,下午:15,傍晚:19,半夜:1}[period]||1));
  const environment=calendarEnvironment(time||realTime(null,fallback.getTime()),weatherSeed);
  const decor=[...new Set(list(shop.decor).filter(k=>typeof k==='string'&&(DECOR_BUILDERS[k]||shopRules?.shopDecorOf(k))))].map(name=>({name,builder:DECOR_BUILDERS[name]||'monthly:'+name,level:Math.max(1,Math.min(3,Math.floor(Number(decorLv[name]))||1))}));
  const windowIds=[...new Set(list(shop.window).filter(x=>typeof x==='string'))].slice(0,shopRules?.shopWinSlots({decor:list(shop.decor)})||3);
  const windowCards=windowIds.map(id=>list(cards).find(c=>c&&c.id===id)).filter(Boolean).map(c=>({id:c.id,name:String(record(c.text).name||'一枚邮票'),image:typeof(c.cover||c.face)==='string'?(c.cover||c.face):''}));
  const customers=list(shop.customers).filter(c=>c&&typeof c.id==='string').map(c=>{
    const ch=c.visitor&&list(characters).find(p=>p.id===c.charId);if(c.visitor&&!ch)return null;
    const look=ch?roleLook(ch):npcLook(c,shopRules);return {...c,key:[shop.date||today,shop.period,c.id].join('|'),kind:'guest',name:String(ch?.remark||ch?.name||c.name||'寄信的客人'),look:structuredClone(look),actorId:ch?.id||c.id,npcStyle:ch?null:look.npcStyle};
  }).filter(Boolean);
  const availableDecor=shopRules?[...shopRules.SHOP.DECOR,...(shopRules.SHOP.MONTHLY[new Date().getMonth()+1]||[]).map(x=>shopRules.shopDecorOf(x[0]))].filter(Boolean).map(d=>({name:d.k,price:d.price,builder:DECOR_BUILDERS[d.k]||'monthly:'+d.k})):[];
  return {period,phase,closed,date:shop.date,rev:shop.rev,ambient:true,environment,closing:storyOf({date:shop.date,day:shop.day,lines:list(shop.closing),turns:list(shop.closingTurns),cast:record(shop.closeCast)}),stories:list(stories).map(storyOf),customers,availableDecor,lighting:night?'night':period==='傍晚'?'evening':'day',staff,decor,cards:windowCards};
}
