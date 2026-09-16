import * as T from 'three';
// Shared continuous scenery for every clearing. Decorative outskirts are not walkable land.
export function makeSurroundings(){
 const root=new T.Group();root.name='Continuous landscape';
 let seed=47;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#829564';ctx.fillRect(0,0,128,128);
 for(let i=0;i<700;i++){ctx.fillStyle=rnd()>.5?'#c5cf9620':'#435b4520';ctx.beginPath();ctx.ellipse(rnd()*128,rnd()*128,2+rnd()*9,1+rnd()*4,rnd()*6,0,Math.PI*2);ctx.fill();}
 const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(20,20);tex.colorSpace=T.SRGBColorSpace;
 const ground=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({map:tex,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=.08;ground.receiveShadow=true;root.add(ground);
 // Instanced trees keep distant scenery to three draw calls, outside all interaction bounds.
 const bark=new T.MeshStandardMaterial({color:'#746449',roughness:1}),leaves=new T.MeshStandardMaterial({color:'#728766',roughness:1});
 const count=100,trunks=new T.InstancedMesh(new T.CylinderGeometry(.14,.21,1,7),bark,count),crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),leaves,count*2),dummy=new T.Object3D();
 for(let i=0;i<count;i++){const angle=i*2.39996,r=8+rnd()*21,h=2.1+rnd()*2.4;let x=Math.cos(angle)*r,z=Math.sin(angle)*r;if(x*.53+z*.85>3){x=-x;z=-z;}dummy.position.set(x,h/2,z);dummy.scale.set(1,h,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<2;j++){dummy.position.set(x+(j? .22:-.22),h+j*.45,z);dummy.scale.set(1.0+j*.12,1.15,1.0);dummy.rotation.y=i;dummy.updateMatrix();crowns.setMatrixAt(i*2+j,dummy.matrix);}}
 trunks.receiveShadow=crowns.receiveShadow=true;root.add(trunks,crowns);let last='';
 return {root,update(map,tint,config={}){const key=map+tint;if(last===key)return;last=key;ground.visible=config.ground!=='asset';const scale=Math.max(1,(config.radius||5.12)/5.12);trunks.scale.set(scale,1,scale);crowns.scale.set(scale,1,scale);ground.material.color.set(map==='forest'?'#c8d6bd':'#ffffff').lerp(new T.Color(tint),.12);leaves.color.set(map==='forest'?'#627e66':'#728766').lerp(new T.Color(tint),.18);}};
}
