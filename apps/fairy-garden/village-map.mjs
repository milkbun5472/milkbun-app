import {MAPS} from './world.mjs?v=fg-dd95be8bdcad1237';
// 村子平面图（她 2026-09-18：「地图这里略丑，做好看一点，也可以放大缩小」）。
// ⚠️画的全是 rules 里本来就有的几何：湖岸、溪、屋子的脚印、摊子、栈桥、树、小路、铁轨——
//   一个坐标都不另抄（施工规则/one-public-mechanism.md）。codex 挪一间屋，图跟着走。
// ⚠️这儿只画地；标哪几处、雾天藏哪几处、两个人在哪儿，仍在 game.mjs 的 openMap 里。
const S=6,PAD=2.5;
const n1=v=>Number(v).toFixed(1);
export function planBounds(){
 const g=MAPS.garden,xs=[],zs=[];
 for(const r of g.walkRegions||[]){if(r.polygon)for(const p of r.polygon){xs.push(p.x);zs.push(p.z);}else{xs.push(r.x-r.r,r.x+r.r);zs.push(r.z-r.r,r.z+r.r);}}
 const minX=Math.min(...xs)-PAD,maxX=Math.max(...xs)+PAD,minZ=Math.min(...zs)-PAD,maxZ=Math.max(...zs)+PAD;
 return {minX,minZ,maxX,maxZ,scale:S,w:(maxX-minX)*S,h:(maxZ-minZ)*S};
}
export const planAt=(box,p)=>({x:((p.x-box.minX)*box.scale).toFixed(1),y:((p.z-box.minZ)*box.scale).toFixed(1)});
const poly=(box,pts)=>pts.map(p=>{const q=planAt(box,p);return q.x+','+q.y;}).join(' ');
const rect=(box,r,cls,extra='')=>{const q=planAt(box,{x:r.x-r.w/2,z:r.z-r.d/2});return '<rect class="'+cls+'" x="'+q.x+'" y="'+q.y+'" width="'+n1(r.w*S)+'" height="'+n1(r.d*S)+'" rx="'+n1(Math.min(r.w,r.d)*S*.18)+'"'+extra+'/>';};
const circ=(box,c,r,cls)=>{const q=planAt(box,c);return '<circle class="'+cls+'" cx="'+q.x+'" cy="'+q.y+'" r="'+n1(r*S)+'"/>';};
// 地、水、路、木头、屋子、树：一层一层往上叠
export function villagePlan(){
 const g=MAPS.garden,box=planBounds(),out=[];
 out.push('<rect class="paper" x="0" y="0" width="'+n1(box.w)+'" height="'+n1(box.h)+'"/>');
 for(const r of g.walkRegions||[])out.push(r.polygon?'<polygon class="land" points="'+poly(box,r.polygon)+'"/>':circ(box,r,r.r,'land'));
 // 北边那片林子和铁轨那头稍暗一点：那是林地，不是草坪
 const north=(g.walkRegions||[]).find(r=>r.polygon&&r.polygon[0].z<-20);if(north)out.push('<polygon class="woods" points="'+poly(box,north.polygon)+'"/>');
 // 小路：去旧塔的林道、去车站的那条、去水磨坊的那条
 const path=(pts,cls='path')=>pts&&pts.length>1?out.push('<polyline class="'+cls+'" points="'+poly(box,pts)+'"/>'):null;
 path(g.oldTower?.trail);path(g.station?.approach);path(g.watermill?.approach);
 // 水：月湖、湖心小岛、溪、水磨坊那段溪
 if(g.lake?.shore)out.push('<polygon class="water" points="'+poly(box,g.lake.shore)+'"/>');
 if(g.lake?.island){const q=planAt(box,g.lake.island);out.push('<ellipse class="land island" cx="'+q.x+'" cy="'+q.y+'" rx="'+n1(g.lake.island.rx*S)+'" ry="'+n1(g.lake.island.rz*S)+'"/>');}
 const creekW=n1((g.lake?.creekWidth||1.2)*S);
 if(g.lake?.creek)out.push('<polyline class="creek" style="stroke-width:'+creekW+'" points="'+poly(box,g.lake.creek)+'"/>');
 if(g.watermill?.creek)out.push('<polyline class="creek" style="stroke-width:'+creekW+'" points="'+poly(box,g.watermill.creek)+'"/>');
 // 铁轨
 if(g.station?.track?.points)out.push('<polyline class="rail" points="'+poly(box,g.station.track.points)+'"/>');
 // 木头和石板：栈桥、溪上小桥、芦苇桥、车站月台和雨棚
 if(g.lake?.deck)out.push(rect(box,g.lake.deck,'wood'));
 const bridge=(g.obstacles||[]).find(o=>o.polygon&&o.except&&Math.abs(o.except.x-18)<1);if(bridge)out.push(rect(box,bridge.except,'wood'));
 for(const st of g.lake?.reedBridge?.steps||[])out.push(rect(box,st,'wood'));if(g.lake?.reedBridge?.landing)out.push(rect(box,g.lake.reedBridge.landing,'wood'));
 if(g.station?.platform)out.push(rect(box,g.station.platform,'stone'));if(g.station?.canopy)out.push(rect(box,g.station.canopy,'roof'));if(g.station?.booth)out.push(rect(box,g.station.booth,'house'));
 // 屋子：脚印来自 architecture（圆塔是圆的）、水磨坊、旧塔
 for(const b of Object.values(g.architecture||{}))for(const p of b.parts)out.push(p.r!=null?circ(box,p,p.r,'house'):rect(box,p,'house'));
 for(const p of g.watermill?.parts||[])out.push(rect(box,p,'house'));if(g.watermill?.wheel)out.push(circ(box,g.watermill.wheel,g.watermill.wheel.r,'wheel'));
 if(g.oldTower)out.push(circ(box,g.oldTower,g.oldTower.r,'tower'));
 if(g.oldTower?.fallenTree)out.push(rect(box,g.oldTower.fallenTree,'log'));
 // 摊子和花圃
 for(const st of g.market?.stalls||[])out.push(rect(box,st,'stall'));
 for(const f of g.flowerbeds||[])out.push(rect(box,f,'bed'));
 // 树：障碍物里那些圆（塔、圆书塔那种大的不是树）
 for(const o of g.obstacles||[])if(o.r!=null&&o.r<=.7&&!o.id)out.push(circ(box,o,Math.max(.45,o.r*1.6),'tree'));
 for(const t of g.lake?.trees||[])out.push(circ(box,t,Math.max(.45,t.r*1.6),'tree'));
 // 灯
 for(const l of [...(g.decor?.lamps||[]),g.pathLamp].filter(Boolean))out.push(circ(box,l,.28,'lamp'));
 return {box,at:p=>planAt(box,p),open:'<svg viewBox="0 0 '+n1(box.w)+' '+n1(box.h)+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="村子平面图">'+out.join(''),close:'</svg>'};
}
// 放大缩小、拖着看（手指捏、滚轮、三颗按钮都行）。⚠️点一处带路的那个 click 还挂在 game.mjs：
//   这儿只负责「刚才是不是在拖」——拖过就不算点。
export function installMapZoom(plan,view,buttons={}){
 const MIN=1,MAX=4;let scale=1,tx=0,ty=0,drag=false,pointers=new Map(),pinch=null,start=null;
 const apply=()=>{const w=plan.clientWidth,h=plan.clientHeight;tx=Math.min(0,Math.max(w-w*scale,tx));ty=Math.min(0,Math.max(h-h*scale,ty));view.style.transform='translate('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px) scale('+scale.toFixed(3)+')';if(buttons.reset)buttons.reset.textContent=Math.round(scale*100)+'%';};
 const zoomAt=(next,cx,cy)=>{const s=Math.max(MIN,Math.min(MAX,next));const k=s/scale;tx=cx-(cx-tx)*k;ty=cy-(cy-ty)*k;scale=s;apply();};
 const local=e=>{const r=plan.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 plan.addEventListener('pointerdown',e=>{if(e.target.closest('.map-zoom'))return;pointers.set(e.pointerId,local(e));plan.setPointerCapture(e.pointerId);if(pointers.size===1){drag=false;start={x:e.clientX,y:e.clientY,tx,ty};}else if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),scale};drag=true;}});
 plan.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,local(e));
  if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);zoomAt(pinch.scale*d/Math.max(1,pinch.d),(a.x+b.x)/2,(a.y+b.y)/2);return;}
  if(pointers.size===1&&start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(!drag&&Math.hypot(dx,dy)>8)drag=true;if(drag){tx=start.tx+dx;ty=start.ty+dy;apply();}}});
 // 抬手时没拖过＝点了一处：捕获着指针的是外框，click 会落不到那颗点上，所以这儿自己找、自己发 maptap
 const release=e=>{const tap=e.type==='pointerup'&&pointers.size===1&&!drag&&!!start;pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(!pointers.size)start=null;
  if(tap){const el=document.elementFromPoint(e.clientX,e.clientY),hit=el&&el.closest&&el.closest('.spot-hit');if(hit)plan.dispatchEvent(new CustomEvent('maptap',{detail:{hit}}));}};
 plan.addEventListener('pointerup',release);plan.addEventListener('pointercancel',release);plan.addEventListener('lostpointercapture',release);
 plan.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key))return;const hit=e.target.closest&&e.target.closest('.spot-hit');if(hit){e.preventDefault();plan.dispatchEvent(new CustomEvent('maptap',{detail:{hit}}));}});
 plan.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);zoomAt(scale*(e.deltaY<0?1.15:1/1.15),p.x,p.y);},{passive:false});
 const center=()=>({x:plan.clientWidth/2,y:plan.clientHeight/2});
 if(buttons.zoomIn)buttons.zoomIn.onclick=()=>{const c=center();zoomAt(scale*1.4,c.x,c.y);};
 if(buttons.zoomOut)buttons.zoomOut.onclick=()=>{const c=center();zoomAt(scale/1.4,c.x,c.y);};
 if(buttons.reset)buttons.reset.onclick=()=>{scale=1;tx=0;ty=0;apply();};
 return {reset(){scale=1;tx=0;ty=0;drag=false;apply();},wasDrag:()=>drag,get scale(){return scale;},
  // 开图时把她站的地方放到中间、放大一点：一眼看见自己在哪儿
  focus(px,py,s=2.2){scale=Math.max(MIN,Math.min(MAX,s));const w=plan.clientWidth,h=plan.clientHeight;tx=w/2-px*scale;ty=h/2-py*scale;apply();}};
}
