export function cropRect(width,height,zoom=1,pan={x:.5,y:.5}){const z=Math.max(1,Math.min(3,Number(zoom)||1)),w=Math.min(width,height*1.5)/z,h=w/1.5;return{x:(width-w)*Math.max(0,Math.min(1,pan.x)),y:(height-h)*Math.max(0,Math.min(1,pan.y)),w,h};}
export function albumRows(s){return [...(s?.artworks||[]).map(x=>({...x,kind:'puzzle'})),...(s?.photos||[]).map(x=>({...x,kind:'photo'}))];}
export function removeAlbumItem(s,id){if(s.puzzle?.photoId===id&&!s.puzzle.completed)throw Error('这张照片正在拼，完成或换一桌之后再删除。');return{...s,photos:(s.photos||[]).filter(x=>x.id!==id),artworks:(s.artworks||[]).filter(x=>x.id!==id),puzzle:s.puzzle?.photoId===id?null:s.puzzle};}
export function addArtwork(s,art){return (s.artworks||[]).some(x=>x.puzzleKey===art.puzzleKey)?s:{...s,artworks:[...(s.artworks||[]),art]};}
export function validImage(src){return typeof src==='string'&&src.length<3000000&&/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(src);}

export function photographerLabel(p){return p.photographer?.role==='companion'?(p.photographer.name||'同行者')+'拍的':'你拍的';}

export {promiseSummaries} from './photo-promise.mjs?v=fg-b828a8ebe37a7c5e';

// 背面那两句：只改这一张，其余字段原样。who 是 you / companion。
export function setBackNote(s,id,who,text,companionName){
 if(who!=='you'&&who!=='companion')throw Error('不知道是谁写的');
 const hit=x=>x.id===id,put=x=>({...x,back:{...(x.back||{}),[who]:String(text||'').trim().slice(0,200),...(companionName?{companionName:String(companionName).slice(0,100)}:{})}});
 if(![...(s.artworks||[]),...(s.photos||[])].some(hit))throw Error('相册里找不到这一张了');
 return {...s,artworks:(s.artworks||[]).map(x=>hit(x)?put(x):x),photos:(s.photos||[]).map(x=>hit(x)?put(x):x)};
}
