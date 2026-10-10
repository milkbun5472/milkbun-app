// Small-world keepsakes and kitchen transactions share the existing home writer.
(function(root){
 "use strict";
 const INGREDIENTS={tomato:"番茄",egg:"鸡蛋",noodle:"面条",mushroom:"蘑菇",rice:"米饭"};
 const RECIPES=[
  {id:"tomato-rice",name:"番茄蛋饭",need:{tomato:1,egg:1,rice:1},note:"一个人搅锅，一个人切番茄，做好留两份。"},
  {id:"mushroom-noodle",name:"菌菇汤面",need:{mushroom:1,noodle:1},note:"把蘑菇和面条煮进汤里，热热地端上桌。"},
  {id:"egg-noodle",name:"番茄鸡蛋面",need:{tomato:1,egg:1,noodle:1},note:"厨房里一起备菜、搅拌，最后各盛一碗。"}
 ];
 const text=s=>String(s||"").slice(0,200),recipe=id=>RECIPES.find(r=>r.id===id);
 function kitchen(raw={}){
  raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  return {...raw,version:1,ingredients:Object.fromEntries(Object.keys(INGREDIENTS).map(id=>[id,Math.max(0,Math.min(99,Math.floor(Number(raw.ingredients?.[id])||0)))])),
   dishes:(Array.isArray(raw.dishes)?raw.dishes:[]).filter(d=>d&&typeof d.id==='string'&&recipe(d.recipeId)&&Number.isFinite(d.at)).map(d=>({...d,servings:Math.max(1,Math.min(2,Math.floor(d.servings)||2))})),
   pending:raw.pending&&typeof raw.pending.id==='string'&&['cook','meal'].includes(raw.pending.kind)?{...raw.pending}:null};
 }
 function kitchenChange(raw,action){
  const s=kitchen(raw),p=s.pending;
  if(action.kind==='stock'){
   if(!Object.hasOwn(INGREDIENTS,action.ingredient))throw Error('先选一种食材。');
   if(s.ingredients[action.ingredient]>=99)throw Error('这一样已经放满了。');
   return {...s,ingredients:{...s.ingredients,[action.ingredient]:Math.min(99,s.ingredients[action.ingredient]+3)}};
  }
  if(action.kind==='cancel')return {...s,pending:null};
  if(action.kind==='begin'){
   if(p)throw Error('先做完或收起手头这一份。');
   if(s.dishes.length>=60)throw Error('餐盒已经放满了，先吃一些再做。');
   const r=recipe(action.recipeId);if(!r)throw Error('先选一个做法。');
   const missing=Object.entries(r.need).filter(([id,n])=>s.ingredients[id]<n).map(([id,n])=>INGREDIENTS[id]+' ×'+(n-s.ingredients[id]));
   if(missing.length)throw Error('还缺：'+missing.join('、'));
   return {...s,pending:{id:action.id,kind:'cook',recipeId:r.id,ready:false}};
  }
  if(action.kind==='serve'){
   if(p)throw Error('先做完或收起手头这一份。');
   const d=s.dishes.find(d=>d.id===action.dishId);if(!d)throw Error('这份已经吃完了。');
   return {...s,pending:{id:action.id,kind:'meal',dishId:d.id,recipeId:d.recipeId,ready:false}};
  }
  if(!p||p.id!==action.id)throw Error('这一份已经收起了。');
  if(action.kind==='ready')return {...s,pending:{...p,ready:true}};
  if(action.kind!=='finish'||!p.ready)throw Error('先在现场完成，再收好这一份。');
  if(p.kind==='meal'){
   if(!s.dishes.some(d=>d.id===p.dishId))throw Error('这份已经吃完了。');
   return {...s,pending:null,dishes:s.dishes.filter(d=>d.id!==p.dishId),eaten:(Number(s.eaten)||0)+1};
  }
  const r=recipe(p.recipeId);if(!r)throw Error('做法没有找到，食材还在。');
  if(Object.entries(r.need).some(([id,n])=>s.ingredients[id]<n))throw Error('食材不够，先补齐这一份。');
  return {...s,pending:null,ingredients:Object.fromEntries(Object.entries(s.ingredients).map(([id,n])=>[id,n-(r.need[id]||0)])),dishes:[...s.dishes,{id:p.id,recipeId:r.id,at:action.at,servings:2}]};
 }
 function album(raw,charId){return (Array.isArray(raw)?raw:[]).filter(p=>p&&p.charId===String(charId)&&typeof p.id==='string'&&Number.isFinite(p.at)&&typeof p.src==='string'&&p.src.length<1500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.src));}
 function albumChange(raw,charId,action){
  const rows=album(raw,charId);
  if(action.kind==='delete')return rows.filter(p=>p.id!==action.id);
  if(action.kind==='note')return rows.map(p=>p.id===action.id?{...p,note:text(action.note)}:p);
  if(action.kind==='add'){
   if(rows.length>=80)throw Error('相册已经有80张，先导出或删几张再拍。');
   const photo=album([action.photo],charId)[0];if(!photo)throw Error('照片还没拍好，可以再试一次。');
   return rows.some(p=>p.id===photo.id)?rows:[...rows,photo];
  }
  throw Error('没有找到这个相册操作。');
 }
 const PREFERENCES=[
  {id:'warm',label:'暖木与手作',words:/原木|暖木|木质|手作|田园|复古|温暖色/,wall:'cream',floor:'warm',furniture:['canopy-bed','rattan-sofa','paper-lantern']},
  {id:'light',label:'清浅与自然',words:/浅色|浅木|清爽|北欧|自然风|绿植|植物|雾蓝|苔绿/,wall:'sage',floor:'light',furniture:['basket-shelf','tall-plant','braided-rug']},
  {id:'dusk',label:'深木与旧书',words:/深木|深色木|古典|旧书|书房|胡桃木|英伦/,wall:'panel',floor:'dark',furniture:['spindle-bed','rolled-sofa','stained-lamp']},
  {id:'rose',label:'柔软与淡粉',words:/淡粉|粉色|藕粉|奶油风|柔软|浪漫|可爱风/,wall:'rose',floor:'light',furniture:['panel-bed','cloud-sofa','mushroom-lamp']},
  {id:'ink',label:'灰石与利落',words:/工业风|极简|黑白|灰色|灰石|金属|冷色/,wall:'cream',floor:'stone',furniture:['steel-bed','tube-sofa','glass-table']}
 ];
 function recommendation(persona,wish=''){
  const source=String(wish||'').trim()?String(wish):String(persona||'');
  const clauses=source.split(/[。；;\n！？]/).filter(s=>!/(不喜欢|讨厌|排斥|不想|不要|避免|不爱|拒绝)/.test(s));
  for(const clause of clauses){if(!wish&&!/(喜欢|偏爱|喜爱|钟爱|爱好|偏好|房间|装修|家居|住处)/.test(clause))continue;
   for(const p of PREFERENCES){const match=clause.match(p.words);if(match)return {...p,evidence:match[0],source:wish?'你的想法':'人设里的偏好'};}}
  return null;
 }
 // Recommendation never replaces a saved manual finish, furniture or placement.
 function recommendLayout(raw,suggestion){
  const room=raw?.$room||{},next={...room};
  if(!room.wallColor&&(!room.wall||room.wall==='auto'))next.wall=suggestion.wall;
  if(!room.floorColor&&(!room.floor||room.floor==='auto'))next.floor=suggestion.floor;
  return {...raw,$room:next};
 }
 root.CharDayLife={INGREDIENTS,RECIPES,recipe,kitchen,kitchenChange,album,albumChange,PREFERENCES,recommendation,recommendLayout};
})(window);
