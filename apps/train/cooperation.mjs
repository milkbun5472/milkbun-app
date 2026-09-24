import {target,nextCompanionMove} from './puzzle.mjs?v=fg-7542b1b1703af212';
export const HANDOFF={x:100,y:1225,w:800,h:90};
export function inHandoff(x,y){return x>=HANDOFF.x&&x<=HANDOFF.x+HANDOFF.w&&y>=HANDOFF.y&&y<=HANDOFF.y+HANDOFF.h;}
export function pendingPiece(p){const a=p?.cooperation?.pending;return a&&['solve','fetch','ready'].includes(a.kind)&&p.pieces[a.id]&&!p.pieces[a.id].locked?a:null;}
export function cooperate(p,kind,id){
 if(p.mode!=='together'||p.completed||!['solve','fetch'].includes(kind)||!p.pieces[id]||p.pieces[id].locked||pendingPiece(p))return false;
 p.cooperation={...p.cooperation,pending:{kind,id},last:{kind:kind==='solve'?'递给同行者':'请同行者找一片',piece:id+1}};return true;
}
export function cooperationMove(p,skill,random=Math.random){
 const pending=pendingPiece(p);
 if(p.mode==='together'&&pending){
  if(pending.kind==='ready')return null;
  const t=target(p,pending.id),q=p.pieces[pending.id];
  if(pending.kind==='fetch')return{id:q.id,x:500-t.w/2,y:HANDOFF.y+(HANDOFF.h-t.h)/2,duration:1.2+(1-skill)*2,wait:1,delivery:true};
  // Keep the companion's own accuracy and timing, even for a handed-over piece.
  return nextCompanionMove({...p,pieces:p.pieces.map(x=>({...x,locked:x.id!==q.id}))},skill,random);
 }
 if(p.mode==='together'&&p.pieces.filter(q=>!q.locked).length<=1)return null;
 return nextCompanionMove(p,skill,random);
}
export function finishCooperation(p,id,delivery,matched,who){
 const pending=pendingPiece(p)||p.cooperation?.pending;if(!pending||pending.id!==id)return;
 const kind=delivery?'同行者递回碎片':who==='you'?'你接过碎片落手':'同行者尝试你递来的碎片';
 p.cooperation={pending:delivery?{kind:'ready',id}:null,last:{kind,piece:id+1,...(delivery?{}:{matched})}};
}
export function cooperationContext(p){
 const pending=pendingPiece(p),you=p.pieces.filter(q=>q.locked&&q.by==='you').length,companion=p.pieces.filter(q=>q.locked&&q.by==='companion').length;
 return{you,companion,pending:pending?{piece:pending.id+1,action:{solve:'等同行者试拼',fetch:'等同行者递来',ready:'已递到手边，等你接过'}[pending.kind]}:null,last:p.cooperation?.last||null,lastPieceForYou:p.mode==='together'&&!pending&&p.pieces.filter(q=>!q.locked).length===1};
}
