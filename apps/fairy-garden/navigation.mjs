// Map-sized cached grids and a binary heap keep routes practical as the village grows.
// ⚠️格子是【乐观】的：它按「湖结着冰、该开的都开了」算一次，全局只留这一份。
//   真正挡不挡路由每一步的 walkable / segmentClear 现算（它们拿得到存档）。
//   原来这儿是另一条路：结冰单独建一台寻路器、喂一个假存档 {day:43}——
//   那样每多一种会变的地形就多一台寻路器、多一整张格子，她的手机撑不住
//   （半径 55 的那张图一张就是二十万个点）。乐观格子只要一张。
export function createNavigator(maps,walkable,segmentClear,gridWalkable=walkable){
 const grids=new Map(),STEP=.24;
 const avoids=(p,avoid)=>avoid.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=o.r);
 function grid(map){if(grids.has(map))return grids.get(map);const m=maps[map],extent=m.walkRegions?m.walkRegions.flatMap(a=>a.polygon||[{x:a.x-a.r,z:a.z-a.r},{x:a.x+a.r,z:a.z+a.r}]):[{x:-m.radius,z:-m.radius},{x:m.radius,z:m.radius}];
  const minX=Math.floor(Math.min(...extent.map(p=>p.x))/STEP),maxX=Math.ceil(Math.max(...extent.map(p=>p.x))/STEP),minZ=Math.floor(Math.min(...extent.map(p=>p.z))/STEP),maxZ=Math.ceil(Math.max(...extent.map(p=>p.z))/STEP),rows=maxX-minX+1,N=maxZ-minZ+1;
  const points=Array.from({length:rows*N},(_,k)=>({x:(Math.floor(k/N)+minX)*STEP,z:(k%N+minZ)*STEP})),free=points.map(p=>gridWalkable(p.x,p.z,map));const g={N,rows,minX,minZ,points,free};grids.set(map,g);return g;}

 function nearest(p,map,g,avoid,s){const i=Math.round(p.x/STEP)-g.minX,j=Math.round(p.z/STEP)-g.minZ;for(let r=0;r<=5;r++){const candidates=[];for(let di=-r;di<=r;di++)for(let dj=-r;dj<=r;dj++){if(r&&Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const x=i+di,y=j+dj;if(x<0||y<0||x>=g.rows||y>=g.N)continue;const k=x*g.N+y,q=g.points[k];if(g.free[k]&&avoids(q,avoid))candidates.push(k);}candidates.sort((a,b)=>Math.hypot(p.x-g.points[a].x,p.z-g.points[a].z)-Math.hypot(p.x-g.points[b].x,p.z-g.points[b].z));for(const k of candidates)if(segmentClear(p,g.points[k],map,avoid,s))return k;}return null;}
 return function findPath(start,target,map='garden',avoid=[],s=null){
  if(!walkable(start.x,start.z,map,s)||!walkable(target.x,target.z,map,s)||!avoids(target,avoid))return null;
  if(segmentClear(start,target,map,avoid,s))return [{...target}];
  // Search from the destination when both directions have the same avoidance rules.
  // A small locked clearing then fails locally instead of scanning the entire village.
  const reverse=avoids(start,avoid),goal=reverse?start:target;
  const gridData=grid(map),{N,rows,points,free}=gridData,from=nearest(reverse?target:start,map,gridData,avoid,s),t=nearest(goal,map,gridData,avoid,s);if(from===null||t===null)return null;
  const heap=[],cost=new Map([[from,0]]),prev=new Map(),done=new Set();
  const push=(k,f)=>{let i=heap.length;heap.push({k,f});while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
  const pop=()=>{const out=heap[0],end=heap.pop();if(heap.length){heap[0]=end;let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[i].f<=heap[c].f)break;[heap[i],heap[c]]=[heap[c],heap[i]];i=c;}}return out.k;};push(from,0);
  while(heap.length){const k=pop();if(done.has(k))continue;if(k===t){const path=[{...points[k]}];let cur=k;while(cur!==from){cur=prev.get(cur);path.push({...points[cur]});}if(!reverse)path.reverse();path.push({...target});return path;}done.add(k);const i=Math.floor(k/N),j=k%N,p=points[k];
   for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=rows||nj>=N)continue;const nk=ni*N+nj,q=points[nk];if(done.has(nk)||!free[nk]||!segmentClear(p,q,map,avoid,s))continue;const next=cost.get(k)+Math.hypot(di,dj)*STEP;if(next>=(cost.get(nk)??Infinity))continue;cost.set(nk,next);prev.set(nk,k);push(nk,next+Math.hypot(q.x-goal.x,q.z-goal.z));}
  }return null;
 };
}
