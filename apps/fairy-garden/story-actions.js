// Public action vocabulary shared by saved-story validation and scene playback.
(function(g){
 const catalog={
  talk:{note:'面对对方说话',seconds:0},tidy:{note:'回岗位收拾',seconds:1.5},letter:{note:'拿起信件',seconds:1.2},look:{note:'走到橱窗看卡',seconds:1.5},rest:{note:'到窗边歇脚',seconds:1.2},help:{note:'走近另一位店员搭手',seconds:1.8,target:true},
  wave:{note:'抬手挥两下',seconds:3.4,gesture:'wave'},pat:{note:'走近target拍肩，对方转头',seconds:3,target:true},stretch:{note:'原地伸懒腰',seconds:3.8,gesture:'stretch'},hand:{note:'把信递给target，对方伸手接住',seconds:4,target:true},
  laugh:{note:'笑得肩膀轻抖、头微仰',seconds:2.6,emotion:'laugh'},sigh:{note:'肩一沉、低头叹气',seconds:2.6,emotion:'gloomy'},cheer:{note:'举手欢呼',seconds:3,emotion:'cheer'},bow:{note:'欠身鞠躬',seconds:2.8,emotion:'bow'},crossarms:{note:'抱臂',seconds:3,emotion:'crossarms'},sweep:{note:'拿扫帚扫地',seconds:4},lamp:{note:'走到吊灯下拉绳关灯',seconds:3.2},sit:{note:'就近找空座坐下',seconds:1.2}
 };
 for(const action of Object.values(catalog))Object.freeze(action);Object.freeze(catalog);
 const normalize=(action,target=true)=>Object.hasOwn(catalog,action)&&(!catalog[action].target||target)?action:'talk';
 g.CharacterStoryActions=Object.freeze({catalog,prompt:Object.entries(catalog).map(([id,row])=>id+'（'+row.note+'）').join('、'),ids:Object.freeze(Object.keys(catalog)),normalize});
})(globalThis);
