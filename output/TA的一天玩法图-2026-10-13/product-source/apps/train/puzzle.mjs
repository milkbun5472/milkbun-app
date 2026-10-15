export const LEVELS=[{count:12,cols:4,rows:3},{count:24,cols:6,rows:4},{count:48,cols:8,rows:6},{count:80,cols:10,rows:8}];
export const BOARD={x:100,y:65,w:800,h:533.333};
export function randomSeed(){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];}
export function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function skillOf(id){let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);return .25+(h>>>0)/4294967295*.65;}
export function createPuzzle(photoId,count,seed=randomSeed()){
 const level=LEVELS.find(x=>x.count===Number(count));if(!level)throw Error('请选择拼图片数');const r=rng(seed),order=Array.from({length:count},(_,i)=>i);
 for(let i=count-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return {version:1,photoId,seed,count,mode:'self',moves:0,completed:false,pieces:Array.from({length:count},(_,id)=>{const slot=order[id];return{id,x:110+(slot%level.cols)*780/level.cols+(r()-.5)*12,y:700+Math.floor(slot/level.cols)*520/level.rows+(r()-.5)*12,locked:false,by:null};})};
}
export function validPuzzle(p){const l=LEVELS.find(x=>x.count===p?.count);return !!(l&&p.version===1&&Number.isFinite(p.seed)&&Array.isArray(p.pieces)&&p.pieces.length===p.count&&p.pieces.every((q,i)=>q.id===i&&Number.isFinite(q.x)&&Number.isFinite(q.y)));}
export function target(p,id){const l=LEVELS.find(x=>x.count===p.count);return{x:BOARD.x+(id%l.cols)*BOARD.w/l.cols,y:BOARD.y+Math.floor(id/l.cols)*BOARD.h/l.rows,w:BOARD.w/l.cols,h:BOARD.h/l.rows};}
export function drop(p,id,x,y,by='you'){
 const q=p.pieces[id];if(!q||q.locked)return false;const t=target(p,id),ok=Math.hypot(x-t.x,y-t.y)<Math.min(t.w,t.h)*.32;
 q.x=ok?t.x:Math.max(-20,Math.min(980,x));q.y=ok?t.y:Math.max(0,Math.min(1280,y));q.locked=ok;q.by=ok?by:null;p.moves++;p.completed=p.pieces.every(x=>x.locked);if(ok)p.lastPlacement={by,piece:id+1};return ok;
}
// Each interior seam is generated once. Its neighbouring piece uses the exact reversed curve.
export function outlines(p){const l=LEVELS.find(x=>x.count===p.count),r=rng(p.seed),edges=new Map();const w=BOARD.w/l.cols,h=BOARD.h/l.rows;
 function seam(key,x,y,dx,dy,flat){if(edges.has(key))return edges.get(key);const len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,center=.42+r()*.16,width=.13+r()*.06,depth=(r()<.5?-1:1)*Math.min(w,h)*(.17+r()*.07);
 const pt=(t,n=0)=>[x+dx*t+nx*n,y+dy*t+ny*n];const seg=[];const line=t=>seg.push({end:pt(t)});const cubic=(a,b,c)=>seg.push({c1:a,c2:b,end:c});
 if(flat)line(1);else{line(center-width);cubic(pt(center-width*.35),pt(center-width*.8,depth),pt(center,depth));cubic(pt(center+width*.8,depth),pt(center+width*.35),pt(center+width));line(1);}
 const out={start:[x,y],seg};edges.set(key,out);return out;}
 const fmt=pt=>pt.map(n=>Math.round(n*1000)/1000).join(' ');
 function append(e,reverse){let prev=e.start;const all=e.seg.map(s=>{const out={...s,start:prev};prev=s.end;return out;});return (reverse?all.reverse():all).map(s=>s.c1?'C '+fmt(reverse?s.c2:s.c1)+' '+fmt(reverse?s.c1:s.c2)+' '+fmt(reverse?s.start:s.end):'L '+fmt(reverse?s.start:s.end)).join(' ');}
 return p.pieces.map(q=>{const col=q.id%l.cols,row=Math.floor(q.id/l.cols),t=target(p,q.id),x=t.x,y=t.y;
 const top=seam('h'+row+':'+col,x,y,w,0,row===0),right=seam('v'+row+':'+(col+1),x+w,y,0,h,col===l.cols-1),bottom=seam('h'+(row+1)+':'+col,x,y+h,w,0,row===l.rows-1),left=seam('v'+row+':'+col,x,y,0,h,col===0);
 return 'M '+fmt([x,y])+' '+append(top,false)+' '+append(right,false)+' '+append(bottom,true)+' '+append(left,true)+' Z';});
}
export function isEdgePiece(p,id){const l=LEVELS.find(x=>x.count===p.count),c=id%l.cols,r=Math.floor(id/l.cols);return c===0||r===0||c===l.cols-1||r===l.rows-1;}
// 同行者怎么拼（她 2026-09-26：「不能所有人都那么快会拼好，也要会犯错或者乱翻乱摆」）。
// skill 0~1：越低越常拼错、越慢、越爱发呆；错法有三种——
//   near 放偏一格（差一点）；wrong 放到了别的片的位置上；wander 随手往桌上一丢（乱摆）。
// 错放的片不会锁住，之后 TA 还会再拿起来重试，看起来就是「试了几次才对」。
export const SKILL_LEVELS=[{id:'auto',label:'随角色'},{id:'novice',label:'新手',skill:.1},{id:'casual',label:'普通',skill:.4},{id:'skilled',label:'熟练',skill:.7},{id:'expert',label:'高手',skill:.95}];
export function levelSkill(level,id){const l=SKILL_LEVELS.find(x=>x.id===level);return l&&l.skill!=null?l.skill:skillOf(id);}
// 同一档水平里每个人也不一样（她 2026-09-26）：按同行者 id 定一副固定的「拼图脾气」——
//   pace 手快手慢；dreamy 爱不爱发呆；edge 爱不爱先拼边框；mess 错的时候偏爱哪种错（近/错位/乱丢）；jitter 水平上下浮一点。
function hashOf(id,salt){let h=2166136261;for(const c of salt+':'+String(id))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;}
export function styleOf(id){return{pace:.75+hashOf(id,'pace')*.6,dreamy:.5+hashOf(id,'dreamy')*1.3,edge:hashOf(id,'edge'),mess:hashOf(id,'mess'),jitter:(hashOf(id,'jitter')-.5)*.16};}
const PLAIN={pace:1,dreamy:1,edge:.5,mess:.5,jitter:0};
export function nextCompanionMove(p,skill,random=Math.random,ids=null,style=PLAIN){style=style||PLAIN;skill=Math.max(.02,Math.min(.99,skill+style.jitter));const free=p.pieces.filter(x=>!x.locked&&(!ids||ids.includes(x.id)));if(!free.length)return null;const edges=free.filter(q=>isEdgePiece(p,q.id));
 // 会先拼边框的只有熟手；新手东拿一片西拿一片
 const candidates=skill+(style.edge-.5)*.5>.55&&edges.length?edges:free,q=candidates[Math.floor(random()*candidates.length)],t=target(p,q.id),correct=random()<.35+skill*.62;
 const duration=(1.1+(1-skill)*2.4)*style.pace,hesitate=random()<(1-skill)*.35*style.dreamy?2+random()*4:0,wait=(.8+(1-skill)*3.2)*style.pace+hesitate;
 if(correct)return{id:q.id,x:t.x,y:t.y,duration,wait,correct:true,kind:'place'};
 const f=random(),lock=Math.min(t.w,t.h)*.32;let x,y,kind;
 if(f<(.1+(1-skill)*.35)*(.4+style.mess*1.2)){kind='wander';x=BOARD.x+random()*(BOARD.w-t.w);y=BOARD.y+random()*(BOARD.h-t.h);}
 else if(f<(.3+(1-skill)*.35)*(.7+(1-style.mess)*.6)&&p.pieces.length>1){kind='wrong';const others=p.pieces.filter(o=>o.id!==q.id),o=others[Math.floor(random()*others.length)],ot=target(p,o.id);x=ot.x;y=ot.y;}
 else{kind='near';x=t.x+t.w*(random()<.5?1:-1);y=t.y;}
 if(Math.hypot(x-t.x,y-t.y)<lock)x=t.x+t.w*(t.x+t.w*1.5<BOARD.x+BOARD.w?1:-1);   // 乱丢也别刚好丢对
 return{id:q.id,x,y,duration,wait,correct:false,kind};}
