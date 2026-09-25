export function restState(s){return{you:s.rest?.you===true,companion:s.rest?.companion===true};}
export function isResting(s){const r=restState(s);return r.you||r.companion;}
export function changeRest(s,who,lying,hasCompanion=true){
 if(!['you','companion','both'].includes(who))throw Error('找不到这位旅伴。');
 if(who==='companion'&&!hasCompanion)throw Error('这一档还没有同行者。');
 const rest=restState(s);for(const key of who==='both'?['you','companion']:[who])rest[key]=!!lying&&(key==='you'||hasCompanion);
 return{...s,rest};
}
export function restContext(s,hasCompanion=true){const r=restState(s);return{you:r.you?'在下铺躺着休息':'坐在桌边',companion:hasCompanion?(r.companion?'在上铺躺着休息':'坐在桌边'):null,clock:'休息时列车与时间照常前进'};}
