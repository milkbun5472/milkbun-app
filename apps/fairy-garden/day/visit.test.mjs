import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,walkable,segmentClear} from '../world.mjs';
import {buildSpace,registerCoreSpaces} from './spaces.mjs';
import {BASE_HOME,furniturePoint} from './home-catalog.mjs';
import {chooseVisitSeat,visitSeats,visitorAvoid,createHomeVisit} from './visit.mjs';
import {motionProfile} from './motion-profile.mjs';
registerCoreSpaces(MAPS);
const empty=()=>Object.fromEntries(BASE_HOME.map(p=>[p.id,{stored:true}]));
test('并排坐位读取实际家具，两侧和四种旋转都分开，路线不穿家具或TA',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const offset of [-.6,.6]){
  const raw={...empty(),sofa:{x:-3,z:0,heading}},map=MAPS.dayHome=buildSpace('dayHome',raw),p=map.furniture.find(p=>p.id==='sofa'),occupied={...furniturePoint(p,{x:offset,z:.05}),piece:p.id},choice=chooseVisitSeat(map,map.spawn,occupied,occupied);
  assert.ok(choice);assert.equal(choice.shared,true);assert.equal(choice.seat.piece,'sofa');assert.equal(choice.seat.heading,heading);assert.ok(Math.abs(Math.hypot(choice.seat.x-occupied.x,choice.seat.z-occupied.z)-1.2)<1e-9);
  let from=map.spawn;for(const to of choice.route){assert.ok(segmentClear(from,to,'dayHome',visitorAvoid(occupied)));from=to;}assert.ok(walkable(from.x,from.z,'dayHome'));
 }
});
test('不能抢占单人椅，沙发收起后用实际空椅，全收起不会编出空位',()=>{
 const map=MAPS.dayHome=buildSpace('dayHome',{sofa:{stored:true}}),occupied={...map.seats.meal},choice=chooseVisitSeat(map,map.spawn,occupied,occupied);
 assert.ok(choice);assert.equal(choice.seat.piece,'partner-chair');assert.ok(!visitSeats(map,occupied).some(q=>q.seat.piece==='dining-chair'));
 const none=MAPS.dayHome=buildSpace('dayHome',empty());assert.equal(chooseVisitSeat(none,none.spawn,null,none.spawn),null);
});
test('实际路线到达后才坐下，拒绝障碍点，起身离开清理全部临时状态',()=>{
 MAPS.dayHome=buildSpace('dayHome');const ta={...MAPS.dayHome.seats.read,seat:MAPS.dayHome.seats.read},events=[],avatar={root:{visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;},toArray(){return [this.x,this.y,this.z];}},rotation:{},userData:{}},animate(){}};
 const visit=createHomeVisit({avatar,ta:()=>ta,onChange:v=>events.push(v)}),settle=()=>{for(let i=0;i<1800&&visit.inspect().busy;i++){const before=visit.inspect().position;visit.tick(1/60,i/60);assert.ok(segmentClear(before,visit.inspect().position,'dayHome',visitorAvoid(ta)));}assert.equal(visit.inspect().busy,false);};
 assert.equal(visit.inspect().present,false);visit.join();settle();assert.equal(visit.inspect().present,true);assert.equal(visit.act('walk',{x:3,z:-.25}),false);assert.equal(visit.inspect().seated,false);
 assert.equal(visit.act('sit'),true);assert.equal(visit.inspect().seated,false);settle();assert.equal(visit.inspect().seated,true);assert.equal(visit.inspect().seat.piece,'sofa');assert.equal(visit.act('stand'),true);assert.equal(visit.inspect().seat,null);
 visit.act('leave');settle();assert.equal(visit.inspect().present,false);assert.equal(visit.inspect().visible,false);assert.equal(visit.inspect().route.length,0);assert.ok(events.some(v=>v.seated));
 visit.join();settle();visit.close('安排变了');assert.equal(visit.inspect().present,false);assert.equal(visit.inspect().notice,'安排变了');
});
test('同屋各自看书喝水用餐，餐椅和道具不抢TA，离开动作清理；桌椅不存在时如实拒绝',()=>{
 MAPS.dayHome=buildSpace('dayHome');let ta={...MAPS.dayHome.seats.read,seat:MAPS.dayHome.seats.read},lastPose;
 const avatar={root:{visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;},toArray(){return [this.x,this.y,this.z];}},rotation:{},userData:{}},animate(t,p){lastPose=p;}};
 const profile=motionProfile({id:'__me',style:'lively'}),v=createHomeVisit({avatar,ta:()=>ta,motion:()=>profile}),settle=()=>{for(let i=0;i<2400&&v.inspect().busy;i++)v.tick(1/60,i/60);v.tick(1/60,100);assert.equal(v.inspect().busy,false);};
 v.join();settle();for(const [kind,task]of [['read','read'],['drink','drink'],['eat','eat'],['rest',null]]){assert.equal(v.act(kind),true);settle();assert.equal(v.inspect().activity,kind);assert.equal(lastPose.task?.kind||null,task);assert.equal(lastPose.motion.style,'lively');assert.ok(Math.hypot(v.inspect().visualPosition[0]-ta.x,v.inspect().visualPosition[2]-ta.z)>.7);if(kind==='eat')assert.equal(v.inspect().seat.piece,'dining-chair');}
 v.act('stand');v.tick(1/60,101);assert.equal(lastPose.task,null);assert.equal(v.inspect().activity,null);v.close();assert.equal(v.inspect().task,null);
 MAPS.dayHome=buildSpace('dayHome',{'dining-table':{stored:true}});v.join();settle();assert.equal(v.act('eat'),false);assert.match(v.inspect().notice,/餐桌/);
});
function controlledVisit(layout={},choice='auto'){
 MAPS.dayHome=buildSpace('dayHome',layout);const host=MAPS.dayHome.seats.read?{...MAPS.dayHome.seats.read,seat:MAPS.dayHome.seats.read}:{x:-3,z:-1};let profile=motionProfile({id:'__me:me',persona:'性格活泼好动'}),pose,time=0;
 const avatar={root:{visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;},toArray(){return [this.x,this.y,this.z];}},rotation:{},userData:{}},animate(t,p){pose=p;}};
 const visit=createHomeVisit({avatar,ta:()=>host,motion:()=>profile,choice});
 const tick=(n=1)=>{for(let i=0;i<n;i++){const previous=visit.inspect().position;visit.tick(.1,time+=.1);assert.ok(segmentClear(previous,visit.inspect().position,'dayHome',visitorAvoid(host)));}};
 const settle=()=>{for(let i=0;i<400&&visit.inspect().busy;i++)tick();tick();assert.equal(visit.inspect().busy,false);};
 return {visit,tick,settle,pose:()=>pose,changePersona:()=>{profile=motionProfile({id:'__me:me',persona:'性格沉稳寡言'});}};
}
test('自动活动沿真实空位轮换且避让，手动中途接管后长期保持；明确切回自动才继续',()=>{
 const f=controlledVisit(),v=f.visit,seen=new Set();v.join();
 for(let i=0;i<2600;i++){f.tick();const s=v.inspect();if(s.activity)seen.add(s.activity);assert.equal(s.control,'auto');}
 for(const kind of ['read','drink','rest'])assert.ok(seen.has(kind),kind+'自动发生');
 v.act('auto');f.tick(100);assert.equal(v.inspect().control,'auto');
 assert.equal(v.act('read'),true);assert.equal(v.inspect().control,'manual');f.settle();const held=v.inspect().position;
 f.changePersona();f.tick(6000);assert.equal(v.inspect().activity,'read');assert.deepEqual(v.inspect().position,held);assert.equal(v.inspect().control,'manual');assert.equal(f.pose().task.kind,'read');
 assert.equal(v.act('leave'),true);assert.equal(v.inspect().leaving,true);assert.equal(v.act('drink'),true);assert.equal(v.inspect().leaving,false);f.settle();assert.equal(v.inspect().activity,'drink');
 v.act('auto');const resumed=new Set();for(let i=0;i<1500;i++){f.tick();if(v.inspect().activity)resumed.add(v.inspect().activity);}assert.equal(v.inspect().control,'auto');assert.ok(resumed.size>=2);
});
test('被拒绝的手动命令也撤销自动路线；停下、重进、门口离开都不暗自恢复自动',()=>{
 const f=controlledVisit(empty()),v=f.visit;v.join();assert.equal(v.inspect().busy,true);
 assert.equal(v.act('eat'),false);assert.equal(v.inspect().control,'manual');assert.equal(v.inspect().busy,false);const stopped=v.inspect().position;
 f.tick(3000);assert.deepEqual(v.inspect().position,stopped);assert.equal(f.pose().task,null);
 v.close();v.join();assert.equal(v.inspect().control,'manual');assert.equal(v.inspect().busy,false);
 assert.equal(v.act('manual'),true);assert.equal(v.act('leave'),true);f.settle();assert.equal(v.inspect().present,false);
 v.join();const before=v.inspect().position;v.act('auto');f.tick(20);assert.equal(v.inspect().control,'auto');assert.ok(Math.hypot(v.inspect().position.x-before.x,v.inspect().position.z-before.z)>.3);
 v.act('manual');assert.equal(v.inspect().busy,false);f.tick(1500);assert.equal(v.inspect().control,'manual');
});
test('重新创建现场沿保存的手动选择开始，人设和等待都不能恢复自动',()=>{
 for(const choice of ['manual','read','drink','eat','rest']){
  const f=controlledVisit({},choice),v=f.visit;assert.equal(v.inspect().control,'manual');v.join();f.settle();f.changePersona();f.tick(2000);
  assert.equal(v.inspect().control,'manual');assert.equal(v.inspect().manualAction,choice);assert.equal(v.inspect().activity,choice==='manual'?null:choice);
 }
});
