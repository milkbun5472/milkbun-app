// Read-only projection. The writer and its clock remain StampDuel's text shop.
export const POSTS=Object.freeze({
  柜台:{x:-1.45,z:.1,yaw:0,gesture:'rest'},
  分拣:{x:-2.25,z:-1.65,yaw:Math.PI,gesture:'rest'},
  送信:{x:3.25,z:3.55,yaw:-.35,gesture:'rest'},
  看店:{x:3,z:-.6,yaw:0,gesture:'sit',seat:.53}
});
export const DECOR_BUILDERS=Object.freeze({'旧木招牌':'sign','一盆绿萝':'plant','暖黄的吊灯':'lamp','靠窗的长凳':'bench','铜铃门帘':'bells'});
const record=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const list=x=>Array.isArray(x)?x:[];
export function projectShop(raw,{characters=[],cards=[],lookFor=()=>({}),period='半夜',today='',shopRules}={}){
  const shop=record(raw),roster=record(shop.roster),decorLv=record(shop.decorLv),night=period==='半夜';
  const phase=shop.date&&today&&shop.date!==today?'plan':['plan','open','closed'].includes(shop.phase)?shop.phase:'plan';
  // A saved closed sign only applies to that civil day; the text writer carries
  // the roster into tomorrow and resets its phase when it is next opened.
  const closed=night||phase==='closed';
  const staff=[];
  for(const post of shopRules?.SHOP.POSTS||Object.keys(POSTS)){
    const id=roster[post],c=list(characters).find(c=>c&&String(c.id)===String(id));
    if(closed||id==null||id===''||!c||!POSTS[post])continue;
    let look={};try{look=record(lookFor(c));}catch{}
    staff.push({post,id:String(c.id),name:String(c.remark||c.name||'店员'),look:structuredClone(look),...POSTS[post]});
  }
  const decor=[...new Set(list(shop.decor).filter(k=>typeof k==='string'&&DECOR_BUILDERS[k]))].map(name=>({name,builder:DECOR_BUILDERS[name],level:Math.max(1,Math.min(3,Math.floor(Number(decorLv[name]))||1))}));
  const windowIds=[...new Set(list(shop.window).filter(x=>typeof x==='string'))].slice(0,shopRules?.shopWinSlots({decor:list(shop.decor)})||3);
  const windowCards=windowIds.map(id=>list(cards).find(c=>c&&c.id===id)).filter(Boolean).map(c=>({id:c.id,name:String(record(c.text).name||'一枚邮票'),image:typeof(c.cover||c.face)==='string'?(c.cover||c.face):''}));
  return {period,phase,closed,lighting:night?'night':period==='傍晚'?'evening':'day',staff,decor,cards:windowCards};
}
