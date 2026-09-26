// 列车进站（她 2026-09-25：「到了要上车的时候做一个列车到来然后上车的动画」）。
// 沿车站那条铁轨（MAPS.garden.station.track.points）从林子深处开进来，停稳、开门，
// 再交给游戏把两个人送上去。只是一段画面，不碰存档。
import * as T from 'three';
const lerp=(a,b,t)=>a+(b-a)*t,ease=t=>1-Math.pow(1-t,3);
function makeCar(front){
 const g=new T.Group(),green=new T.MeshStandardMaterial({color:'#3f5f4c',roughness:.7}),wood=new T.MeshStandardMaterial({color:'#8a6442',roughness:.8}),roof=new T.MeshStandardMaterial({color:'#2f3a33',roughness:.6}),glass=new T.MeshStandardMaterial({color:'#f5e2b0',emissive:'#f1cf86',emissiveIntensity:.55,roughness:.4}),dark=new T.MeshStandardMaterial({color:'#262a27',roughness:.8});
 const add=(geo,m,x,y,z)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
 add(new T.BoxGeometry(4.6,1.5,1.9),green,0,1.15,0);add(new T.BoxGeometry(4.7,.18,2.05),roof,0,1.99,0);add(new T.BoxGeometry(4.6,.14,1.95),wood,0,.45,0);
 for(let i=0;i<4;i++)for(const s of [-1,1])add(new T.BoxGeometry(.62,.46,.02),glass,-1.55+i*1.03,1.3,s*.96);
 for(const x of [-1.6,1.6])for(const s of [-1,1]){const w=add(new T.CylinderGeometry(.3,.3,.14,14),dark,x,.32,s*.82);w.rotation.x=Math.PI/2;}
 const door=add(new T.BoxGeometry(.7,1.25,.03),wood,.05,1.02,-.97);door.name='door';
 if(front){const nose=add(new T.CylinderGeometry(.9,.9,.7,18,1,false,0,Math.PI),green,2.45,1.15,0);nose.rotation.z=Math.PI/2;nose.rotation.y=Math.PI/2;add(new T.SphereGeometry(.14,10,8),glass,2.82,1.35,0);add(new T.CylinderGeometry(.16,.2,.5,10),dark,1.8,2.3,0);}
 return g;}
export function makeArrivingTrain(scene,station){
 const pts=station.track.points,root=new T.Group();root.visible=false;scene.add(root);
 const cars=[makeCar(true),makeCar(false)];for(const c of cars)root.add(c);
 // 轨道是一串折线：按弧长取点，车头朝前进方向（-x→+x 的反向开进来）
 const seg=[];let total=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);seg.push(d);total+=d;}
 // 轨道两头往外顺着延长，车从画面外开进来，不在轨道端头凭空冒出
 const at=s=>{if(s<0||s>total){const e=s<0?at(0):at(total),o=s<0?at(Math.min(1,total)):at(Math.max(0,total-1)),dx=e.x-o.x,dz=e.z-o.z,l=Math.hypot(dx,dz)||1,k=s<0?-s:s-total;return {x:e.x+dx/l*k,z:e.z+dz/l*k,yaw:e.yaw};}let i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++;}const a=pts[i],b=pts[i+1]||a,t=seg[i]?s/seg[i]:0;return {x:lerp(a.x,b.x,t),z:lerp(a.z,b.z,t),yaw:Math.atan2(-(b.z-a.z),b.x-a.x)};};
 const stopAt=(()=>{let best=0,bd=1e9,acc=0;for(let i=0;i<pts.length;i++){if(i)acc+=seg[i-1];const d=Math.abs(pts[i].x-(station.target?.x||0));if(d<bd){bd=d;best=acc;}}return best;})();
 let job=null;
 function place(head){cars.forEach((c,i)=>{const p=at(head-i*4.9);c.position.set(p.x,.12,p.z);c.rotation.y=p.yaw;});}
 return {
  play(){return new Promise(done=>{root.visible=true;job={t:0,done};place(stopAt-40);});},
  update(dt){if(!job)return;job.t+=dt;const k=Math.min(1,job.t/4.2);place(lerp(stopAt-40,stopAt+2.4,ease(k)));
   // 停稳后门往里一推，稍候就交出去
   const door=cars[1].getObjectByName('door');if(door)door.position.z=-.97+(k>=1?Math.min(.25,(job.t-4.2)*.6):0);
   if(job.t>5.2){const d=job.done;job=null;d();}},
  hide(){root.visible=false;job=null;},
  inspect(){return {visible:root.visible,playing:!!job,x:cars[0].position.x,z:cars[0].position.z};}};
}
