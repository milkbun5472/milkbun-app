import {createRoomKit,roomObstacles,finishRoom} from './room-kit.mjs?v=fg-f9a3c901abadb37b';
import {computer,notebook} from './work-room-kit.mjs?v=fg-f9a3c901abadb37b';
import {furnishRoom,seatedSpot,benchFlask} from './occupation-room-kit.mjs?v=fg-f9a3c901abadb37b';
const SIZE={w:14,d:12};
const furniture=[
 {id:'law-desk',kind:'table',x:-4.6,z:-3.8,w:2.8,d:1.15,top:.85,color:'#a89980',work:{research:{x:0,y:.91,z:.40},draft:{x:-.20,y:.905,z:.40}}},
 {id:'law-chair',kind:'chair',x:-4.6,z:-2.96,w:.56,d:.57,heading:Math.PI,color:'#8e9b8b'},
 {id:'case-cabinet',kind:'cabinet',x:-6.05,z:.48,w:1.35,d:.72,h:1.9,color:'#7d8b85'},
 {id:'consult-table',kind:'table',x:-3.5,z:1.45,w:2.4,d:1.07,top:.85,color:'#b8a68d',work:{consult:{x:0,y:.90,z:.36}}},
 {id:'consult-chair',kind:'chair',x:-3.5,z:2.25,w:.56,d:.57,heading:Math.PI,color:'#8e9b8b'},
 {id:'court-divider',kind:'partition',x:.0,z:-2.15,w:.14,d:4.65},
 {id:'judge-desk',kind:'table',x:3.8,z:-4.12,w:4.10,d:1.08,top:.85,color:'#88705d',work:{judge:{x:.0,y:.895,z:-.35},hearing:{x:-.65,y:.91,z:-.35}}},
 {id:'judge-chair',kind:'chair',x:3.8,z:-4.95,w:.56,d:.57,heading:0,color:'#8c7d76'},
 {id:'court-lectern',kind:'table',x:3.85,z:-.25,w:1.46,d:.78,top:.85,color:'#ad8d72',work:{argue:{x:0,y:.90,z:.23}}},
 {id:'court-notes',kind:'table',x:5.4,z:2.18,w:1.9,d:.9,top:.85,color:'#ae967d',work:{record:{x:-.17,y:.905,z:.34}}},
 {id:'clerk-chair',kind:'chair',x:5.4,z:2.91,w:.56,d:.57,heading:Math.PI,color:'#8f9d96'},
 {id:'public-bench',kind:'bench',heading:0,x:1.75,z:3.5,w:2.35,d:.65,seat:.45,color:'#9a9f89'},
 {id:'legal-plant',kind:'plant',x:-5.7,z:4.45,w:.55,d:.55}
];
const seat=(id,label,description,chair,approach,piece,action)=>seatedSpot(furniture,{id,label,description,chair,approach,piece,action});
const spots=[
 {id:'entrance',label:'律所与庭审区入口',description:'进入值班律所或相邻的庭审区。',action:'rest',gesture:'rest',target:{x:0,z:5.15},heading:Math.PI},
 {id:'files',label:'案卷柜取放材料',description:'取本案材料，归还已整理的案卷。',action:'work',gesture:'rest',target:{x:-6.05,z:1.32},heading:Math.PI,furniture:'case-cabinet'},
 seat('research','电脑检索法条','在律所工位检索法条、整理案件资料。','law-chair',{x:-3.77,z:-2.96},'law-desk'),
 seat('draft','起草文书','对照纸本材料起草、校阅本案文书。','law-chair',{x:-3.77,z:-2.96},'law-desk'),
 seat('consult','会谈与法律咨询','在会谈桌听取情况、解释材料，不替角色生成客户。','consult-chair',{x:-2.67,z:2.25},'consult-table'),
 {id:'argue',label:'庭上陈述与辩论',description:'站在庭审陈述台前说明本案观点。',action:'work',gesture:'rest',target:{x:3.85,z:.48},heading:Math.PI,furniture:'court-lectern'},
 seat('hearing','法官席听审','在审判席听取庭上陈述，查看本案记录。','judge-chair',{x:4.63,z:-4.95},'judge-desk'),
 seat('judge','审判席敲槌','在实际槌垫上短敲法槌，随后收手。','judge-chair',{x:4.63,z:-4.95},'judge-desk'),
 seat('record','书记员庭审记录','在侧边记录桌写庭审笔录。','clerk-chair',{x:6.23,z:2.91},'court-notes'),
 seat('audience','旁听席听审','在旁听席听审，不占用法官与律师工位。','public-bench',{x:1.75,z:4.32},'public-bench'),
 seat('rest','庭审间隙休息','到旁听长椅短暂休息，工作动作停下。','public-bench',{x:1.75,z:4.32},'public-bench','rest'),
 seat('water','庭审间隙喝水','在旁听区小坐喝水，随后继续本次安排。','public-bench',{x:1.75,z:4.32},'public-bench','tea'),
 {id:'exit',label:'收卷离开',description:'收好材料后回到入口。',action:'rest',gesture:'rest',target:{x:0,z:5.38},heading:0}
];
export const legalMap={label:'律所／法庭',renderer:'dayLegal',radius:12,bounds:SIZE,floor:.08,spawn:{x:0,z:5.38},view:{x:0,z:0},furniture,seats:Object.fromEntries(spots.filter(s=>s.seat).map(s=>[s.id,s.seat])),obstacles:roomObstacles(furniture,SIZE),spots,tour:spots.map(s=>s.id)};
export function createLegal(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#ccc9bb',wallColor:'#e3e1d5',accent:'#7e8e87',joins:false});
 k.box('CourtFloor',{x:3.45,y:.09,z:-.75,w:6.75,h:.014,d:9.9,color:'#baa78e'});k.box('ConsultRug',{x:-3.5,y:.09,z:1.8,w:4.1,h:.014,d:3.15,color:'#bdc7b8'});
 const divider=k.group('court-divider',{z:-2.15});k.box('CourtScreenBase',{y:.66,w:.14,h:1.17,d:4.65,color:'#9caa9d'},divider);for(let z=-2.14;z<=2.14;z+=.36)k.box('CourtScreenSlat',{y:1.82,z,w:.12,h:1.1,d:.065,color:'#c4c9b7'},divider);
 furnishRoom(k,furniture);computer(k,furniture[0]);notebook(k,furniture[0],'draft');notebook(k,furniture.find(p=>p.id==='court-notes'),'record');
 // The judge faces the public from behind a paneled bench; the counsel's
 // lectern is a solid standing pedestal, not a second writing table.
 const bench=k.root.getObjectByName('judge-desk');k.box('CourtBenchFacade',{y:.47,z:.45,w:4.1,h:.70,d:.11,color:'#8b715b'},bench);
 for(let i=0;i<5;i++){k.box('CourtBenchPanel',{x:-1.58+i*.79,y:.46,z:.516,w:.65,h:.49,d:.035,color:'#a0866c'},bench);}
 const lectern=k.root.getObjectByName('court-lectern');k.box('LecternPedestal',{y:.48,w:1.04,h:.77,d:.50,color:'#a3866a'},lectern);k.box('LecternFrontInset',{y:.49,z:.28,w:.81,h:.5,d:.03,color:'#c0a78a'},lectern);k.book('CounselMaterials',{y:.975,w:.47,d:.36,flat:true,color:'#7a8d88'},lectern);
 for(const x of [1.15,6.42]){k.box('CourtColumn',{x,y:1.59,z:-5.72,w:.24,h:2.82,d:.26,color:'#baa890'});k.box('CourtColumnCapital',{x,y:2.96,z:-5.72,w:.43,h:.14,d:.33,color:'#9d8d77'});}
 const scales=k.group('JusticeScales',{x:3.8,y:2.4,z:-5.78});k.cylinder('ScaleStem',{y:0,r:.025,h:.62,color:'#ac9978'},scales);k.box('ScaleBeam',{y:.20,w:.83,h:.035,d:.04,color:'#ac9978'},scales);for(const side of [-1,1]){k.tube('ScaleChain',{points:[[side*.34,.20,0],[side*.34,-.14,.0]],r:.009,color:'#b5a783'},scales);k.cylinder('ScalePan',{x:side*.34,y:-.15,r:.14,h:.025,color:'#ac9978'},scales);}
 const jd=furniture.find(p=>p.id==='judge-desk'),pad=k.replaceableGroup('GavelPad',{x:jd.x,y:.08+jd.work.judge.y-.02,z:jd.z+jd.work.judge.z});k.cylinder('GavelSoundBlock',{r:.14,h:.04,color:'#6e594a'},pad);
 const notes=k.root.getObjectByName('judge-desk');k.book('CourtDocket',{x:-.66,y:.98,z:-.35,w:.48,d:.38,flat:true,color:'#94887b'},notes);
 k.sign('LegalWall',{text:'阅卷 · 会谈 · 庭审',x:-3.8,y:2.8,z:-5.85,w:3.7,h:.35,color:'#e3e1d5',ink:'#6d847b'});k.sign('CourtWall',{text:'审理席',x:3.8,y:1.95,z:-5.85,w:2,h:.38,color:'#e3e1d5',ink:'#7b6455'});
 for(let i=0;i<9;i++)k.book('CaseFile',{x:-5.72+i*.28,y:1.02,z:-4.03,color:i%2?'#afaa91':'#8a9b91'});
 benchFlask(k,furniture.find(p=>p.id==='public-bench'));
 return finishRoom(k,legalMap,'DayLegal');
}
