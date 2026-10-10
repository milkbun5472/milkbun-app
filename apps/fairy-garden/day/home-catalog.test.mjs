import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_CATALOG,HOME_LIMIT,homePlacements,homeFurniture} from './home-catalog.mjs';
import {addHomeFurniture,changeHomeFurniture,changeHomeRoom,checkHomeLayout,restoreHomeLayout} from './home-layout.mjs';

test('所有家具款式可添入真实房间，同款是独立实例，名称尺寸与渲染共用目录',()=>{
 assert.equal(HOME_CATALOG.length,20);
 for(const item of HOME_CATALOG){const added=addHomeFurniture({},item.id);assert.equal(added.ok,true,item.id);const p=homeFurniture(added.placements).find(p=>p.id===added.selected);assert.equal(p.catalogId,item.id);assert.equal(p.w,item.w);assert.equal(p.d,item.d);assert.equal(checkHomeLayout(added.placements).ok,true);}
 const first=addHomeFurniture({},'chair'),second=addHomeFurniture(first.placements,'chair');assert.notEqual(first.selected,second.selected);assert.equal(homeFurniture(second.placements).filter(p=>p.catalogId==='chair').length,4);
 const color=changeHomeFurniture(second.placements,first.selected,{color:'#123456',material:'metal'});assert.equal(color.ok,true);assert.equal(color.placements[first.selected].material,'metal');assert.equal(color.placements[second.selected].color,'');assert.equal(second.placements[first.selected].color,'');
});
test('旧布局原位迁移，单件颜色材质与墙地面被校验，多件数量有界',()=>{
 assert.doesNotThrow(()=>homePlacements({sofa:null,$room:null}));
 const old={sofa:{x:-3,z:1.4,heading:Math.PI,stored:true}},next=homePlacements(old);assert.equal(next.sofa.x,-3);assert.equal(next.sofa.heading,Math.PI);assert.equal(next.sofa.stored,true);assert.equal(next.sofa.catalogId,'sofa');
 const raw={...next,$room:{wall:'stripe',floor:'tile',wallColor:'#ABCDEF',floorColor:'invalid',uses:{sleep:'furniture-1',bad:'sofa'}},'furniture-1':{catalogId:'soft-bed',x:NaN,z:Infinity,color:'evil',material:'evil'},'furniture-2':{catalogId:'unknown'}};
 const clean=homePlacements(raw);assert.equal(clean.$room.wallColor,'#abcdef');assert.equal(clean.$room.floorColor,'');assert.equal(clean.$room.uses.bad,undefined);assert.equal(clean['furniture-1'].color,'');assert.equal(clean['furniture-1'].material,'auto');assert.equal(clean['furniture-2'],undefined);
 const crowded={};for(let i=1;i<=100;i++)crowded['furniture-'+i]={catalogId:'plant',stored:true};assert.equal(homeFurniture(crowded).length,HOME_LIMIT);assert.equal(addHomeFurniture(crowded,'chair').ok,false);
});
test('新床与餐椅可指定供TA使用，坐睡位置朝向沿实际家具，收纳后回可用同类',()=>{
 let bed=addHomeFurniture({},'soft-bed'),chosen=changeHomeFurniture(bed.placements,bed.selected,'use');assert.equal(chosen.ok,true);assert.equal(chosen.map.spots.find(s=>s.id==='sleep').piece,bed.selected);
 const sleep=chosen.map.beds.sleep.slots.companion,p=chosen.placements[bed.selected];assert.ok(Math.abs(sleep.x-p.x-.55)<1e-6);assert.ok(Math.abs(sleep.z-p.z-.65)<1e-6);
 const stored=changeHomeFurniture(chosen.placements,bed.selected,'store');assert.equal(stored.ok,true);assert.equal(stored.map.spots.find(s=>s.id==='sleep').piece,'double-bed');assert.equal(stored.placements.$room.uses.sleep,bed.selected);
 const restored=changeHomeFurniture(stored.placements,bed.selected,'restore');assert.equal(restored.ok,true);assert.equal(restored.map.spots.find(s=>s.id==='sleep').piece,bed.selected);
 const chair=addHomeFurniture(restored.placements,'wood-chair'),meal=changeHomeFurniture(chair.placements,chair.selected,'use');assert.equal(meal.ok,true);assert.equal(meal.map.seats.meal.piece,chair.selected);assert.equal(meal.map.seats.meal.x,meal.placements[chair.selected].x);
});
test('墙地面和单件饰面不改碰撞坐睡点，失效新实例收纳修复保留款色',()=>{
 const added=addHomeFurniture({},'plant'),base=checkHomeLayout(added.placements),changed=changeHomeRoom(added.placements,{wall:'stripe',floor:'sage',wallColor:'#cceedd'});assert.equal(changed.ok,true);assert.deepEqual(changed.map.obstacles,base.map.obstacles);assert.deepEqual(changed.map.spots,base.map.spots);assert.equal(changed.map.room.wall,'stripe');
 const painted=changeHomeFurniture(changed.placements,added.selected,{color:'#445566',material:'fabric'});const bad=homePlacements(painted.placements);bad[added.selected].x=100;const rescued=restoreHomeLayout(bad);assert.equal(rescued[added.selected].stored,true);assert.equal(rescued[added.selected].color,'#445566');assert.equal(rescued.$room.floor,'sage');assert.equal(checkHomeLayout(rescued).ok,true);
});
test('房间放满时新家具进收纳，留住实例而不挤坏现有路线',()=>{
 let raw={},stored=0;for(let i=0;i<12;i++){const added=addHomeFurniture(raw,'wood-bed');assert.equal(added.ok,true);raw=added.placements;if(raw[added.selected].stored){stored++;assert.match(added.notice,/收纳/);assert.equal(added.map.furniture.some(p=>p.id===added.selected),false);}}
 assert.ok(stored>0);assert.equal(homeFurniture(raw).length,24);assert.equal(checkHomeLayout(raw).ok,true);
});
