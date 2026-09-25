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

// 相框背面（她 2026-09-25：「拼完拼图可以选择我和角色各留一句话在背面。在庭院展示也可以点开背面看到日期和写过的话」）。
// 日期是真的年月日（at），旅途第几天（day）是列车里的；两句话都可以不写。
const note=v=>typeof v==='string'&&v.trim()?v.trim().slice(0,200):'';
export function restoreBack(raw){
 if(!raw||typeof raw!=='object')return null;
 const at=Number.isFinite(raw.at)&&raw.at>0?Math.floor(raw.at):null,day=Number.isFinite(raw.day)&&raw.day>=1?Math.floor(raw.day):null;
 const out={at,day,you:note(raw.you),companion:note(raw.companion),companionName:label(raw.companionName,'同行者')};
 return out.at||out.day||out.you||out.companion?out:null;
}
export function backOf(item){return restoreBack({at:item?.at,day:item?.day,...(item?.back||{})});}
export function backDate(at){if(!at)return '';const d=new Date(at);return d.getFullYear()+' 年 '+(d.getMonth()+1)+' 月 '+d.getDate()+' 日';}
