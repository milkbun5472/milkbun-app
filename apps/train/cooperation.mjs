import {target,nextCompanionMove,isEdgePiece} from './puzzle.mjs?v=fg-2b49f37eb5c58f48';
export const HANDOFF={x:100,y:1225,w:800,h:90};
export function inHandoff(x,y){return x>=HANDOFF.x&&x<=HANDOFF.x+HANDOFF.w&&y>=HANDOFF.y&&y<=HANDOFF.y+HANDOFF.h;}
export function pendingPiece(p){const a=p?.cooperation?.pending;return a&&['solve','fetch','help','ready'].includes(a.kind)&&p.pieces[a.id]&&!p.pieces[a.id].locked?a:null;}
export function cooperate(p,kind,id){
 if(p.mode!=='together'||p.completed||!['solve','fetch'].includes(kind)||!p.pieces[id]||p.pieces[id].locked||pendingPiece(p))return false;
 p.cooperation={...p.cooperation,pending:{kind,id},last:{kind:kind==='solve'?'递给同行者':'请同行者找一片',piece:id+1}};return true;
}
export const DIVISIONS=[{id:'free',label:'自由配合'},{id:'you-edge',label:'你拼边框 · TA 拼中间'},{id:'you-center',label:'你拼中间 · TA 拼边框'}];
export function divisionOf(p){return DIVISIONS.find(d=>d.id===p.cooperation?.division)||DIVISIONS[0];}
export function setDivision(p,id){if(!DIVISIONS.some(d=>d.id===id)||p.mode!=='together')return false;p.cooperation={...p.cooperation,division:id,retry:null,retryGiven:false};return true;}
export function assignedPieces(p,who){const division=divisionOf(p).id;return p.pieces.filter(q=>!q.locked&&(division==='free'||isEdgePiece(p,q.id)===(who==='you'?division==='you-edge':division==='you-center'))).map(q=>q.id);}
export function fetchPiece(p,skill,random=Math.random){return nextCompanionMove(p,skill,random,assignedPieces(p,'you'));}
export function cooperationMove(p,skill,random=Math.random){
 const pending=pendingPiece(p);
 if(p.mode==='together'&&pending){
  if(pending.kind==='ready')return null;
  const t=target(p,pending.id),q=p.pieces[pending.id];
  if(['fetch','help'].includes(pending.kind))return{id:q.id,x:500-t.w/2,y:HANDOFF.y+(HANDOFF.h-t.h)/2,duration:1.2+(1-skill)*2,wait:1,delivery:true};
  return nextCompanionMove(p,skill,random,[q.id]);
 }
 if(p.mode==='together'){
  if(p.pieces.filter(q=>!q.locked).length<=1)return null;
  const ids=assignedPieces(p,'companion'),retry=p.cooperation?.retry;
  return nextCompanionMove(p,skill,random,Number.isInteger(retry)&&(ids.includes(retry)||p.cooperation?.retryGiven)?[retry]:ids);
 }
 return nextCompanionMove(p,skill,random);
}
export function finishCooperation(p,id,delivery,matched,who){
 const pending=pendingPiece(p)||p.cooperation?.pending,c=p.cooperation||{},failures={...c.failures};
 if(delivery){
  if(!pending||pending.id!==id)return;
  const help=pending.kind==='help';delete failures[id];p.cooperation={...c,failures,retry:null,retryGiven:false,pending:{kind:'ready',id,reason:help?'help':'fetch',announced:false},last:{kind:help?'同行者试了两次未拼上，递回求助':'同行者递回碎片',piece:id+1}};return;
 }
 if(who==='companion'&&!matched&&p.mode==='together')failures[id]=(failures[id]||0)+1;else delete failures[id];
 const last=pending?.id===id?{kind:who==='you'?'你接过碎片落手':'同行者尝试你递来的碎片',piece:id+1,matched}:c.last;
 p.cooperation={...c,failures,last,pending:pending?.id===id?null:c.pending,retry:who==='companion'&&!matched?id:c.retry===id?null:c.retry,retryGiven:who==='companion'&&!matched?(pending?.kind==='solve'||c.retry===id&&!!c.retryGiven):c.retry===id?false:!!c.retryGiven};
 if(p.mode==='together'&&who==='companion'&&!matched&&failures[id]>=2&&!pendingPiece(p))p.cooperation={...p.cooperation,pending:{kind:'help',id},retry:null,last:{kind:'同行者两次未拼上，准备递回求助',piece:id+1}};
}
export function claimHelpAnnouncement(p,now,lastTalk){const pending=pendingPiece(p);if(p.mode!=='together'||pending?.kind!=='ready'||pending.reason!=='help'||pending.announced||now-lastTalk<45000)return false;pending.announced=true;return true;}
export function cooperationContext(p){
 const pending=pendingPiece(p),you=p.pieces.filter(q=>q.locked&&q.by==='you').length,companion=p.pieces.filter(q=>q.locked&&q.by==='companion').length;
 return{you,companion,division:divisionOf(p).label,companionRemaining:assignedPieces(p,'companion').length,pending:pending?{piece:pending.id+1,action:pending.kind==='ready'&&pending.reason==='help'?'同行者没拼上，已递到手边请你帮忙':{solve:'等同行者试拼',fetch:'等同行者递来',help:'同行者没拼上，正在递回求助',ready:'已递到手边，等你接过'}[pending.kind]}:null,last:p.cooperation?.last||null,lastPieceForYou:p.mode==='together'&&!pending&&p.pieces.filter(q=>!q.locked).length===1};
}
