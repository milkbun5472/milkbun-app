// Public action vocabulary shared by saved-story validation and scene playback.
(function(g){
 const catalog={
  talk:{note:'面对对方说话',seconds:0},tidy:{note:'回岗位收拾',seconds:1.5},letter:{note:'拿起信件',seconds:1.2},look:{note:'走到橱窗看卡',seconds:1.5},rest:{note:'到窗边歇脚',seconds:1.2},help:{note:'走近另一位店员搭手',seconds:1.8,target:true},
  wave:{note:'抬手挥两下',seconds:3.4,gesture:'wave'},pat:{note:'走近target拍肩，对方转头',seconds:3,target:true},stretch:{note:'原地伸懒腰',seconds:3.8,gesture:'stretch'},hand:{note:'把信递给target，对方伸手接住',seconds:4,target:true},
  laugh:{note:'笑得肩膀轻抖、头微仰',seconds:2.6,emotion:'laugh'},sigh:{note:'肩一沉、低头叹气',seconds:2.6,emotion:'gloomy'},cheer:{note:'举手欢呼',seconds:3,emotion:'cheer'},bow:{note:'欠身鞠躬',seconds:2.8,emotion:'bow'},crossarms:{note:'抱臂',seconds:3,emotion:'crossarms'},sweep:{note:'拿扫帚扫地',seconds:4},lamp:{note:'走到吊灯下拉绳关灯',seconds:3.2},sit:{note:'就近找空座坐下',seconds:1.2}
 };
 for(const action of Object.values(catalog))Object.freeze(action);Object.freeze(catalog);
 const normalize=(action,target=true)=>Object.hasOwn(catalog,action)&&(!catalog[action].target||target)?action:'talk';

 // 场景自己从原句认动作（她 2026-11-08 看了正文对比：给模型列动作清单会把伸懒腰、拉灯绳带进故事）。
 //   模型只写故事；这里按原句里写到的动作挑一个演，认不出就 talk。排在前面的先认。
 const CUES=[['hand',/递给|递过去|递到|塞给|塞到.{0,6}手里/],['pat',/拍了?(拍|一下)?.{0,6}(肩|背)/],['sweep',/扫帚|扫地|扫了扫/],['lamp',/拉.{0,4}(灯)?绳|关(了|掉)?灯|灯(灭|暗)/],
  ['stretch',/伸了?个?懒腰/],['wave',/挥(了挥|挥)?手|摆了摆手/],['bow',/鞠(了个)?躬|欠了?欠?身/],['crossarms',/抱(着)?臂|抱着胳膊|环着手/],['cheer',/欢呼|举起(双)?手|跳了起来/],
  ['sigh',/叹(了)?(口)?气/],['laugh',/笑出(了)?声|哈哈|笑得|笑了起来/],['sit',/坐(了)?下|坐到|坐在/],['rest',/歇(一会|口气|脚)|靠在窗/],['look',/橱窗/],['letter',/拿起.{0,6}信|信封|邮包|信袋/],
  ['help',/搭(把)?手|帮.{0,3}(搬|拿|理|抬)/],['tidy',/收拾|码齐|码好|理好|整理|擦(了擦)?柜台/]];
 const infer=text=>{const t=String(text||'');for(const [id,re] of CUES)if(re.test(t))return id;return 'talk';};
 // 原句里提到的人：按出现先后，names 是 {id: 名字}
 const mentioned=(text,names={})=>Object.entries(names||{}).filter(([,n])=>n&&String(text||'').includes(n)).sort((a,b)=>String(text).indexOf(a[1])-String(text).indexOf(b[1])).map(([id])=>id);
 g.CharacterStoryActions=Object.freeze({catalog,infer,mentioned,prompt:Object.entries(catalog).map(([id,row])=>id+'（'+row.note+'）').join('、'),ids:Object.freeze(Object.keys(catalog)),normalize});
})(globalThis);
