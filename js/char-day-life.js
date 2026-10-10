// Small-world keepsakes and kitchen transactions share the existing home writer.
(function(root){
 "use strict";
 const {INGREDIENTS,RECIPES,recipe,kitchen,kitchenChange}=root.CharDayKitchen;
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
 root.CharDayLife={INGREDIENTS,RECIPES,recipe,kitchen,kitchenChange,album,albumChange,PREFERENCES,recommendation,recommendLayout};
})(window);
