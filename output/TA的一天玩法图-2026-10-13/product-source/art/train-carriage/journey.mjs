// Route progression is driven by travelled distance, not wall-clock or random popups.
export const JOURNEY_LENGTH=120;
export const JOURNEYS={
 forest:[['crossing','林间道口',4,10],['village','山脚村落',18,14],['bridge','溪谷木桥',36,13],['station','松林小站',54,16],['tunnel','穿过山洞',76,10],['lake','山中湖泊',91,16],['train','会车',110,6]],
 coast:[['harbor','渔港与帆船',4,13],['village','海边小镇',21,13],['bridge','沿海高架桥',38,13],['station','海风站',55,16],['tunnel','穿过海岬',77,9],['lake','开阔海湾',91,16],['train','会车',110,6]],
 country:[['crossing','田间道口',4,10],['windmill','风车与麦田',18,14],['village','经过村庄',36,13],['station','麦田小站',55,16],['bridge','河上铁桥',77,10],['lake','河岸牧场',92,15],['train','会车',110,6]],
};
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function journeyAt(route,distance){
 const t=((distance%JOURNEY_LENGTH)+JOURNEY_LENGTH)%JOURNEY_LENGTH;
 const entries=JOURNEYS[route],entry=entries.find(([, ,start,duration])=>t>=start&&t<start+duration);
 if(!entry)return {id:'open',label:route==='coast'?'沿海前行':route==='country'?'田野前行':'林间前行',progress:0,phase:t,clearing:0,tunnel:0};
 const [id,label,start,duration]=entry,progress=(t-start)/duration;
 const envelope=Math.min(clamp(progress/.18,0,1),clamp((1-progress)/.18,0,1));
 return {id,label,start,duration,progress,phase:t,clearing:['lake','bridge','station','harbor','village','windmill'].includes(id)?envelope:0,tunnel:id==='tunnel'?Math.min(clamp(progress/.12,0,1),clamp((1-progress)/.14,0,1)):0};
}
export function nextJourneyDistance(route,distance){
 const cycle=Math.floor(distance/JOURNEY_LENGTH),phase=((distance%JOURNEY_LENGTH)+JOURNEY_LENGTH)%JOURNEY_LENGTH;
 const entry=JOURNEYS[route].find(([, ,start])=>start>phase+.05);
 return entry?cycle*JOURNEY_LENGTH+entry[2]+entry[3]*.35:(cycle+1)*JOURNEY_LENGTH+JOURNEYS[route][0][2]+JOURNEYS[route][0][3]*.35;
}
export function drawJourney(c,event,{colors,night,snow,season,motion,route},art){
 const {path,ellipse,house}=art;
 const dark=colors[5],cream=night?'#a3a994':'#e9dfc1',roof=night?'#4d5355':'#926b50',lit=night?'#f5ce83':'#adc9c5';
 const x=1900-event.progress*3600;
 const line=(a,b,width,color)=>{c.beginPath();c.moveTo(...a);c.lineTo(...b);c.lineWidth=width;c.strokeStyle=color;c.stroke();};
 function person(px,py,coat=dark){ellipse(c,px,py-34,6,5,cream);c.fillStyle=coat;c.fillRect(px-5,py-28,10,19);line([px-3,py-10],[px-5,py],3,dark);line([px+3,py-10],[px+5,py],3,dark);}
 function boat(px,py,scale=1){c.save();c.translate(px,py);c.scale(scale,scale);path(c,[[-50,0],[50,0],[32,18],[-30,18]],roof);line([0,-70],[0,0],3,dark);path(c,[[5,-67],[5,-4],[47,-4]],cream);path(c,[[-5,-57],[-37,-4],[-5,-4]],lit);c.restore();}
 if(event.id==='village'){
  // An actual neighbourhood passes: varied houses, a shopfront, laundry, smoke.
  for(let i=0;i<8;i++){
   const px=x+i*138,py=492+(i%3)*12,w=84+(i%3)*15;
   house(c,px,py,w,i%2?cream:colors[6],roof,night,snow?'#dce5e5':null);
   if(i===3){c.fillStyle=dark;c.fillRect(px-48,py-43,96,15);c.fillStyle=cream;c.font='12px sans-serif';c.textAlign='center';c.fillText(route==='coast'?'海边杂货':'旅途杂货',px,py-32);}
   if(i%3===0){c.save();c.globalAlpha=.25;for(let j=0;j<4;j++)ellipse(c,px+w*.3+Math.sin(motion+j)*6,py-w-10-j*13,7+j*3,5+j*2,cream);c.restore();}
  }
  line([x+142,490],[x+240,490],2,dark);for(let i=0;i<5;i++){c.fillStyle=i%2?cream:colors[4];c.fillRect(x+145+i*18,490,12,16);}
  person(x+590,514,roof);person(x+617,518,colors[3]);
 }else if(event.id==='crossing'){
  path(c,[[x-250,600],[x-36,390],[x+50,390],[x+230,600]],snow?'#c3cfd0':'#b7a991');
  line([x+100,523],[x+100,405],8,dark);line([x+90,412],[x+110,432],5,cream);line([x+110,412],[x+90,432],5,cream);
  c.fillStyle=dark;c.fillRect(x-150,515,320,7);
  for(let i=0;i<12;i++){c.fillStyle=i%2?'#c39775':cream;c.fillRect(x-145+i*25,509,22,8);}
  const car=x-25;c.fillStyle=colors[3];c.fillRect(car-50,464,98,25);c.fillRect(car-28,447,51,22);c.fillStyle=lit;c.fillRect(car-20,451,34,14);ellipse(c,car-28,490,11,8,dark);ellipse(c,car+30,490,11,8,dark);
 }else if(event.id==='station'){
  c.fillStyle=snow?'#dbe2df':'#aeaa95';c.fillRect(x-220,508,1550,54);c.fillStyle=cream;c.fillRect(x-220,515,1550,5);
  c.fillStyle=cream;c.fillRect(x+160,330,360,177);path(c,[[x+120,333],[x+345,259],[x+563,333]],roof);
  for(let i=0;i<4;i++){c.fillStyle=dark;c.fillRect(x+181+i*78,398,56,108);c.fillStyle=lit;c.fillRect(x+187+i*78,405,44,49);}
  // Long open canopy, posts and benches keep the station readable while passing.
  path(c,[[x-200,359],[x+1100,359],[x+1160,388],[x-220,388]],dark);
  for(let i=0;i<6;i++)c.fillRect(x-170+i*248,388,7,121);
  for(let i=0;i<3;i++){c.fillStyle=roof;c.fillRect(x+650+i*170,470,106,9);c.fillRect(x+658+i*170,476,7,27);c.fillRect(x+742+i*170,476,7,27);}
  c.fillStyle=dark;c.fillRect(x+580,394,252,48);c.strokeStyle=cream;c.lineWidth=2;c.strokeRect(x+586,400,240,36);c.fillStyle=cream;c.textAlign='center';c.font='23px sans-serif';c.fillText(event.label,x+706,425);
  person(x-45,505,colors[3]);person(x+40,505,roof);person(x+970,505,colors[4]);
  c.fillStyle=roof;c.fillRect(x-24,479,20,24);ellipse(c,x-25,505,3,3,dark);ellipse(c,x-4,505,3,3,dark);
  ellipse(c,x+904,501,14,7,dark);path(c,[[x+911,494],[x+913,481],[x+920,496]],dark);
 }else if(event.id==='windmill'){
  const px=x+320,py=510;c.fillStyle=cream;path(c,[[px-43,py],[px-22,py-136],[px+22,py-136],[px+43,py]],cream);path(c,[[px-31,py-136],[px,py-179],[px+31,py-136]],roof);
  c.save();c.translate(px,py-119);c.rotate(motion*.38);for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.fillStyle=dark;c.fillRect(0,-3,117,6);c.fillStyle=cream;c.fillRect(35,3,79,19);}ellipse(c,0,0,10,8,roof);c.restore();
  for(let i=0;i<5;i++){ellipse(c,x+570+i*125,507,30,22,colors[6]);c.strokeStyle=roof;c.lineWidth=2;c.strokeRect(x+548+i*125,497,44,20);}
 }else if(event.id==='harbor'){
  boat(x+160,474,1);boat(x+680,464,1.4);boat(x+1090,487,.7);
  c.fillStyle=roof;c.fillRect(x+260,507,620,13);for(let i=0;i<7;i++){c.fillRect(x+282+i*91,509,9,74);}
  for(let i=0;i<3;i++){c.fillStyle=cream;c.fillRect(x+318+i*64,480,42,27);c.strokeStyle=roof;c.lineWidth=2;c.strokeRect(x+318+i*64,480,42,27);}
  person(x+779,504,colors[3]);
 }else if(event.id==='lake'){
  // Boats / a waterside hut drift through an opening in the foreground woods.
  boat(x+470,450,.9);house(c,x+1080,435,90,cream,roof,night,snow?'#dce5e5':null);
  if(route==='country')for(let i=0;i<5;i++){const px=x+160+i*91;ellipse(c,px,515,18,9,cream);ellipse(c,px+17,511,6,5,dark);line([px-10,521],[px-10,530],2,dark);line([px+9,521],[px+9,530],2,dark);}
 }else if(event.id==='train'){
  const tx=1900-event.progress*4800;
  for(let i=0;i<6;i++){const px=tx+i*435;c.fillStyle=dark;c.beginPath();c.roundRect(px,298,420,225,19);c.fill();c.fillStyle=colors[3];c.fillRect(px,448,420,63);c.fillStyle=cream;c.fillRect(px,451,420,8);for(let j=0;j<6;j++){c.fillStyle=lit;c.fillRect(px+22+j*65,333,48,65);}ellipse(c,px+65,526,29,16,dark);ellipse(c,px+345,526,29,16,dark);}
 }
}
export function drawBridge(c,event,colors,distance){
 const alpha=event.id==='bridge'?Math.min(1,event.progress*9,(1-event.progress)*9):0;if(!alpha)return;
 c.save();c.globalAlpha=alpha;const color=colors[5];c.strokeStyle=color;c.fillStyle=color;c.lineWidth=11;
 for(const y of [387,577]){c.beginPath();c.moveTo(0,y);c.lineTo(1600,y);c.stroke();}
 const offset=-((distance*440)%420);
 for(let i=-1;i<6;i++){const x=offset+i*420;c.fillRect(x,356,16,244);c.beginPath();c.moveTo(x,387);c.lineTo(x+420,577);c.moveTo(x,577);c.lineTo(x+420,387);c.stroke();}c.restore();
}
export function drawTunnel(c,event,distance){
 if(!event.tunnel)return;
 c.save();c.globalAlpha=event.tunnel;c.fillStyle='#172022';c.fillRect(0,0,1600,600);
 c.strokeStyle='#30383a';c.lineWidth=2;for(let y=60;y<600;y+=90){c.beginPath();c.moveTo(0,y);c.lineTo(1600,y);c.stroke();}
 const offset=-((distance*600)%680);
 for(let x=offset;x<1600;x+=680){c.fillStyle='#263034';c.fillRect(x,0,18,600);const glow=c.createRadialGradient(x+140,180,3,x+140,180,115);glow.addColorStop(0,'rgba(246,186,99,.25)');glow.addColorStop(1,'rgba(246,186,99,0)');c.fillStyle=glow;c.fillRect(x+25,65,230,230);c.fillStyle='#e7c18b';c.fillRect(x+122,176,36,8);}
 c.restore();
}

export function visibleJourney(state){
 return state.routeBlend>0?{id:"open",label:"沿途",progress:0,clearing:0,tunnel:0}:journeyAt(state.route,state.eventDistance??state.distance);
}
