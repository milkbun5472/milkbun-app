import * as T from 'three';

// The map owns the location; scenery and the shared arrival use that same track.
export function makeTownStation(scene,station){
 const root=new T.Group();root.name='绒绒小镇车站';scene.add(root);
 const mat=color=>new T.MeshStandardMaterial({color,roughness:.85});
 const cream=mat('#efe1c8'),wood=mat('#b49478'),sage=mat('#98ad9d'),rose=mat('#cfaaa2'),iron=mat('#706c65');
 const box=(w,h,d,x,y,z,m)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const z=station.target.z;
 box(5,.08,z-27,0,.015,(z+27)/2,cream);
 box(16,.12,4.8,0,0,z,cream);box(16,.05,.22,0,.085,z+2.1,rose);
 for(const p of station.track.points.slice(1)){
  const i=station.track.points.indexOf(p),a=station.track.points[i-1],len=Math.hypot(p.x-a.x,p.z-a.z),yaw=Math.atan2(-(p.z-a.z),p.x-a.x);
  for(const off of[-.7,.7]){const rail=box(len,.09,.08,(a.x+p.x)/2,.16,(a.z+p.z)/2+off,iron);rail.rotation.y=yaw;}
  for(let x=a.x;x<p.x;x+=.8)box(.18,.09,2,x,.09,p.z,wood);
 }
 for(const x of[-6.2,-2.6])box(.16,2.5,.16,x,1.3,z-1.8,sage);
 box(4.4,.18,2.8,-4.4,2.62,z-1.3,sage);box(4.4,.12,.22,-4.4,2.53,z+.08,rose);
 box(2.4,.14,.7,-4.4,.57,36,wood);box(2.4,.55,.12,-4.4,.94,35.7,wood);
 for(const x of[-5.2,-3.6])box(.12,.5,.6,x,.26,36,sage);
 box(.14,2.6,.14,3.8,1.3,36.7,wood);box(2.7,.75,.13,3.8,2.2,36.7,sage);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#98ad9d';ctx.fillRect(0,0,512,160);ctx.fillStyle='#fff5e4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='46px sans-serif';ctx.fillText('绒绒小镇',256,60);ctx.font='24px sans-serif';ctx.fillText('微光庭院 · 远行列车',256,120);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const sign=new T.Mesh(new T.PlaneGeometry(2.65,.74),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));sign.position.set(3.8,2.2,36.78);root.add(sign);
 return {root};
}
