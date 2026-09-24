// One window texture, independently scrolling cached art layers. No external assets.
import * as T from 'three';
import {createDestinations,destinationState} from './destinations.mjs?v=fg-7542b1b1703af212';
import {journeyAt,visibleJourney,nextJourneyDistance,drawJourney,drawBridge,drawTunnel} from './journey.mjs?v=fg-7542b1b1703af212';
import {ROUTES,SEASONS,WEATHERS} from './environment.mjs?v=fg-7542b1b1703af212';
export {ROUTES,SEASONS,WEATHERS};
const TAU=Math.PI*2,mod=(a,b)=>((a%b)+b)%b,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const stops=[
 [0,['#15243e','#54647c','#56617b','#354d62','#293e4b','#1c3038','#202f38']],
 [5,['#666f94','#e6bba7','#8b91a2','#728792','#647f7a','#43645d','#667666']],
 [7,['#9cc8d6','#f2e6c9','#a3b4bd','#7c9c9d','#6e9280','#426d5a','#9aa574']],
 [12,['#80b8d1','#e5eddb','#9bacb6','#719791','#74966a','#355f4d','#b2b377']],
 [17,['#8fa9c3','#f5d1a4','#a8a7b2','#8c9999','#8b9c79','#4b7060','#baa36c']],
 [19,['#635d8a','#efae8d','#9c8f9d','#797d91','#697f78','#405d59','#9a805e']],
 [21,['#263953','#788998','#657388','#485e72','#3c545e','#263f44','#39494b']],
 [24,['#15243e','#54647c','#56617b','#354d62','#293e4b','#1c3038','#202f38']],
];
function rgb(hex){return hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));}
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const css=a=>`rgb(${a.join(',')})`;
const tint=(a,b,t)=>css(mix(rgb(a),rgb(b),t));
function palette(hour,weather,season){
 const h=mod(hour,24);let i=0;while(stops[i+1][0]<h)i++;
 const f=(h-stops[i][0])/(stops[i+1][0]-stops[i][0]);
 const overcast={clear:0,cloudy:.36,rain:.53,snow:.36,fog:.58}[weather];
 const daylight=clamp(Math.sin((h-6)/12*Math.PI),0,1);
 const greySky=mix([35,47,63],[112,131,148],daylight),greyHorizon=mix([63,75,87],[164,174,174],daylight);
 const result=stops[i][1].map((c,j)=>mix(mix(rgb(c),rgb(stops[i+1][1][j]),f),j===0?greySky:greyHorizon,overcast));
 const foliage={spring:['#9cae77','#668a5a','#b2bd80'],summer:['#658d5c','#315f49','#9ca469'],autumn:['#c19a59','#926044','#c3a06b'],winter:['#9eaeb1','#566f70','#c1cbd0']}[season];
 for(let j=4;j<7;j++)result[j]=mix(result[j],rgb(foliage[j-4]).map(v=>Math.round(v*(.30+.70*daylight))),.72);
 return result;
}
function rng(seed){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function path(ctx,points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
function hillY(x,base,amp,phase){return base+Math.sin(x*TAU+phase)*amp+Math.sin(x*TAU*3+phase*.7)*amp*.28+Math.sin(x*TAU*7+phase)*amp*.07;}
function hill(c,base,amp,phase,color){c.beginPath();c.moveTo(0,600);for(let x=0;x<=1600;x+=4)c.lineTo(x,hillY(x/1600,base,amp,phase));c.lineTo(1600,600);c.closePath();c.fillStyle=color;c.fill();}
function pine(c,x,y,h,color,snow,wrapped=false){
 if(!wrapped){if(x<h*.4)pine(c,x+1600,y,h,color,snow,true);if(x>1600-h*.4)pine(c,x-1600,y,h,color,snow,true);}
 c.fillStyle=color;c.fillRect(x-h*.027,y-h*.23,h*.054,h*.24);
 for(let j=0;j<4;j++){
  const yy=y-h+j*h*.19,w=h*(.13+j*.044);
  path(c,[[x,yy],[x-w,yy+h*.38],[x+w,yy+h*.38]],color);
  if(snow)path(c,[[x,yy],[x-w*.72,yy+h*.28],[x-w*.1,yy+h*.235],[x+w*.26,yy+h*.27],[x+w*.64,yy+h*.28]],snow);
 }
 // A subtle lighter face gives painted volume without new geometry.
 c.globalAlpha=.13;path(c,[[x,y-h],[x+h*.26,y-h*.07],[x,y-h*.15]],'#f7edcc');c.globalAlpha=1;
}
function broadTree(c,x,y,h,color,light,season='summer',wrapped=false){
 if(!wrapped){if(x<h*.6)broadTree(c,x+1600,y,h,color,light,season,true);if(x>1600-h*.6)broadTree(c,x-1600,y,h,color,light,season,true);}
 c.fillStyle=color;c.fillRect(x-3,y-h*.38,6,h*.39);
 if(season==='winter'){c.strokeStyle=color;c.lineWidth=3;for(const side of [-1,1])for(let j=0;j<3;j++){c.beginPath();c.moveTo(x,y-h*.16);c.lineTo(x+side*h*(.13+j*.06),y-h*(.44+j*.13));c.lineTo(x+side*h*(.12+j*.09),y-h*(.59+j*.13));c.stroke();}c.strokeStyle=light;c.lineWidth=2;c.beginPath();c.moveTo(x-1,y-h*.08);c.lineTo(x-1,y-h*.73);c.stroke();return;}
 ellipse(c,x,y-h*.54,h*.28,h*.29,color);ellipse(c,x-h*.17,y-h*.48,h*.22,h*.20,color);ellipse(c,x+h*.20,y-h*.44,h*.20,h*.22,color);ellipse(c,x-h*.035,y-h*.67,h*.20,h*.20,light);
 if(season==='spring'){for(let j=0;j<13;j++){const a=j*2.4,r=h*.21*Math.sqrt(j/13);ellipse(c,x+Math.cos(a)*r,y-h*.59+Math.sin(a)*r,3.8,2.7,light);}}
}
function house(c,x,y,w,body,roof,night,snowColor){
 c.fillStyle=body;c.fillRect(x-w/2,y-w*.52,w,w*.52);
 path(c,[[x-w*.61,y-w*.50],[x,y-w*.95],[x+w*.61,y-w*.50]],roof);
 if(snowColor){c.strokeStyle=snowColor;c.lineWidth=3;c.beginPath();c.moveTo(x-w*.61,y-w*.50);c.lineTo(x,y-w*.95);c.lineTo(x+w*.61,y-w*.50);c.stroke();}
 c.fillStyle=roof;c.fillRect(x+w*.27,y-w*.96,w*.10,w*.35);
 for(const dx of [-.25,.20]){c.fillStyle=night?'#f6cd83':'#526c72';c.fillRect(x+dx*w-w*.07,y-w*.36,w*.14,w*.18);}
 c.fillStyle=roof;c.fillRect(x-w*.045,y-w*.18,w*.12,w*.18);
}
export function createWindowScenery(scene,{mobile=innerWidth<650,reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
 const W=mobile?960:1440,H=W/2;
 const output=canvas(W,H),ctx=output.getContext('2d',{alpha:true});
 const texture=new T.CanvasTexture(output);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,side:T.FrontSide,toneMapped:false,depthWrite:false});
 const mesh=new T.Mesh(new T.PlaneGeometry(2.69,1.37),material);mesh.name='LayeredWindowLandscape';mesh.position.set(1.19,1.65,-1.58);mesh.renderOrder=1;scene.add(mesh);
 const state={route:'forest',season:'spring',weather:'clear',hour:9,speed:1,playing:!reducedMotion,autoTime:false,distance:0,weatherTime:0};
 const destinations=createDestinations();
 const speeds=[7,24,68,170,390];
 const layers=speeds.map((speed,i)=>({speed,canvas:canvas(1600,600),name:['远山','山谷','中景','林岸','近景'][i]}));
 const incoming=speeds.map(speed=>({speed,canvas:canvas(1600,600)}));
 let incomingKey='';
 let cacheKey='',frames=0,disposed=false,lastPalette;
 const random=rng(617);const particles=Array.from({length:100},()=>({x:random(),y:random(),size:.5+random(),phase:random()*TAU}));
 const stars=Array.from({length:60},()=>({x:random(),y:random()*.48,r:.45+random()}));
 function rebuild(p, targetLayers=layers){
  const snow=state.season==='winter'||state.weather==='snow',night=state.hour<6||state.hour>19.5;
  const colors=p.map(css),daylight=clamp(Math.sin((state.hour-6)/12*Math.PI),0,1);
  const snowColor=css(mix(p[1],[237,243,239].map(v=>Math.round(v*(.38+.62*daylight))),.72));
  const blossom=css(mix(p[1],[236,180,178].map(v=>Math.round(v*(.40+.60*daylight))),.75));
  for(let index=0;index<targetLayers.length;index++){
   const c=targetLayers[index].canvas.getContext('2d');c.clearRect(0,0,1600,600);const rnd=rng(108+index*91);
   if(index===0){
    hill(c,302,67,.4,colors[2]);
    // Pale rock faces follow each major crest, softened into the distant ridge.
    c.globalAlpha=.25;
    for(let x=80;x<1600;x+=340){const yy=hillY(x/1600,302,67,.4);path(c,[[x,yy],[x+100,yy+108],[x+25,yy+85],[x-56,yy+66]],snow?snowColor:colors[1]);}c.globalAlpha=1;
   }else if(index===1){
    hill(c,state.route==='coast'?382:357,state.route==='coast'?26:42,2.3,colors[3]);
    if(state.route==='coast'){
     // A small distant island and warm lighthouse pass on the horizon.
     const x=820,y=hillY(x/1600,382,26,2.3);c.fillStyle=night?'#bbc4c6':'#eee5cc';path(c,[[x-12,y],[x-8,y-78],[x+8,y-78],[x+13,y]],c.fillStyle);
     c.fillStyle=colors[5];c.fillRect(x-12,y-84,24,11);path(c,[[x-15,y-84],[x,y-97],[x+15,y-84]],colors[5]);c.fillStyle=night?'#ffe6a4':'#dbc08e';c.fillRect(x-7,y-82,14,6);
    }
   }else if(index===2){
    if(state.route==='coast'){
     const g=c.createLinearGradient(0,365,0,600);g.addColorStop(0,css(mix(p[3],[100,158,170],.35)));g.addColorStop(1,css(mix(p[5],[57,110,123],.30)));c.fillStyle=g;c.fillRect(0,374,1600,226);
     c.strokeStyle=css(mix(p[1],[219,235,220],.3));c.lineWidth=1.5;c.globalAlpha=.28;
     for(let i=0;i<90;i++){const x=rnd()*1600,y=385+rnd()*210;c.beginPath();c.moveTo(x,y);c.lineTo(x+15+rnd()*52,y);c.stroke();}c.globalAlpha=1;
    }else{
     hill(c,434,26,1.8,snow?snowColor:colors[4]);
     if(state.route==='country'){
      for(let i=0;i<5;i++){const x=100+i*300,y=hillY(x/1600,434,26,1.8);house(c,x,y,34+rnd()*20,css(mix(p[1],[205,193,156],.4)),colors[5],night,snow?snowColor:null);}
      c.strokeStyle=css(mix(p[4],p[1],.32));c.lineWidth=7;
      for(let i=0;i<9;i++){c.beginPath();c.moveTo(i*210,490);c.bezierCurveTo(i*210+60,530,i*210+100,560,i*210+180,600);c.stroke();}
     }else{
      for(let i=0;i<43;i++){const x=i*1600/43,y=hillY(x/1600,434,26,1.8)+8;pine(c,x,y,22+rnd()*32,colors[3],snow?snowColor:null);}
     }
    }
   }else if(index===3){
    hill(c,state.route==='coast'?563:524,19,.2,snow?snowColor:colors[6]);
    if(state.route==='forest')for(let i=0;i<21;i++){const x=i*1600/21,y=hillY(x/1600,524,19,.2)+12;const h=75+rnd()*94;if(i%3===1)broadTree(c,x,y,h,colors[5],snow?snowColor:state.season==='spring'?blossom:colors[4],state.season);else pine(c,x,y,h,colors[5],snow?snowColor:null);}
    if(state.route==='country')for(let i=0;i<8;i++){const x=i*200,y=hillY(x/1600,524,19,.2)+10;broadTree(c,x,y,55+rnd()*60,colors[5],snow?snowColor:state.season==='spring'?blossom:colors[4],state.season);}
    if(state.route==='coast'){
     for(let i=0;i<14;i++){const x=i*123,y=hillY(x/1600,563,19,.2);ellipse(c,x,y+6,14+rnd()*18,6+rnd()*9,colors[5]);}
    }
   }else{
    hill(c,595,8,1,snow?snowColor:colors[5]);
    c.strokeStyle=snow?snowColor:colors[5];c.lineWidth=2;
    for(let i=0;i<180;i++){const x=rnd()*1600,y=583+rnd()*20,h=8+rnd()*19;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2,y-h*.7,x+5,y-h);c.stroke();}
    if(!snow){
     for(let i=0;i<90;i++){const x=rnd()*1600,y=578+rnd()*22;if(state.season==='spring')ellipse(c,x,y,3.2,2.3,i%3?blossom:colors[1]);else if(state.season==='autumn'){c.save();c.translate(x,y);c.rotate(rnd()*3);ellipse(c,0,0,4,1.6,colors[4]);c.restore();}else{c.strokeStyle=colors[6];c.beginPath();c.moveTo(x,y);c.lineTo(x,y-11);c.stroke();}}
    }
    // Sparse trackside fence moves faster than the wooded middle distance.
    for(let x=70;x<1600;x+=200)for(const xx of [x,x-1600]){c.fillStyle=colors[5];c.fillRect(xx,555,4,45);c.fillRect(xx,568,142,3);c.fillRect(xx,587,142,3);}
   }
  }
 }
 function drawClouds(p){
  const dense=state.weather!=='clear';ctx.fillStyle=css(mix(p[1],[240,238,221],dense?.2:.55));ctx.globalAlpha=dense?.42:.54;
  for(let i=0;i<(dense?10:5);i++){
   const x=mod(i*351-state.weatherTime*2.5,1800)-100,y=68+(i%3)*34;
   ctx.beginPath();for(let k=0;k<4;k++){const xx=x+k*37,yy=y-Math.sin(k)*15;ctx.moveTo(xx+45,yy);ctx.ellipse(xx,yy,45,14+(k%2)*9,0,0,TAU);}ctx.fill();
  }ctx.globalAlpha=1;
 }
 function drawWeather(p){
  if(['fog','rain','snow','cloudy'].includes(state.weather)){
   const opacity={fog:.40,rain:.12,snow:.16,cloudy:.08}[state.weather];const g=ctx.createLinearGradient(0,160,0,600);g.addColorStop(0,'rgba(205,218,218,0)');g.addColorStop(.58,`rgba(205,218,218,${opacity})`);g.addColorStop(1,'rgba(205,218,218,0)');ctx.fillStyle=g;ctx.fillRect(0,0,1600,600);
   if(state.weather==='fog')for(let i=0;i<3;i++){const x=mod(i*650-state.weatherTime*8,2300)-350;const mist=ctx.createRadialGradient(x,355+i*34,5,x,355+i*34,380);mist.addColorStop(0,'rgba(225,231,219,.13)');mist.addColorStop(1,'rgba(225,231,219,0)');ctx.fillStyle=mist;ctx.fillRect(0,220,1600,380);}
  }
  if(state.weather==='rain'){
   ctx.lineWidth=1.1;ctx.strokeStyle='rgba(220,235,237,.48)';ctx.beginPath();
   for(const p of particles){const x=mod(p.x*1700-state.weatherTime*180,1700)-50,y=mod(p.y*680+state.weatherTime*510*p.size,680)-40;ctx.moveTo(x,y);ctx.lineTo(x-11*p.size,y+33*p.size);}ctx.stroke();
   // Slower translucent droplets cling to the pane while rain passes outside.
   for(const p of particles.slice(0,22)){const x=p.x*1600,y=mod(p.y*660+state.weatherTime*(8+p.size*6),660)-30;ctx.strokeStyle='rgba(223,241,241,.50)';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(x,y,2.2*p.size,5*p.size,0,0,TAU);ctx.stroke();ctx.strokeStyle='rgba(219,235,238,.11)';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+1,y-33*p.size);ctx.stroke();}
  }
  if(state.weather==='snow')for(const p of particles){const x=mod(p.x*1700-state.weatherTime*28+Math.sin(state.weatherTime+p.phase)*16,1700)-50,y=mod(p.y*660+state.weatherTime*35*p.size,660)-30;ellipse(ctx,x,y,2*p.size,2*p.size,'rgba(247,250,248,.85)');}
 }
 function draw(){
  if(disposed)return;
  const p=palette(state.hour,state.weather,state.season);lastPalette=p;
  const key=`${state.route}/${state.season}/${state.weather}/${Math.round(state.hour*10)}`;
  if(key!==cacheKey){rebuild(p);cacheKey=key;}
  ctx.clearRect(0,0,W,H);ctx.save();ctx.scale(W/1600,H/600);
  ctx.beginPath();ctx.roundRect(0,0,1600,600,40);ctx.clip();
  const sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,css(p[0]));sky.addColorStop(.60,css(p[1]));sky.addColorStop(1,css(p[1]));ctx.fillStyle=sky;ctx.fillRect(0,0,1600,600);
  const h=state.hour,night=h<5.5||h>20,starAlpha=night?Math.min(1,h>20?(h-20)/2:(5.5-h)/2):0;
  if(state.weather==='clear'){
   ctx.globalAlpha=starAlpha;for(const s of stars)ellipse(ctx,s.x*1600,s.y*600,s.r,s.r,'#f8efd0');ctx.globalAlpha=1;
   if(h>=5.5&&h<=19.5){const t=(h-5.5)/14,x=160+t*1250,y=290-Math.sin(t*Math.PI)*205;const g=ctx.createRadialGradient(x,y,12,x,y,95);g.addColorStop(0,'rgba(255,229,169,.65)');g.addColorStop(1,'rgba(255,229,169,0)');ctx.fillStyle=g;ctx.fillRect(x-100,y-100,200,200);ellipse(ctx,x,y,32,24,'#fff0bd');}
   else{ellipse(ctx,1180,97,29,22,'#e8e5cf');ellipse(ctx,1192,91,25,19,css(p[0]));}
  }
  drawClouds(p);
  const blend=clamp(state.routeBlend||0,0,1), nextRoute=state.nextRoute;
  if(blend&&ROUTES[nextRoute]){const k=nextRoute+'/'+key;if(incomingKey!==k){const route=state.route;state.route=nextRoute;rebuild(p,incoming);state.route=route;incomingKey=k;}}
  const journey=visibleJourney(state),destination=destinationState(state.route,journey);
  layers.forEach((layer,i)=>{
   const x=-mod(state.distance*layer.speed,1600);ctx.save();
   ctx.globalAlpha=(1-destination.reveal)*(i===3?1-journey.clearing:1);
   const t=clamp((blend-i*.12)/(.52),0,1),a=t*t*(3-2*t);
   ctx.globalAlpha*=1-a;ctx.drawImage(layer.canvas,x,0);ctx.drawImage(layer.canvas,x+1600,0);
   if(a){ctx.globalAlpha=a;ctx.drawImage(incoming[i].canvas,x,0);ctx.drawImage(incoming[i].canvas,x+1600,0);}ctx.restore();
   if(i===2&&!destination.id&&state.route!=='coast'&&['bridge','lake','harbor'].includes(journey.id)){
    ctx.save();ctx.globalAlpha=journey.clearing;const water=ctx.createLinearGradient(0,454,0,600);water.addColorStop(0,css(mix(p[3],[101,155,162],.4)));water.addColorStop(1,css(mix(p[5],[61,115,125],.5)));ctx.fillStyle=water;ctx.fillRect(0,454,1600,146);
    ctx.strokeStyle=css(p[1]);ctx.globalAlpha=journey.clearing*.35;ctx.lineWidth=2;
    for(let j=0;j<38;j++){const wx=mod(j*163-state.distance*85,1700)-60,wy=464+(j%7)*18;ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(wx+27+(j%3)*17,wy);ctx.stroke();}ctx.restore();
   }
   if(i===3&&!destination.id)drawJourney(ctx,journey,{colors:p.map(css),night:state.hour<6||state.hour>19.5,snow:state.season==='winter'||state.weather==='snow',season:state.season,motion:state.weatherTime,route:state.route},{path,ellipse,house});
  });
  destinations.draw(ctx,journey,{route:state.route,season:state.season,weather:state.weather,hour:state.hour,snow:state.season==='winter'||state.weather==='snow',motion:state.weatherTime,colors:p});
  // Trackside poles give a strong near-field cue while the far ridges remain slow.
  ctx.save();ctx.globalAlpha=1-destination.reveal;
  const poleX=mod(2300-state.distance*430,2300)-120;ctx.strokeStyle=css(p[5]);ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(poleX,600);ctx.lineTo(poleX,94);ctx.moveTo(poleX-37,126);ctx.lineTo(poleX+37,126);ctx.stroke();
  ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(poleX-2300,118);ctx.quadraticCurveTo(poleX-1150,207,poleX,118);ctx.quadraticCurveTo(poleX+1150,207,poleX+2300,118);ctx.stroke();
  ctx.restore();
  if(['clear','cloudy'].includes(state.weather)&&!journey.tunnel){ctx.strokeStyle=css(p[5]);ctx.lineWidth=2;for(let i=0;i<6;i++){const bx=mod(1950-state.weatherTime*95+i*28,2200)-150,by=146+Math.sin(i*.8)*18;ctx.beginPath();ctx.moveTo(bx-7,by+Math.sin(state.weatherTime*5+i)*4);ctx.lineTo(bx,by);ctx.lineTo(bx+7,by+Math.sin(state.weatherTime*5+i)*4);ctx.stroke();}}
  drawBridge(ctx,journey,p.map(css),state.distance);
  drawWeather(p);
  if(['spring','autumn'].includes(state.season)&&['clear','cloudy'].includes(state.weather)){
   const color=state.season==='spring'?css(mix(p[1],[224,167,177],.45)):css(mix(p[4],[175,110,54],.4));
   for(const particle of particles.slice(0,14)){const x=mod(particle.x*1800-state.weatherTime*37,1800)-100,y=mod(particle.y*740+state.weatherTime*17,740)-100;ctx.save();ctx.translate(x+Math.sin(state.weatherTime+particle.phase)*12,y);ctx.rotate(state.weatherTime*.6+particle.phase);ellipse(ctx,0,0,4*particle.size,1.7*particle.size,color);ctx.restore();}
  }
  drawTunnel(ctx,journey,state.distance);
  // Faint interior reflection: a restrained glass highlight, not a white veil.
  const sheen=ctx.createLinearGradient(0,0,1600,600);sheen.addColorStop(0,'rgba(255,245,218,.045)');sheen.addColorStop(.45,'rgba(255,245,218,0)');sheen.addColorStop(1,'rgba(255,245,218,.025)');ctx.fillStyle=sheen;ctx.fillRect(0,0,1600,600);
  ctx.restore();texture.needsUpdate=true;frames++;
 }
 function set(patch){
  if(patch.route!==undefined&&!ROUTES[patch.route])throw Error('未知线路');
  if(patch.season!==undefined&&!SEASONS[patch.season])throw Error('未知季节');
  if(patch.weather!==undefined&&!WEATHERS[patch.weather])throw Error('未知天气');
  const next={...state,...patch};for(const key of ['hour','speed'])if(!Number.isFinite(next[key]))throw Error('非法数值');
  if(Number.isFinite(patch.distance)&&patch.distance>=0)state.distance=patch.distance;state.eventDistance=Number.isFinite(next.eventDistance)?next.eventDistance:undefined;state.nextRoute=ROUTES[next.nextRoute]?next.nextRoute:null;state.routeBlend=clamp(Number(next.routeBlend)||0,0,1);state.route=next.route;state.season=next.season;state.weather=next.weather;state.hour=mod(next.hour,24);state.speed=clamp(next.speed,0,2);state.playing=Boolean(next.playing);state.autoTime=Boolean(next.autoTime);draw();
 }
 function step(dt){if(disposed||!state.playing)return false;dt=clamp(dt,0,.1);state.distance=mod(state.distance+dt*state.speed*destinationState(state.route,journeyAt(state.route,state.eventDistance??state.distance)).speedFactor,160000);state.weatherTime=mod(state.weatherTime+dt,100000);if(state.autoTime)state.hour=mod(state.hour+dt*.10,24);draw();return true;}
 function lighting(){const h=state.hour;const daylight=clamp(Math.sin((h-6)/12*Math.PI),0,1)*(1-journeyAt(state.route,state.eventDistance??state.distance).tunnel*.95),overcast=state.weather==='clear'?1:.65;return {daylight,ambient:.65+daylight*1.95*overcast,sun:.2+daylight*3.2*overcast,lamps:clamp((.35-daylight)/.35,0,1)*6,color:css(lastPalette?.[1]||[240,230,210])};}
 draw();
 return {mesh,texture,canvas:output,state,set,step,lighting,get journey(){return journeyAt(state.route,state.eventDistance??state.distance);},get destination(){return destinationState(state.route,state.routeBlend>0?{id:'open',progress:0}:journeyAt(state.route,state.eventDistance??state.distance));},get effectiveSpeed(){return state.speed*destinationState(state.route,journeyAt(state.route,state.eventDistance??state.distance)).speedFactor;},nextStop(){state.distance=nextJourneyDistance(state.route,state.distance);draw();},seekJourney(distance){if(!Number.isFinite(distance)||distance<0)throw Error('非法旅程位置');state.distance=mod(distance,160000);draw();},get frames(){return frames;},get layers(){return layers.map(l=>({name:l.name,speed:l.speed,offset:mod(state.distance*l.speed,1600)}));},dispose(){destinations.dispose();disposed=true;scene.remove(mesh);mesh.geometry.dispose();material.dispose();texture.dispose();[...layers,...incoming].forEach(l=>{l.canvas.width=1;l.canvas.height=1;});output.width=1;output.height=1;}};
}
