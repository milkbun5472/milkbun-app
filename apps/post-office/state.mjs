// Read-only projection. The writer and its clock remain StampDuel's text shop.
export const POSTS=Object.freeze({
  柜台:{x:-1.45,z:.1,yaw:0,gesture:'rest'},
  分拣:{x:-2.25,z:-1.65,yaw:Math.PI,gesture:'rest'},
  送信:{x:3.25,z:3.55,yaw:-.35,gesture:'rest'},
  看店:{x:3,z:-.6,yaw:0,gesture:'sit',seatHeight:.53}
});
export const DECOR_BUILDERS=Object.freeze({'旧木招牌':'sign','一盆绿萝':'plant','暖黄的吊灯':'lamp','靠窗的长凳':'bench','铜铃门帘':'bells','整面墙的信格':'cubbies','会走的老座钟':'clock','二楼的小阁楼':'loft'});
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const list=x=>Array.isArray(x)?x:[];
export function projectShop(raw,{characters=[],cards=[],lookFor=()=>({}),period='半夜',today='',shopRules}={}){
  const shop=record(raw),roster=record(shop.roster),decorLv=record(shop.decorLv),night=period==='半夜';
  const phase=shop.date&&today&&shop.date!==today?'plan':['plan','open','closed'].includes(shop.phase)?shop.phase:'plan';
  // A saved closed sign only applies to that civil day; the text writer carries
  // the roster into tomorrow and resets its phase when it is next opened.
  const closed=night||phase==='closed';
  const cardOf=id=>list(cards).find(c=>c&&c.id===id);const staff=[];
  for(const post of shopRules?.SHOP.POSTS||Object.keys(POSTS)){
    const id=roster[post],c=list(characters).find(c=>c&&String(c.id)===String(id));
    if(closed||id==null||id===''||!c||!POSTS[post])continue;
    let look={};try{look=record(lookFor(c));}catch{}
    staff.push({post,id:String(c.id),name:String(c.remark||c.name||'店员'),look:structuredClone(look),badge:cardOf(record(shop.badge)[post])||null,...POSTS[post],kind:'staff'});
  }
  const decor=[...new Set(list(shop.decor).filter(k=>typeof k==='string'&&(DECOR_BUILDERS[k]||shopRules?.shopDecorOf(k))))].map(name=>({name,builder:DECOR_BUILDERS[name]||'monthly:'+name,level:Math.max(1,Math.min(3,Math.floor(Number(decorLv[name]))||1))}));
  const windowIds=[...new Set(list(shop.window).filter(x=>typeof x==='string'))].slice(0,shopRules?.shopWinSlots({decor:list(shop.decor)})||3);
  const windowCards=windowIds.map(id=>list(cards).find(c=>c&&c.id===id)).filter(Boolean).map(c=>({id:c.id,name:String(record(c.text).name||'一枚邮票'),image:typeof(c.cover||c.face)==='string'?(c.cover||c.face):''}));
  const customers=list(shop.customers).filter(c=>c&&typeof c.id==='string').map(c=>{
    const ch=c.visitor&&list(characters).find(p=>p.id===c.charId);if(c.visitor&&!ch)return null;
    const look=ch?record(lookFor(ch)):npcLook(c);return {...c,key:[shop.date||today,shop.period,c.id].join('|'),kind:'guest',name:String(ch?.remark||ch?.name||c.name||'寄信的客人'),look:structuredClone(look),actorId:ch?.id||c.id};
  }).filter(Boolean);
  const availableDecor=shopRules?[...shopRules.SHOP.DECOR,...(shopRules.SHOP.MONTHLY[new Date().getMonth()+1]||[]).map(x=>shopRules.shopDecorOf(x[0]))].filter(Boolean).map(d=>({name:d.k,price:d.price,builder:DECOR_BUILDERS[d.k]||'monthly:'+d.k})):[];
  return {period,phase,closed,date:shop.date,rev:shop.rev,customers,availableDecor,lighting:night?'night':period==='傍晚'?'evening':'day',staff,decor,cards:windowCards};
}
export function npcLook(c){const name=String(c.name||'');return {hair:/老太|退休/.test(name)?'bob':/学生|小孩/.test(name)?'pixie':'korean',hairColor:/老太|退休/.test(name)?'#aca79b':'#554a3c',outfit:/审查|对家|退款/.test(name)?'suit':/学生/.test(name)?'academy':/老太|花店/.test(name)?'cardigan':'ranger',face:c.tough?'irritated':'default'};}
