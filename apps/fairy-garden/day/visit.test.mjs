import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,walkable,segmentClear} from '../world.mjs';
import {buildSpace,registerCoreSpaces} from './spaces.mjs';
import {BASE_HOME,furniturePoint} from './home-catalog.mjs';
import {chooseVisitSeat,visitSeats,visitorAvoid,createHomeVisit} from './visit.mjs';
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
