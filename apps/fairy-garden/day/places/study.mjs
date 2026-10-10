import {createRoomKit,roomObstacles,finishRoom} from './room-kit.mjs?v=fg-7dbe5530b8cc1d34';
import {furnishRoom,seatedSpot} from './occupation-room-kit.mjs?v=fg-7dbe5530b8cc1d34';
const SIZE={w:14,d:12};
const furniture=[
 {id:'ink-desk',kind:'table',x:-4.35,z:-3.9,w:3.0,d:1.18,top:.85,color:'#a58768',work:{write:{x:-.12,y:.90,z:.38}}},
 {id:'ink-chair',kind:'chair',x:-4.35,z:-3.06,w:.56,d:.57,heading:Math.PI,color:'#a18c70'},
 {id:'scroll-rack',kind:'equipment',x:-6.02,z:.1,w:1.3,d:.78},
 {id:'read-table',kind:'table',x:-3.4,z:1.85,w:2.2,d:1.0,top:.85,color:'#b39977'},
 {id:'read-chair',kind:'chair',x:-3.4,z:2.61,w:.56,d:.57,heading:Math.PI,color:'#a69b7e'},
 {id:'study-screen',kind:'partition',x:.35,z:-3.32,w:.15,d:3.91},
 {id:'council-table',kind:'table',x:3.92,z:-2.07,w:3.0,d:1.37,top:.85,color:'#a58c6c',work:{records:{x:-.15,y:.90,z:.49}}},
 {id:'council-chair',kind:'chair',x:3.92,z:-1.14,w:.56,d:.57,heading:Math.PI,color:'#ac9578'},
 {id:'tea-table',kind:'table',x:3.5,z:2.24,w:2.05,d:1.02,top:.85,color:'#b19a7a',work:{tea:{x:0,y:.90,z:.34}}},
 {id:'tea-chair',kind:'chair',x:3.5,z:3.0,w:.56,d:.57,heading:Math.PI,color:'#a59d7d'},
 {id:'study-bench',kind:'bench',heading:0,x:-3.7,z:4.25,w:2.8,d:.65,seat:.45,color:'#aeb69a'},
 {id:'study-plant',kind:'plant',x:5.95,z:-4.95,w:.55,d:.55}
];
const seat=(id,label,description,chair,approach,piece,action)=>seatedSpot(furniture,{id,label,description,chair,approach,piece,action});
const spots=[
 {id:'entrance',label:'书房与议事厅入口',description:'从门前进入书房或议事厅。',action:'rest',gesture:'rest',target:{x:0,z:5.1},heading:Math.PI},
 {id:'scrolls',label:'卷轴架前取放',description:'取用、归还今日要读的书卷。',action:'work',gesture:'rest',target:{x:-6.02,z:.99},heading:Math.PI,furniture:'scroll-rack'},
 seat('read','窗下读卷','在花窗旁读书、翻阅奏章与信件。','read-chair',{x:-2.57,z:2.61},'read-table','read'),
 seat('write','笔墨桌前书写','短毛笔贴住纸面书写，砚台和镇纸留在桌上。','ink-chair',{x:-3.52,z:-3.06},'ink-desk'),
 seat('council','议事席听取商议','在议事席听取安排，与日程中的人物商议。','council-chair',{x:4.75,z:-1.14},'council-table'),
 {id:'address',label:'厅内陈述与议事',description:'在议事桌边起身说明安排，带有自然陈述手势。',action:'work',gesture:'rest',target:{x:2.25,z:-.51},heading:Math.PI,furniture:'council-table'},
 seat('records','记录议事要点','在议事桌铺开的纸卷上记录要点。','council-chair',{x:4.75,z:-1.14},'council-table'),
 seat('tea','茶席小歇','在陶壶茶杯旁小坐，沿已有喝茶动作。','tea-chair',{x:4.33,z:3.0},'tea-table','tea'),
 seat('rest','窗边长椅休息','暂放书卷，坐在窗边休息。','study-bench',{x:-3.7,z:5.08},'study-bench','rest'),
 {id:'exit',label:'收卷离开',description:'收起书卷后从门前离开。',action:'rest',gesture:'rest',target:{x:0,z:5.38},heading:0}
];
export const studyMap={label:'古风书房／议事厅',renderer:'dayStudy',radius:12,bounds:SIZE,floor:.08,spawn:{x:0,z:5.38},view:{x:0,z:0},furniture,seats:Object.fromEntries(spots.filter(s=>s.seat).map(s=>[s.id,s.seat])),obstacles:roomObstacles(furniture,SIZE),spots,tour:spots.map(s=>s.id)};
function scroll(k,parent,{x=0,y=0,z=0,w=.58,d=.38}={}){
 k.box('ScrollPaper',{x,y,z,w,h:.02,d,color:'#eee3c7',radius:.003},parent);for(const side of [-1,1])k.cylinder('ScrollRoller',{x:x+side*w/2,y:y+.023,z,r:.035,h:d+.1,color:'#987c59',rotation:[Math.PI/2,0,0]},parent);
 for(let i=0;i<4;i++)k.box('InkText',{x:x-.12+i*.08,y:y+.012,z,w:.006,h:.003,d:d*.6,color:'#9c9781',radius:0},parent);
}
export function createStudy(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#c1a786',wallColor:'#e6ddc3',accent:'#a18665'});
 for(const x of [-6.6,-.3,6.65])k.box('TimberPillar',{x,y:1.67,z:-5.75,w:.18,h:3.3,d:.20,color:'#9c7d5b'});k.box('TimberBeam',{y:3.1,z:-5.74,w:13.5,h:.2,d:.24,color:'#9c7d5b'});
 for(const x of [-4.45,3.74]){k.box('PaperWindow',{x,y:1.9,z:-5.88,w:3.55,h:1.68,d:.028,color:'#e8edd4'},k.root);for(let i=0;i<7;i++)k.box('WindowLattice',{x:x-1.58+i*.525,y:1.9,z:-5.84,w:.028,h:1.72,d:.04,color:'#aa9170'});for(let i=0;i<4;i++)k.box('WindowRail',{x,y:1.1+i*.54,z:-5.83,w:3.62,h:.027,d:.04,color:'#aa9170'});}
 // Open-sided curved eaves frame the room without hiding the dolls.
 k.tube('CurvedEave',{points:[[-6.8,3.2,-5.7],[-4,3.05,-5.7],[0,3.02,-5.7],[4,3.05,-5.7],[6.8,3.2,-5.7]],r:.07,color:'#877757'});
 furnishRoom(k,furniture);const screen=k.group('study-screen',{x:.35,z:-3.32});for(let i=0;i<3;i++){const z=-1.29+i*1.29;k.box('ScreenPaper',{y:1.36,z,w:.15,h:2.55,d:1.15,color:'#d9d4b6'},screen);for(const dz of [-.60,.60])k.box('ScreenFrame',{y:1.36,z:z+dz,w:.15,h:2.55,d:.045,color:'#9e8766'},screen);k.sign('ScreenPoem',{text:['山','水','间'][i],x:.086,y:1.65,z,w:.5,h:.6,heading:Math.PI/2,color:'#d9d4b6',ink:'#929379'},screen);}
 const rack=k.group('scroll-rack',{x:-6.02,z:.1});for(const x of [-.59,.59])k.box('ScrollRackUpright',{x,y:1.08,w:.08,h:2.0,d:.78,color:'#a28967'},rack);for(let i=0;i<4;i++){const y=.35+i*.48;k.box('ScrollShelf',{y,w:1.3,h:.065,d:.78,color:'#af9673'},rack);for(let n=0;n<3;n++)k.cylinder('StoredScroll',{x:-.40+n*.40,y:y+.1,z:.07,r:.07,h:.57,color:n%2?'#d6c797':'#e3d7b6',rotation:[Math.PI/2,0,0]},rack);}
 for(const [id,key]of [['ink-desk','write'],['council-table','records']]){const p=furniture.find(p=>p.id===id),a=p.work[key],g=k.root.getObjectByName(id);scroll(k,g,{x:a.x,y:.08+a.y-.012,z:a.z});k.box('InkStone',{x:.66,y:.96,z:.24,w:.22,h:.06,d:.16,color:'#727d71'},g);k.box('Paperweight',{x:a.x-.17,y:.978,z:a.z-.14,w:.30,h:.045,d:.047,color:'#978763'},g);}
 scroll(k,k.root.getObjectByName('read-table'),{y:.97,z:.06,w:.72,d:.44});const tea=k.root.getObjectByName('tea-table');k.ellipsoid('ClayTeapot',{x:-.42,y:1.04,z:-.12,w:.27,h:.23,d:.24,color:'#a98d68'},tea);k.cylinder('TeaCup',{x:.12,y:.984,z:.25,r:.07,h:.095,color:'#d2cbb0'},tea);k.sign('StudyPlaque',{text:'静观 · 读卷 · 议事',x:0,y:2.79,z:-5.83,w:3.25,h:.37,color:'#e6ddc3',ink:'#8a8061'});
 return finishRoom(k,studyMap,'DayStudy');
}
