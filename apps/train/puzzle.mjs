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
 q.x=ok?t.x:Math.max(-20,Math.min(980,x));q.y=ok?t.y:Math.max(0,Math.min(1280,y));q.locked=ok;q.by=ok?by:null;p.moves++;p.completed=p.pieces.every(x=>x.locked);return ok;
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
export function nextCompanionMove(p,skill,random=Math.random){const free=p.pieces.filter(x=>!x.locked);if(!free.length)return null;const edges=free.filter(q=>{const l=LEVELS.find(x=>x.count===p.count),c=q.id%l.cols,r=Math.floor(q.id/l.cols);return c===0||r===0||c===l.cols-1||r===l.rows-1;});const candidates=skill>.55&&edges.length?edges:free,q=candidates[Math.floor(random()*candidates.length)],t=target(p,q.id),correct=random()<.55+skill*.43;
 return{id:q.id,x:correct?t.x:t.x+t.w*(random()<.5?1:-1),y:t.y,duration:1.2+(1-skill)*2,wait:1+(1-skill)*3,correct};}
