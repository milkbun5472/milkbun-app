// Two authored postcard compositions. Cached CPU layers feed the existing window texture.
const W=2200,H=600,TAU=Math.PI*2;
const clamp=(x)=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function destinationState(route,event){
 const id=route==='forest'&&event.id==='lake'?'lake':route==='coast'&&event.id==='village'?'town':null;
 const reveal=id?smooth(event.progress/.18)*smooth((1-event.progress)/.18):0;
 return {id,reveal,speedFactor:1-.64*reveal,label:id==='lake'?'山中湖泊':id==='town'?'海边小镇':''};
}
function canvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function polygon(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
function oval(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
function line(c,points,color,width=2){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function hash(n){const x=Math.sin(n*91.733)*43758.5453;return x-Math.floor(x);}
function rgba(rgb,a=1){return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;}
export function createDestinations(){
 const far=canvas(),shore=canvas();let cache='';
 function rebuild(id,env){
  const {season,hour,snow,colors}=env,night=hour<6||hour>19.5;
  const sun=Math.max(0,Math.sin((hour-6)/12*Math.PI));
  const paint=(rgb,amount=1)=>{const shade=.35+.65*sun;return rgba(rgb.map((v,i)=>Math.round(v*shade*amount+colors[1][i]*(1-amount)*.2)));};
  const ink=paint([63,80,78]),wood=paint([133,98,65]),stone=paint([183,180,154]),ivory=paint([238,222,183]),snowWhite=paint([232,240,237]);
  const leaves={spring:[134,164,102],summer:[74,121,78],autumn:[186,132,67],winter:[118,142,139]}[season];
  const leaf=paint(leaves),leafLight=paint(leaves.map(v=>Math.min(240,v+22))),pink=paint([237,169,175]);
  const f=far.getContext('2d'),s=shore.getContext('2d');f.clearRect(0,0,W,H);s.clearRect(0,0,W,H);
  function tree(c,x,y,r,bloom=false){
   const winter=season==='winter';line(c,[[x,y],[x-3,y-r*1.8]],wood,Math.max(2,r*.09));
   if(winter){for(let i=0;i<5;i++){const side=i%2?1:-1;line(c,[[x,y-r*.3],[x+side*r*.46,y-r*(.6+i*.2)],[x+side*r*.7,y-r*(.9+i*.2)]],ink,2);}}
   else{for(let i=0;i<7;i++){const a=i*2.4;oval(c,x+Math.cos(a)*r*.43,y-r*1.6+Math.sin(a)*r*.40,r*.62,r*.46,i%3?leaf:leafLight);}if(bloom&&season==='spring')for(let i=0;i<24;i++){const a=i*2.4,d=r*Math.sqrt(hash(i+x));oval(c,x+Math.cos(a)*d*.72,y-r*1.6+Math.sin(a)*d*.65,2.6,2,pink);}}
   if(snow)line(c,[[x-r*.5,y-r*1.5],[x-r*.1,y-r*1.75],[x+r*.45,y-r*1.6]],snowWhite,4);
  }
  function planter(c,x,y,w){c.fillStyle=wood;c.fillRect(x-w/2,y,w,8);for(let i=0;i<7;i++)oval(c,x-w*.4+i*w*.13,y-2,4,3,season==='spring'?pink:leaf);}
  function building(c,x,y,w,h,body,roof,details=true){
   // A front, shaded side, sloping roof and window recesses distinguish each facade.
   polygon(c,[[x+w/2,y],[x+w*.74,y-15],[x+w*.74,y-h-12],[x+w/2,y-h]],paint([151,145,121]));
   c.fillStyle=body;c.fillRect(x-w/2,y-h,w,h);
   polygon(c,[[x-w*.60,y-h+3],[x-w*.05,y-h-w*.35],[x+w*.60,y-h+3]],roof);
   polygon(c,[[x-w*.05,y-h-w*.35],[x+w*.20,y-h-w*.35-13],[x+w*.86,y-h-10],[x+w*.60,y-h+3]],paint([139,94,73]));
   if(snow)line(c,[[x-w*.60,y-h],[x-w*.05,y-h-w*.35],[x+w*.60,y-h]],snowWhite,5);
   for(let row=0;row<(h>80?2:1);row++)for(let col=0;col<2;col++){
    const xx=x-w*.30+col*w*.42,yy=y-h+18+row*31;
    c.fillStyle=ink;c.fillRect(xx-2,yy-2,w*.18+4,22);c.fillStyle=night?'#ebc481':paint([137,179,181]);c.fillRect(xx,yy,w*.18,18);
    line(c,[[xx+w*.09,yy],[xx+w*.09,yy+18]],ivory,1.3);line(c,[[xx,yy+9],[xx+w*.18,yy+9]],ivory,1.3);
    c.fillStyle=roof;c.fillRect(xx-6,yy,3,18);c.fillRect(xx+w*.18+3,yy,3,18);
    if(details&&row===0&&season!=='winter')planter(c,xx+w*.09,yy+22,w*.26);
   }
   c.fillStyle=ink;c.beginPath();c.roundRect(x-8,y-31,17,31,[8,8,0,0]);c.fill();
   c.fillStyle=roof;c.fillRect(x+w*.27,y-h-w*.22,7,22);
   if(details){line(c,[[x-w*.43,y-40],[x+w*.43,y-40]],wood,3);for(let i=0;i<6;i++)line(c,[[x-w*.43+i*w*.17,y-40],[x-w*.43+i*w*.17,y-32]],wood,1);}
  }
  function crate(c,x,y){c.fillStyle=wood;c.fillRect(x-14,y-16,28,16);line(c,[[x-14,y-9],[x+14,y-9]],ivory,1);for(let i=0;i<7;i++)oval(c,x-10+i*3.4,y-17-(i%2)*3,3,2.6,paint([209,127,60]));}
  function lantern(c,x,y){line(c,[[x,y+30],[x,y-6]],wood,3);c.fillStyle=ink;c.fillRect(x-6,y-10,12,17);c.fillStyle=night?'#f0c881':ivory;c.fillRect(x-3,y-7,6,11);}
  if(id==='lake'){
   // Far mountain silhouettes and snow caps frame a separate, reflective lake basin.
   polygon(f,[[-60,398],[160,260],[360,280],[620,111],[860,318],[1080,230],[1335,77],[1620,285],[1790,186],[2050,323],[2260,285],[2260,435],[-60,435]],paint([145,167,178]));
   polygon(f,[[382,294],[620,111],[860,318],[680,255],[601,174],[530,278]],paint([189,204,207]));
   polygon(f,[[1110,269],[1335,77],[1620,285],[1414,234],[1338,144],[1231,250]],paint([177,196,202]));
   polygon(f,[[563,157],[620,111],[694,181],[650,164],[619,139],[594,170]],snowWhite);
   polygon(f,[[1258,143],[1335,77],[1427,167],[1373,144],[1344,112],[1308,144]],snowWhite);
   polygon(f,[[-20,414],[170,347],[430,368],[687,318],[924,376],[1240,312],[1520,366],[1810,332],[2240,401],[2240,446],[-20,446]],paint([83,125,112]));
   // One irregular island bank ties the red cabin, garden and dock together.
   polygon(s,[[240,425],[420,383],[640,362],[845,372],[960,401],[1110,420],[1360,409],[1530,430],[1490,449],[1180,445],[820,445],[470,452]],snow?snowWhite:leaf);
   line(s,[[290,433],[465,413],[650,412],[862,425],[1050,432]],stone,9);
   for(let i=0;i<10;i++)oval(s,370+i*117,438+Math.sin(i)*7,18+(i%3)*6,6,stone);
   tree(s,512,402,57,true);tree(s,1030,420,40,true);tree(s,1330,423,47,true);
   building(s,767,420,150,104,paint([176,77,66]),paint([95,84,75]));
   // Timber side veranda, fence, steps and flower garden.
   s.fillStyle=wood;s.fillRect(841,389,95,8);s.fillRect(846,396,6,35);s.fillRect(923,396,6,35);
   line(s,[[844,373],[931,373]],wood,3);for(let i=0;i<7;i++)line(s,[[849+i*12,373],[849+i*12,389]],wood,2);
   for(let i=0;i<4;i++){s.fillStyle=stone;s.fillRect(740-i*3,422+i*5,62+i*6,4);}
   for(let i=0;i<12;i++){s.fillStyle=wood;s.fillRect(390+i*22,397,3,24);}line(s,[[390,405],[634,405]],wood,2);
   if(!snow)for(let i=0;i<52;i++)oval(s,422+hash(i)*225,419+hash(i+84)*20,2.2,1.8,season==='spring'?pink:i%2?ivory:paint([205,147,76]));
   // The dock is angled toward the viewer, not a detached horizontal bar.
   polygon(s,[[930,426],[979,426],[1083,491],[1006,491]],wood);
   for(let i=0;i<10;i++){const t=i/10;line(s,[[930+t*76,426+t*65],[979+t*104,426+t*65]],paint([193,157,109]),1.6);}
   for(const [x,y] of [[938,431],[987,431],[1007,491],[1084,491]]){line(s,[[x,y-15],[x,y+12]],wood,4);oval(s,x,y-15,4,2.3,ivory);}
   lantern(s,1090,456);
   if(season==='summer'){
    line(s,[[894,386],[894,340]],wood,3);polygon(s,[[851,348],[894,323],[936,348]],ivory);polygon(s,[[879,348],[894,323],[909,348]],paint([104,161,161]));
   }
   if(season==='autumn'){crate(s,872,424);crate(s,911,433);for(let i=0;i<18;i++)oval(s,430+hash(i)*600,433+hash(i+53)*6,3,1.2,paint([198,142,68]));}
   if(season==='winter'){
    // Rowboat rests upside down on the shore in winter.
    oval(s,1114,426,52,10,paint([138,97,63]));line(s,[[1068,425],[1160,425]],snowWhite,4);
   }
  }else{
   // Stepped headland, terraced retaining walls and a winding stairway.
   polygon(f,[[-30,438],[126,351],[388,325],[575,219],[775,236],[970,160],[1160,230],[1390,280],[1640,375],[1950,325],[2230,417],[2230,474],[-30,474]],paint([118,151,132]));
   for(let row=0;row<3;row++){
    const y=294+row*57;line(f,[[410-row*95,y+35],[730,y-15],[1085,y-28],[1390+row*58,y+28]],stone,13);
    for(let j=0;j<17;j++){const x=444-row*90+j*57;line(f,[[x,y+22],[x+9,y+30]],paint([145,151,130]),1);}
   }
   // Different height and facade colours provide readable puzzle regions.
   const bodies=[[221,159,130],[217,192,119],[136,172,163],[219,178,177],[156,180,199],[218,210,172]];
   for(let row=0;row<3;row++)for(let j=0;j<6;j++){
    const x=505+j*153+(row%2)*54-row*50,y=302+row*61-Math.sin(j*.66)*38,w=69+(j%3)*9,h=66+((j+row)%3)*17;
    building(s,x,y,w,h,paint(bodies[(j+row*2)%bodies.length]),paint([156+row*9,99+j*3,80]),row===2);
   }
   // Tall bell tower is a distinct silhouette above the clustered roofs.
   s.fillStyle=ivory;s.fillRect(1210,161,48,138);polygon(s,[[1200,163],[1234,109],[1268,163]],paint([109,124,113]));
   s.fillStyle=ink;s.beginPath();s.roundRect(1224,179,19,31,[9,9,0,0]);s.fill();oval(s,1234,239,11,8,paint([240,228,200]));line(s,[[1234,239],[1234,234]],ink,1.4);line(s,[[1234,239],[1240,241]],ink,1.4);
   for(let i=0;i<20;i++){const x=1460-i*14,y=278+i*7;s.fillStyle=ivory;s.fillRect(x,y,48,4);}
   // Curved quay holds bright market awnings, lamps, mooring rings and crates.
   polygon(s,[[267,437],[426,413],[687,436],[943,424],[1270,408],[1510,421],[1700,466],[1630,489],[1280,452],[956,466],[681,471],[418,454]],stone);
   line(s,[[286,443],[434,433],[685,456],[945,445],[1270,430],[1511,439],[1660,472]],ivory,4);
   for(let i=0;i<6;i++){const x=397+i*206,y=441+Math.sin(i)*14;lantern(s,x,y-14);if(i%2)crate(s,x+30,y+9);}
   if(season==='summer')for(let i=0;i<3;i++){const x=720+i*194,y=406;line(s,[[x,y],[x,y+27]],wood,3);polygon(s,[[x-49,y],[x,y-31],[x+49,y]],i%2?paint([103,151,167]):paint([201,126,101]));}
   if(season==='spring'){for(let i=0;i<9;i++){tree(s,333+i*162,428+Math.sin(i)*12,19,true);}}
   if(season==='autumn'){for(let i=0;i<6;i++)crate(s,540+i*174,452+Math.sin(i)*9);}
   if(season==='winter')line(s,[[286,436],[434,426],[685,449],[945,438],[1270,423],[1511,432],[1660,465]],snowWhite,5);
   // Clotheslines between foreground homes, without reusing the same window pattern.
   line(s,[[791,345],[954,360]],wood,1);for(let i=0;i<7;i++){s.fillStyle=paint(bodies[i%6]);s.fillRect(800+i*21,349+i*1.8,13,17);}
  }
 }
 function draw(c,event,env){
  const d=destinationState(env.route,event);if(!d.id)return;
  const key=[d.id,env.season,env.weather,Math.round(env.hour*10)].join('/');if(key!==cache){rebuild(d.id,env);cache=key;}
  const colors=env.colors.map(v=>rgba(v)),shift=(.5-event.progress)*460;
  c.save();c.globalAlpha=d.reveal;
  // Mountains move less than the shore, preserving parallax within the destination.
  c.drawImage(far,-300+shift*.25,0);
  const waterY=d.id==='lake'?435:444;
  const water=c.createLinearGradient(0,waterY,0,600);water.addColorStop(0,rgba(env.colors[3]));water.addColorStop(1,d.id==='lake'?rgba(env.colors[3].map((v,i)=>Math.round(v*.7+[19,54,63][i]))):rgba(env.colors[3].map((v,i)=>Math.round(v*.7+[23,58,76][i]))));
  c.fillStyle=water;c.fillRect(0,waterY,1600,600-waterY);
  // Reflections come from the actual same land/building layers, not an unrelated image.
  c.save();c.beginPath();c.rect(0,waterY,1600,600-waterY);c.clip();c.globalAlpha=d.reveal*.24;c.translate(-300+shift,waterY*1.48);c.scale(1,-.48);c.drawImage(shore,0,0);c.restore();
  c.save();c.globalAlpha=d.reveal*.10;c.translate(-300+shift*.25,waterY*1.32);c.scale(1,-.32);c.drawImage(far,0,0);c.restore();
  c.drawImage(shore,-300+shift,0);
  // Small asymmetric ripples break up the reflection and give puzzle edges.
  c.save();c.globalAlpha=d.reveal*.30;
  for(let i=0;i<42;i++){const x=((hash(i)*1730-env.motion*(3+i%3))%1730+1730)%1730-60,y=waterY+10+hash(i+82)*(570-waterY);line(c,[[x,y],[x+18+hash(i+17)*64,y]],colors[1],1.2);}
  c.restore();
  function boat(x,y,scale,color){
   c.save();c.translate(x,y+Math.sin(env.motion*.8)*1.4);c.scale(scale,scale);polygon(c,[[-48,0],[47,0],[27,15],[-27,15]],color);line(c,[[0,-65],[0,1]],colors[5],2);polygon(c,[[4,-61],[4,-4],[43,-4]],'#dfd9bb');polygon(c,[[-4,-48],[-33,-4],[-4,-4]],colors[4]);c.restore();
  }
  if(env.season!=='winter'){
   boat(1000+shift*1.45+Math.sin(env.motion*.07)*24,515,d.id==='lake'?.65:.9,env.season==='autumn'?'#a87e56':'#ab7363');
   if(d.id==='town'){boat(480+shift*1.6,536,.75,'#557e87');boat(1230+shift*1.2,505,.50,'#94775a');}
  }else if(d.id==='town'){
   // Winter boats are tied up at the quay rather than sailing through ice.
   for(let i=0;i<3;i++){const x=610+i*192+shift;oval(c,x,473+Math.sin(i)*13,30,7,colors[5]);line(c,[[x,473],[x-12,458]],colors[1],1);}
  }
  // Nearby banks, varied reeds and framing foliage create foreground silhouettes.
  const green=env.snow?rgba(env.colors[1]):colors[5];
  polygon(c,[[-20,587],[180,550],[370,581],[570,592],[1040,598],[1290,573],[1470,548],[1620,568],[1620,620],[-20,620]],green);
  for(let i=0;i<42;i++){const x=hash(i+25)*1600,y=570+hash(i+7)*29,h=12+hash(i+8)*27;line(c,[[x,y+10],[x+Math.sin(i)*7,y-h]],colors[5],1.5);if(env.season==='spring')oval(c,x+Math.sin(i)*7,y-h,3,2,'#d5a6a1');}
  c.restore();
  // Two passing foreground trees reveal and then frame the view, never cover it all at once.
  c.save();c.globalAlpha=d.reveal;const left=130-event.progress*800,right=1880-event.progress*420;
  for(const [x,flip] of [[left,1],[right,-1]]){
   line(c,[[x,650],[x+flip*27,280],[x+flip*12,40]],colors[5],19);
   for(let i=0;i<6;i++){const y=80+i*47,end=x+flip*(74+(i%3)*49);line(c,[[x+flip*20,y+65],[end,y]],colors[5],6);if(env.season!=='winter')for(let j=0;j<3;j++)oval(c,end+flip*j*23,y-j*8,35,15,colors[i%2?4:5]);}
  }c.restore();
 }
 return {draw,dispose(){far.width=shore.width=1;far.height=shore.height=1;},get buffers(){return 2;}};
}
