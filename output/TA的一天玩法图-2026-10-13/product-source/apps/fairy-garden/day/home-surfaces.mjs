import * as T from 'three';

// Procedural patterns cover the actual wall polygons, including the window hole.
// White paper under the pattern lets every finish retain its own custom colour.
export function homeSurface(mesh,pattern,axis){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=pattern==='herringbone'?192:256;const c=canvas.getContext('2d');
 c.fillStyle='#ffffff';c.fillRect(0,0,256,256);c.strokeStyle='#6e625250';c.lineWidth=1.5;
 const line=(x,y,u,v)=>{c.beginPath();c.moveTo(x,y);c.lineTo(u,v);c.stroke();};
 if(pattern==='wood'||pattern==='panel'){
  for(let x=0;x<256;x+=51.2){line(x,0,x,256);if(pattern==='wood'){line(x,((x/51.2)%2)*128,x+51.2,((x/51.2)%2)*128);c.strokeStyle='#6e625215';for(let j=1;j<5;j++)line(x+j*9,0,x+j*9+3,256);c.strokeStyle='#6e625250';}}
 }else if(pattern==='stripe'){c.fillStyle='#8b807322';for(let x=0;x<256;x+=32)c.fillRect(x,0,7,256);
 }else if(pattern==='dots'){c.fillStyle='#8e9a7d66';for(let y=32;y<256;y+=64)for(let x=32;x<256;x+=64){c.beginPath();c.arc(x+(y%128?0:22),y,5,0,Math.PI*2);c.fill();}
 }else if(pattern==='botanical'){
  c.strokeStyle='#73876677';for(const x of [58,186]){c.beginPath();c.moveTo(x,256);c.bezierCurveTo(x+24,166,x-26,84,x,0);c.stroke();for(let i=0;i<6;i++){const y=22+i*40,side=i%2?1:-1;c.fillStyle=i%2?'#9baa8060':'#677d6660';c.beginPath();c.ellipse(x+side*13,y,18,7,side*.55,0,Math.PI*2);c.fill();}}
 }else if(pattern==='tile'||pattern==='wainscot'){
  const step=pattern==='tile'?128:64;for(let n=0;n<=256;n+=step){line(n,0,n,256);line(0,n,256,n);}if(pattern==='wainscot'){c.strokeStyle='#ffffff88';for(let x=0;x<256;x+=64)for(let y=0;y<256;y+=64)c.strokeRect(x+8,y+8,48,48);}
 }else if(pattern==='checker'){c.fillStyle='#707b6966';for(let x=0;x<256;x+=64)for(let y=0;y<256;y+=64)if((x+y)%128===0)c.fillRect(x,y,64,64);
 }else if(pattern==='herringbone'){
  c.translate(128,96);c.rotate(Math.PI/4);const unit=64/Math.sqrt(2);for(let row=-7;row<8;row++)for(let col=-7;col<8;col++){const x=(3*row-col)*unit,y=(3*row+col)*unit;c.fillStyle=(row+col)%2?'#a17d4c19':'#5e45221c';c.fillRect(x,y,3*unit,unit);c.strokeRect(x,y,3*unit,unit);c.fillStyle=(row+col)%2?'#5e45221c':'#a17d4c19';c.fillRect(x+3*unit,y,unit,3*unit);c.strokeRect(x+3*unit,y,unit,3*unit);}
 }else if(pattern==='terrazzo'||pattern==='stone'){
  if(pattern==='stone'){c.strokeStyle='#86867825';for(let n=0;n<=256;n+=128){line(n,0,n,256);line(0,n,256,n);}}
  for(let i=0;i<(pattern==='stone'?90:46);i++){const x=(i*79+17)%256,y=(i*137+43)%256,r=pattern==='stone'?1.2:3+i%4;c.fillStyle=['#92755a50','#61756a60','#bec7b570','#766c6555'][i%4];c.beginPath();c.moveTo(x-r,y);c.lineTo(x+2,y-r);c.lineTo(x+r,y+2);c.lineTo(x,y+r);c.closePath();c.fill();}
 }
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1/2.4,pattern==='herringbone'?1/1.8:1/2.4);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const position=mesh.geometry.getAttribute('position'),uv=new Float32Array(position.count*2);
 for(let i=0;i<position.count;i++){uv[i*2]=axis==='left'?position.getZ(i):position.getX(i);uv[i*2+1]=axis==='floor'?position.getZ(i):position.getY(i);}
 mesh.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.material=mesh.material.clone();mesh.material.map=texture;
 return mesh;
}
