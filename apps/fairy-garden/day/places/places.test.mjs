import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {MAPS,walkable,segmentClear,findPath,floorHeight} from '../../world.mjs';
import {stepRoute} from '../../locomotion.mjs';

// The production import map resolves Three. Keep the same local vendor in Node tests.
registerHooks({resolve(specifier,context,nextResolve){
  return specifier==='three'?{url:new URL('../../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:nextResolve(specifier,context);
}});
const {DAY_PLACES,DAY_FACTORIES,registerDayPlaces,placeList}=await import('./index.mjs');
const T=await import('three');
const persistentMaps=Object.keys(MAPS);
registerDayPlaces(MAPS);

test('独立场景注册保留原地图，展示名单按真实动作点编号',()=>{
  assert.deepEqual(Object.keys(DAY_PLACES),['dayLaboratory','dayLibrary']);
  for(const id of persistentMaps)assert.ok(MAPS[id]);
  const list=placeList();
  for(const p of list){
    assert.equal(p.label,DAY_PLACES[p.id].label);
    assert.deepEqual(p.spots.map(s=>s.number),p.spots.map((_,i)=>i+1));
    assert.deepEqual(p.spots.map(s=>s.id),DAY_PLACES[p.id].spots.map(s=>s.id));
    assert.ok(p.spots.every(s=>s.label&&s.description&&s.action&&s.gesture));
  }
});

for(const [id,map]of Object.entries(DAY_PLACES)){
  test(map.label+'：入口、离开与全部动作位置可走，任意两点沿实际步进不穿家具',()=>{
    assert.equal(map.floor,.08);assert.ok(map.bounds.w>=8&&map.bounds.d>=8);
    assert.ok(walkable(map.spawn.x,map.spawn.z,id));
    assert.ok(map.spots.some(s=>/入口|离开/.test(s.label+s.description)));
    const points=[{id:'spawn',target:map.spawn},...map.spots];
    assert.equal(new Set(map.spots.map(s=>s.id)).size,map.spots.length);
    for(const p of points){
      assert.ok(walkable(p.target.x,p.target.z,id),p.id+'不在家具碰撞内');
      assert.equal(floorHeight(id,p.target),.08);
    }
    for(const a of points)for(const b of points){
      if(a===b||Math.hypot(a.target.x-b.target.x,a.target.z-b.target.z)<.001)continue;
      const route=findPath(a.target,b.target,id);
      assert.ok(route?.length,`${a.id} → ${b.id}有路线`);
      let from=a.target;
      for(const to of route){assert.ok(segmentClear(from,to,id),`${a.id} → ${b.id}每段避障`);from=to;}
      let position={...a.target},speed=0,frames=0;
      const pending=route.map(p=>({...p}));
      while(pending.length&&frames++<2000){
        const prev=position,step=stepRoute(position,pending,.05,{speed,walkSpeed:1.6,clear:(x,y)=>segmentClear(x,y,id)});
        position=step.position;speed=step.speed;
        assert.equal(step.blocked,false,`${a.id} → ${b.id}实际步进不中断`);
        assert.ok(walkable(position.x,position.z,id));assert.ok(segmentClear(prev,position,id));
      }
      assert.equal(pending.length,0,`${a.id} → ${b.id}抵达`);
      assert.ok(Math.hypot(position.x-b.target.x,position.z-b.target.z)<.01);
    }
  });

  test(map.label+'：家具实际中心与障碍一致，坐位落在真椅子上，桌椅高度沿原小人',()=>{
    const {root}=DAY_FACTORIES[id]();root.updateMatrixWorld(true);
    const furniture=root.userData.furniture;
    assert.ok(furniture?.length>=10,'家具元数据来自真正建造的那张表');
    for(const p of furniture){
      const obstacle=map.obstacles.find(o=>o.id===p.id);assert.ok(obstacle,p.id+'有碰撞');
      for(const k of ['x','z','w','d'])assert.equal(obstacle[k],p[k],p.id+'的'+k);
      assert.equal(walkable(p.x,p.z,id),false,p.id+'实体不允许穿过');
      if(['chair','table','counter','cabinet','shelf'].includes(p.kind)){
        const group=root.getObjectByName(p.id);assert.ok(group,p.id+'真家具组仍在');
        assert.equal(group.position.x,p.x);assert.equal(group.position.z,p.z);
      }
      if(['table','counter'].includes(p.kind))assert.ok([.58,.85,1].includes(p.top),p.id+'台面高度适合现有体型');
    }
    const ray=new T.Raycaster();
    for(const seat of Object.values(map.seats)){
      const p=furniture.find(p=>p.id===seat.piece);assert.equal(p?.kind,'chair');
      assert.equal(seat.x,p.x);assert.equal(seat.z,p.z);assert.equal(seat.rise,.45);
      assert.equal(seat.heading,p.heading);
      assert.ok(walkable(seat.approach.x,seat.approach.z,id));
      ray.set(new T.Vector3(seat.x,2,seat.z),new T.Vector3(0,-1,0));
      const hit=ray.intersectObject(root,true)[0];assert.ok(hit);
      assert.ok(Math.abs(hit.point.y-(map.floor+seat.rise))<.003,'真实椅面高度匹配动画坐姿');
    }
    for(const s of map.spots.filter(s=>s.seat)){
      assert.deepEqual(s.target,s.seat.approach);
      assert.ok(Object.values(map.seats).includes(s.seat));
    }
  });
}

test('实验室专业器材可整组替换，关闭器材仍保留工位与导航',()=>{
  const full=DAY_FACTORIES.dayLaboratory(),empty=DAY_FACTORIES.dayLaboratory({equipment:'none'});
  const props=full.root.getObjectByName('LaboratoryEquipment'),blank=empty.root.getObjectByName('LaboratoryEquipment');
  assert.ok(props&&blank);assert.ok(props.children.length);assert.equal(blank.children.length,0);
  assert.deepEqual(full.root.userData.furniture,empty.root.userData.furniture);
  assert.equal(full.root.getObjectByName('computer-desk').position.x,empty.root.getObjectByName('computer-desk').position.x);
  const parent=props.parent;parent.remove(props);assert.equal(full.root.getObjectByName('LaboratoryEquipment'),undefined);
  parent.add(blank);assert.equal(full.root.getObjectByName('LaboratoryEquipment'),blank);
});

test('图书馆书本按实际书架与借阅台的父级摆放，局部坐标不误落在房中央',()=>{
  const {root}=DAY_FACTORIES.dayLibrary();root.updateMatrixWorld(true);
  for(const id of ['literature-shelf','reference-shelf']){
    const shelf=root.getObjectByName(id),books=[];
    shelf.traverse(o=>{if(o.name.startsWith(id+'-book-')||o.name.startsWith(id+'-flat-book-'))books.push(o);});
    assert.ok(books.length>=48,'四层书本确实位于书架组下');
    for(const book of books){
      assert.equal(book.parent,shelf);
      const point=book.getWorldPosition(new T.Vector3());
      assert.ok(Math.abs(point.x-shelf.position.x)<1.3);
      assert.ok(Math.abs(point.z-shelf.position.z)<.3);
      assert.ok(point.y>.3&&point.y<2.3);
    }
  }
  for(let n=0;n<3;n++){
    const book=root.getObjectByName('ReturnedBook-'+n),counter=root.getObjectByName('loan-counter');
    assert.equal(book.parent,counter);const p=book.getWorldPosition(new T.Vector3());
    assert.ok(p.x>counter.position.x&&p.x<counter.position.x+1);
    assert.ok(Math.abs(p.z-counter.position.z)<.5);assert.ok(p.y>.9&&p.y<1.4);
  }
  const deskBook=root.getObjectByName('ReadingBook'),windowBook=root.getObjectByName('WindowBook');
  assert.ok(Math.abs(deskBook.position.x+.85)<1.5&&Math.abs(deskBook.position.z-.05)<.675);
  assert.ok(Math.abs(windowBook.position.x-3.02)<.925&&Math.abs(windowBook.position.z+2.47)<.41);
});
