import * as T from 'three';

// Procedural finishes share the model's material; no external texture downloads.
export function furnitureFinish(root){
 const replaced=new Set();
 for(const g of root.children){if(!g.userData.furnitureId)continue;const {finish,primary}=g.userData;
  g.traverse(o=>{if(!o.isMesh||!finish||finish==='auto'||o.material.color.getHexString()!==primary?.slice(1))return;
   replaced.add(o.material);const m=o.material.clone();m.roughness=finish==='metal'?.32:finish==='plain'?.75:finish==='wood'?.82:.96;m.metalness=finish==='metal'?.7:0;
   if(finish==='wood'||finish==='fabric'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,64,64);
    ctx.strokeStyle=finish==='wood'?'#d1c4b6':'#d5d5d5';ctx.lineWidth=1;
    for(let i=0;i<64;i+=finish==='wood'?8:4){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+(finish==='wood'?Math.sin(i)*3:0),64);ctx.stroke();if(finish==='fabric'){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(64,i);ctx.stroke();}}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(3,3);m.map=texture;
   }
   o.material=m;
  });
 }
 const retained=new Set();root.traverse(o=>{if(o.isMesh)retained.add(o.material);});for(const m of replaced)if(!retained.has(m))m.dispose();
}
