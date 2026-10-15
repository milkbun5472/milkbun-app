// One body-language vocabulary for the production care state and art previews.
export const PET_MOODS=[
 {id:'neutral',label:'自然',summary:'心情平稳'},
 {id:'happy',label:'开心',summary:'心情很好'},
 {id:'relaxed',label:'放松',summary:'舒服地放松着'},
 {id:'curious',label:'好奇',summary:'好奇地观察着'},
 {id:'sleepy',label:'困困',summary:'困困的，想歇一会儿'},
 {id:'guarded',label:'警惕',summary:'想先保持一点距离'},
 {id:'gloomy',label:'闷闷',summary:'有点闷闷的'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function normalizePetMood(value){const id=typeof value==='string'?value:value?.id;return {id:PET_MOODS.some(m=>m.id===id)?id:'neutral',intensity:clamp(Number.isFinite(value?.intensity)?value.intensity:1,0,1)};}
export function moodFromCare(care={},reaction=false){
 const task=care.task,doing=task?.phase==='doing';
 if(doing&&task.kind==='sleep'||Number.isFinite(care.energy)&&care.energy<30)return {id:'sleepy',intensity:1};
 if(reaction)return {id:'guarded',intensity:1};
 if(doing&&['play','pet','treat'].includes(task.kind))return {id:'happy',intensity:1};
 if(task?.kind==='watch'||task?.phase==='walking')return {id:'curious',intensity:.85};
 if(Number.isFinite(care.mood)&&care.mood<35)return {id:'gloomy',intensity:clamp((45-care.mood)/30,.45,1)};
 if(Number.isFinite(care.mood)&&care.mood>78)return {id:'happy',intensity:clamp((care.mood-65)/30,.45,1)};
 return {id:'relaxed',intensity:.8};
}
export function samplePetMood(species,value,time=0){
 const {id,intensity}=normalizePetMood(value),dog=species==='dog',t=Number.isFinite(time)?time:0;
 const base={height:0,forward:0,pitch:0,roll:0,chestHeight:0,pelvisHeight:0,headPitch:0,headYaw:0,headRoll:0,earPitch:0,earSpread:0,tailPitch:0,tailYaw:0,tailAmplitude:dog?.24:.105,tailFrequency:dog?4.2:1.7};
 let p={};
 if(id==='happy')p={height:.003*Math.sin(t*(dog?4.8:2.4)),roll:(dog?.025:.01)*Math.sin(t*3),chestHeight:dog?-.025*(.5+.5*Math.sin(t*1.8)):0,pelvisHeight:dog?.003:0,headPitch:-.045,headRoll:.035*Math.sin(t*1.5),earPitch:dog?.025:.07,earSpread:dog?-.13:-.05,tailPitch:dog?.10:.06,tailAmplitude:dog?.31:.075,tailFrequency:dog?5.4:2.2};
 if(id==='relaxed')p={height:-.007+.0017*Math.sin(t*1.6),headPitch:.025,headRoll:.025*Math.sin(t*.55),earPitch:-.035,earSpread:dog?.035:.10,tailPitch:dog?-.14:-.14,tailAmplitude:dog?.075:.035,tailFrequency:1.3};
 if(id==='curious')p={forward:.008,headPitch:-.035,headYaw:.075*Math.sin(t*.9),headRoll:.13*Math.sin(t*.7),earPitch:dog?.05:.12,earSpread:dog?-.16:-.075,tailAmplitude:dog?.10:.055,tailFrequency:1.8};
 if(id==='sleepy')p={height:-.024+.0013*Math.sin(t*1.2),pitch:.025,headPitch:.21+.018*Math.sin(t*.75),headRoll:.045*Math.sin(t*.65),earPitch:-.11,earSpread:dog?.065:.16,tailPitch:dog?-.35:-.48,tailAmplitude:.008,tailFrequency:.9};
 if(id==='guarded')p={height:dog?-.003:-.023,forward:dog?.006:-.004,pitch:dog?-.025:.035,headPitch:dog?-.03:.04,headYaw:.035*Math.sin(t*.8),earPitch:dog?.04:-.28,earSpread:dog?-.18:.43,tailPitch:dog?.08:-.32,tailAmplitude:.012,tailFrequency:1.3};
 if(id==='gloomy')p={height:-.016,headPitch:.13,headYaw:.035*Math.sin(t*.5),headRoll:dog?.035:.025,earPitch:-.1,earSpread:dog?.085:.17,tailPitch:dog?-.33:-.38,tailAmplitude:.02,tailFrequency:1.0};
 return Object.fromEntries(Object.entries(base).map(([key,n])=>[key,n+((p[key]??n)-n)*intensity]));
}
