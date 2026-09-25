const label=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim().slice(0,100):fallback;
export function restorePuzzleMemory(raw){
 if(!raw||raw.version!==1||![12,24,48,80].includes(raw.count))return null;
 const count=raw.count,you=Math.max(0,Math.min(count,Math.floor(Number(raw.you)||0))),companion=Math.max(0,Math.min(count-you,Math.floor(Number(raw.companion)||0)));
 return{version:1,count,you,companion,companionName:label(raw.companionName,'同行者'),photographer:label(raw.photographer,'未记录'),lastBy:['you','companion'].includes(raw.lastBy)?raw.lastBy:null,day:Number.isFinite(raw.day)?Math.max(1,Math.floor(raw.day)):null};
}
export function makePuzzleMemory(p,photo,companion,day){
 if(!p?.completed)return null;
 return restorePuzzleMemory({version:1,count:p.count,you:p.pieces.filter(q=>q.locked&&q.by==='you').length,companion:p.pieces.filter(q=>q.locked&&q.by==='companion').length,companionName:companion?.name,photographer:photo?.photographer?.role==='companion'?(photo.photographer.name||'同行者'):photo?'你':'未记录',lastBy:p.lastPlacement?.by||null,day});
}
export function puzzleMemoryLines(raw){
 const m=restorePuzzleMemory(raw);if(!m)return [];
 const unknown=m.count-m.you-m.companion;
 return['拍摄：'+m.photographer,'拼图：你 '+m.you+' 片 · '+m.companionName+' '+m.companion+' 片'+(unknown?' · 未记录 '+unknown+' 片':''),'最后一片：'+(m.lastBy==='you'?'你':m.lastBy==='companion'?m.companionName:'旧进度未记录'),...(m.day?['装框：旅途第 '+m.day+' 天']:[])];
}
