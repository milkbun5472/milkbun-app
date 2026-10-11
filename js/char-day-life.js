// Small-world keepsakes and kitchen transactions share the existing home writer.
(function(root){
 "use strict";
 const {INGREDIENTS,RECIPES,recipe,kitchen,kitchenChange}=root.CharDayKitchen;
 // Read only the explicitly selected table from this character's actual kitchen writer.
 function kitchenMealFor(homes,charId,mealId){
  if(charId==null||typeof mealId!=='string'||!mealId)return null;
  const id=String(charId),s=kitchen(homes?.kitchens?.[id]);
  const meal=s.pending?.kind==='meal'&&s.pending.id===mealId?s.pending:s.history.find(m=>m.id===mealId);
  if(!meal)return null;
  const dishes=Array.isArray(meal.courses)?meal.courses:(meal.dishIds||[meal.dishId]).map(id=>s.dishes.find(d=>d.id===id));
  const courses=dishes.filter(d=>d&&recipe(d.recipeId)).slice(0,3).map(d=>({recipeId:d.recipeId,variation:d.variation&&typeof d.variation==='object'?{swaps:root.CharDayKitchen.variation(d.recipeId,d.variation).swaps,...Object.fromEntries(Object.keys(root.CharDayKitchen.TASTE).filter(k=>Object.hasOwn(root.CharDayKitchen.TASTE[k],d.variation[k])).map(k=>[k,d.variation[k]]))}:null,lead:['me','ta'].includes(d.lead)?d.lead:''}));
  return courses.length?{charId:id,mealId,courses}:null;
 }
 function kitchenMealHint(meal){
  if(!Array.isArray(meal?.courses))return '';
  const K=root.CharDayKitchen,lines=meal.courses.filter(d=>d&&recipe(d.recipeId)).slice(0,3).map(d=>K.dishName(d)+'；口味：'+(d.variation?Object.keys(K.TASTE).filter(k=>Object.hasOwn(K.TASTE[k],d.variation[k])).map(k=>K.TASTE[k][d.variation[k]]).join(' · ')||'未记录':'未记录')+'；分工：'+(d.lead==='me'?'用户掌勺，TA备菜':d.lead==='ta'?'TA掌勺，用户备菜':'未记录'));
  return lines.length?'\n\n【她分享的小家共餐】\n'+lines.join('\n')+'\n这是她选中的这一桌实际做法。怎么接她当前的话，由你这个人和你们的关系决定。':'';
 }
 const text=s=>String(s||'').slice(0,200);
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
 root.CharDayLife={...root.CharDayKitchen,INGREDIENTS,RECIPES,recipe,kitchen,kitchenChange,kitchenMealFor,kitchenMealHint,album,albumChange,PREFERENCES,recommendation,recommendLayout};
})(window);
