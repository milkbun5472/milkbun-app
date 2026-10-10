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
const {createRoomKit,roomStructure,roomObstacles,roomSeat}=await import('./room-kit.mjs');
const T=await import('three');
const persistentMaps=Object.keys(MAPS);
registerDayPlaces(MAPS);

test('公共空房的真实墙柱与碰撞结构一致，座位拒绝无实体椅子的绑定',()=>{
  const size={w:11.2,d:8.4},kit=createRoomKit();kit.room(size);kit.root.updateMatrixWorld(true);
  const structure=roomStructure(size);
  for(const piece of structure){
    const mesh=kit.root.getObjectByName(piece.id);assert.ok(mesh,piece.id+'实际建造');
    const box=new T.Box3().setFromObject(mesh),center=box.getCenter(new T.Vector3()),extent=box.getSize(new T.Vector3());
    assert.ok(Math.abs(center.x-piece.x)<1e-6&&Math.abs(center.z-piece.z)<1e-6);
    assert.ok(Math.abs(extent.x-piece.w)<1e-6&&Math.abs(extent.z-piece.d)<1e-6);
  }
  assert.deepEqual(roomObstacles([],size),structure);
  const chairs=[{id:'valid-chair',kind:'chair',x:1,z:2,w:.56,d:.57}];
  const seat=roomSeat(chairs,'valid-chair',{x:2,z:2});assert.equal(seat.rise,.45);assert.equal(seat.heading,0);
  assert.throws(()=>roomSeat(chairs,'missing',{}),/constructed chair/);
});

test('多组可替换摆件合批后保留各自父级与世界位置，可独立移除而不带走另一组',()=>{
  const kit=createRoomKit();kit.root.position.set(.7,.2,-.5);
  const fixture=kit.group('RotatedFixture',{x:2.1,y:.08,z:-1.7,heading:.7});
  const first=kit.replaceableGroup('TestPropsA',{x:.65,y:.85,z:-.1,heading:.25},fixture);
  const second=kit.replaceableGroup('TestPropsB',{x:-.6,y:.85,z:.2,heading:-.4},fixture);
  const direct=kit.replaceableGroup('TestPropsRoot',{x:-2.2,y:.6,z:2.7,heading:.3});
  kit.box('FirstProp',{y:.12,w:.2,h:.24,d:.2,color:'#aabb99'},first);
  kit.box('SecondProp',{y:.17,w:.3,h:.34,d:.2,color:'#aabb99'},second);
  kit.box('DirectRootProp',{y:.1,w:.2,h:.2,d:.2,color:'#aabb99'},direct);
  kit.box('FixedFurniture',{y:.4,w:.5,h:.8,d:.5,color:'#aabb99'});
  kit.root.updateMatrixWorld(true);
  const groups=[first,second,direct],expected=groups.map(g=>new T.Box3().setFromObject(g));kit.finish();kit.root.updateMatrixWorld(true);
  for(const [i,group]of groups.entries()){
    assert.equal(group.userData.replaceable,true);assert.equal(group.parent,group===direct?kit.root:fixture);
    assert.ok(group.children.some(o=>o.isMesh));
    const actual=new T.Box3().setFromObject(group);
    assert.ok(actual.min.distanceTo(expected[i].min)<1e-6&&actual.max.distanceTo(expected[i].max)<1e-6,'合批保持完整父级变换');
  }
  fixture.remove(first);assert.equal(kit.root.getObjectByName('TestPropsA'),undefined);
  assert.equal(kit.root.getObjectByName('TestPropsB'),second);assert.ok(kit.root.children.some(o=>o.isMesh));
});

test('独立场景注册保留原地图，展示名单按真实动作点编号',()=>{
  assert.deepEqual(new Set(Object.keys(DAY_PLACES)),new Set(['dayLaboratory','dayLibrary','dayClinic','dayStudio','dayRehearsal','dayStation']));
  assert.deepEqual(Object.keys(DAY_FACTORIES),Object.keys(DAY_PLACES));
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
        assert.ok(walkable(position.x,position.z,id),`${a.id} → ${b.id}第${frames}帧落脚${JSON.stringify(position)}`);
        assert.ok(segmentClear(prev,position,id),`${a.id} → ${b.id}第${frames}帧${JSON.stringify(prev)} → ${JSON.stringify(position)}实际角切`);
      }
      assert.equal(pending.length,0,`${a.id} → ${b.id}抵达`);
      assert.ok(Math.hypot(position.x-b.target.x,position.z-b.target.z)<.01);
    }
  });

  test(map.label+'：家具实际中心与障碍一致，坐位落在真椅子上，桌椅高度沿原小人',()=>{
    const {root}=DAY_FACTORIES[id]();root.updateMatrixWorld(true);
    const furniture=root.userData.furniture;
    assert.ok(furniture?.length,'家具元数据来自真正建造的那张表');
    for(const structure of roomStructure(map.bounds))assert.deepEqual(map.obstacles.find(o=>o.id===structure.id),structure,'墙柱沿实际空房尺寸');
    for(const p of furniture){
      const obstacle=map.obstacles.find(o=>o.id===p.id);assert.ok(obstacle,p.id+'有碰撞');
      for(const k of ['x','z','w','d'])assert.equal(obstacle[k],p[k],p.id+'的'+k);
      assert.equal(walkable(p.x,p.z,id),false,p.id+'实体不允许穿过');
      if(['chair','bench','table','counter','cabinet','shelf','examBed','step','easel'].includes(p.kind)){
        const group=root.getObjectByName(p.id);assert.ok(group,p.id+'真家具组仍在');
        assert.equal(group.position.x,p.x);assert.equal(group.position.z,p.z);
      }
      if(['table','counter'].includes(p.kind))assert.ok(p.top>=.45&&p.top<=1.05,p.id+'台面高度适合现有体型');
    }
    const ray=new T.Raycaster();
    for(const seat of Object.values(map.seats)){
      const p=furniture.find(p=>p.id===seat.piece);assert.ok(['chair','bench'].includes(p?.kind));
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
  assert.equal(props.userData.replaceable,true,'可替换器材沿公共分组机制');
  const vertices=root=>{let count=0;root.traverse(o=>{if(o.isMesh)count+=o.geometry.attributes.position.count;});return count;};
  const specializedVertices=vertices(props);assert.ok(specializedVertices>0,'组内确有合批后的器材网格，不能只保空锚点');
  assert.deepEqual(full.root.userData.furniture,empty.root.userData.furniture);
  assert.equal(full.root.getObjectByName('computer-desk').position.x,empty.root.getObjectByName('computer-desk').position.x);
  full.root.updateMatrixWorld(true);const instrument=props.getObjectByName('Microscope');assert.ok(instrument);
  const point=instrument.getWorldPosition(new T.Vector3()),ray=new T.Raycaster(new T.Vector3(point.x,point.y+2,point.z),new T.Vector3(0,-1,0));
  const before=ray.intersectObject(full.root,true)[0];assert.ok(before);
  const countBefore=vertices(full.root);
  const parent=props.parent;parent.remove(props);assert.equal(full.root.getObjectByName('LaboratoryEquipment'),undefined);
  assert.equal(vertices(full.root),countBefore-specializedVertices,'移除器材确实带走对应几何');
  const after=ray.intersectObject(full.root,true)[0];assert.ok(after);assert.ok(before.point.y-after.point.y>.1,'显微镜实际射线命中随整组移除消失');
  parent.add(blank);assert.equal(full.root.getObjectByName('LaboratoryEquipment'),blank);
});

test('排练室保留开阔练习区，真实电钢琴/吉他和镜墙可分别关闭，桌椅及导航不变',()=>{
  const full=DAY_FACTORIES.dayRehearsal(),noInstruments=DAY_FACTORIES.dayRehearsal({instruments:false}),noMirror=DAY_FACTORIES.dayRehearsal({mirror:false});
  const vertices=o=>{let n=0;o.traverse(x=>{if(x.isMesh)n+=x.geometry.attributes.position.count;});return n;};
  assert.ok(vertices(full.root.getObjectByName('RehearsalInstruments'))>0);
  assert.equal(vertices(noInstruments.root.getObjectByName('RehearsalInstruments')),0);
  assert.ok(vertices(noInstruments.root.getObjectByName('RehearsalMirror'))>0);
  assert.equal(vertices(noMirror.root.getObjectByName('RehearsalMirror')),0);
  assert.ok(vertices(noMirror.root.getObjectByName('RehearsalInstruments'))>0);
  assert.ok(full.root.getObjectByName('ElectricPiano'));assert.ok(full.root.getObjectByName('AcousticGuitar'));
  for(const variant of [noInstruments,noMirror])assert.deepEqual(variant.root.userData.furniture,full.root.userData.furniture);
  const m=DAY_PLACES.dayRehearsal;
  for(let x=-3.2;x<=-.8;x+=.2)for(let z=-1.6;z<=2.4;z+=.2)assert.ok(walkable(x,z,'dayRehearsal'),'练习区无家具占位');
  assert.equal(m.spots.find(s=>s.id==='piano').gesture,'rest','未实现弹奏时保留中性坐姿');
  assert.equal(m.spots.find(s=>s.id==='practice').action,'practice','不把托腮等通用工作动作冒充舞蹈');
});

test('候车长椅真实宽面可坐，站台黄线内侧可达，轨道外侧无法行走且没有交通工具',()=>{
  const m=DAY_PLACES.dayStation,{root}=DAY_FACTORIES.dayStation();root.updateMatrixWorld(true);
  for(const seat of Object.values(m.seats)){
    const p=root.userData.furniture.find(p=>p.id===seat.piece);assert.equal(p.kind,'bench');assert.ok(p.w>3);
    for(const dx of [-1.2,0,1.2]){
      const ray=new T.Raycaster(new T.Vector3(seat.x+dx,2,seat.z),new T.Vector3(0,-1,0));
      assert.ok(Math.abs(ray.intersectObject(root,true)[0].point.y-(m.floor+seat.rise))<.003,'整条长椅实际椅面同高');
    }
  }
  const platform=m.spots.find(s=>s.id==='platform'),exit=m.spots.find(s=>s.id==='exit');
  assert.ok(walkable(platform.target.x,platform.target.z,'dayStation'));assert.ok(findPath(m.seats.waiting.approach,platform.target,'dayStation')?.length);
  assert.ok(findPath(platform.target,exit.target,'dayStation')?.length);assert.equal(walkable(5.55,.95,'dayStation'),false,'实际平台边缘阻挡');assert.equal(walkable(6.67,.95,'dayStation'),false,'短轨道在可走区域外');
  assert.ok(root.getObjectByName('StationClock'));assert.ok(root.getObjectByName('DepartureBoard'));assert.ok(root.getObjectByName('Luggage-0'));assert.ok(root.getObjectByName('platform-sign'));
  assert.equal(root.getObjectByName('Train'),undefined);assert.equal(root.getObjectByName('Bus'),undefined);
});

test('原小街长椅迁入公共构造后保留原实体尺寸、材质和坐面高度',async()=>{
  const {createSpaceView}=await import('../space-view.mjs'),{CORE_SPACES,styleOf}=await import('../spaces.mjs');
  const map=CORE_SPACES.dayStreet,p=map.furniture.find(p=>p.id==='street-bench'),palette=styleOf('warm'),{root}=createSpaceView('dayStreet');root.updateMatrixWorld(true);
  const bench=root.getObjectByName(p.id);assert.equal(bench.userData.furnitureId,p.id);assert.equal(bench.position.x,p.x);assert.equal(bench.position.z,p.z);
  const box=new T.Box3().setFromObject(bench),size=box.getSize(new T.Vector3());assert.ok(Math.abs(size.x-p.w)<.001);assert.ok(Math.abs(size.z-p.d)<.001);
  const ray=new T.Raycaster(new T.Vector3(p.x,2,p.z),new T.Vector3(0,-1,0));assert.ok(Math.abs(ray.intersectObject(bench,true)[0].point.y-.535)<.001);
  const colors=new Set();bench.traverse(o=>{if(o.isMesh)colors.add('#'+o.material.color.getHexString());});assert.deepEqual(colors,new Set([palette.wood,palette.dark]));
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

test('诊室保留真实诊查床与床旁站位，专业器材整组关闭而不变家具与坐位',()=>{
  const map=DAY_PLACES.dayClinic,full=DAY_FACTORIES.dayClinic(),empty=DAY_FACTORIES.dayClinic({equipment:'none'});
  assert.equal(map.beds,undefined,'空诊查床不作为日程睡床');
  const bed=full.root.userData.furniture.find(p=>p.kind==='examBed');assert.ok(bed);
  assert.equal(Object.values(map.seats).some(s=>s.piece===bed.id),false);
  const bedside=map.spots.find(s=>s.furniture===bed.id);assert.ok(bedside&&!bedside.seat&&bedside.action!=='sleep');
  assert.ok(walkable(bedside.target.x,bedside.target.z,'dayClinic'));
  full.root.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(bed.x,2,bed.z),new T.Vector3(0,-1,0));
  const hit=ray.intersectObject(full.root,true)[0];assert.ok(hit&&Math.abs(hit.point.y-(map.floor+bed.top))<.003,'实际诊查床面高度对齐家具表');
  const equipment=full.root.getObjectByName('ClinicEquipment'),blank=empty.root.getObjectByName('ClinicEquipment');
  assert.equal(equipment.userData.replaceable,true);let meshes=0;equipment.traverse(o=>{if(o.isMesh)meshes++;});assert.ok(meshes>0);
  assert.equal(blank.children.length,0);assert.deepEqual(full.root.userData.furniture,empty.root.userData.furniture);
  const parent=equipment.parent;parent.remove(equipment);assert.equal(full.root.getObjectByName('ClinicEquipment'),undefined);
  assert.ok(full.root.getObjectByName(bed.id));assert.ok(full.root.getObjectByName(Object.values(map.seats)[0].piece));
});

test('创作室颜料、布料与手工材料整组可换，实际台面和架上摆件保持父级高度与支持面',()=>{
  const variants=['paint','fabric','craft','none'],views=variants.map(materials=>DAY_FACTORIES.dayStudio({materials}));
  const empty=views.at(-1).root,counts=[];empty.updateMatrixWorld(true);
  const navigation=JSON.stringify(DAY_PLACES.dayStudio),furniture=empty.userData.furniture;
  for(const [index,{root}]of views.entries()){
    root.updateMatrixWorld(true);assert.deepEqual(root.userData.furniture,furniture);assert.equal(root.userData.materials,variants[index]);
    assert.equal(JSON.stringify(DAY_PLACES.dayStudio),navigation,'换材料不变动作点或导航');
    const props=root.getObjectByName('StudioMaterials');assert.equal(props.userData.replaceable,true);
    let vertices=0;props.traverse(o=>{if(o.isMesh)vertices+=o.geometry.attributes.position.count;});counts.push(vertices);
    if(variants[index]==='none'){assert.equal(vertices,0);assert.equal(props.children.length,0);continue;}
    assert.ok(vertices>0,'专业材料确有可拆卸网格');
    for(const anchor of root.userData.materialAnchors){
      const group=props.getObjectByName('StudioSurface:'+anchor.furniture),piece=furniture.find(p=>p.id===anchor.furniture);
      assert.ok(group&&piece);assert.equal(group.userData.furniture,piece.id);assert.equal(group.parent,props);
      const center=group.getWorldPosition(new T.Vector3());assert.equal(center.x,piece.x);assert.equal(center.z,piece.z);
      if(anchor.surface!=null){assert.equal(group.userData.surface,anchor.surface);assert.equal(center.y,anchor.surface);assert.equal(anchor.surface,DAY_PLACES.dayStudio.floor+piece.top);}
      const levels=anchor.surface!=null?[anchor.surface]:anchor.surfaces.slice(1);
      for(const surface of levels){
        let supported=0;const ray=new T.Raycaster();
        for(let x=0;x<=10;x++)for(let z=0;z<=10;z++){
          const px=anchor.x+(x/10-.5)*anchor.w*.9,pz=anchor.z+(z/10-.5)*anchor.d*.9;
          ray.set(new T.Vector3(px,surface+.49,pz),new T.Vector3(0,-1,0));ray.near=0;ray.far=.5;
          const hit=ray.intersectObject(props,true)[0];if(!hit||hit.point.y<=surface+.005)continue;
          // Start below the actual prop roof so an upper shelf cannot hide its support.
          const supportRay=new T.Raycaster(new T.Vector3(px,hit.point.y-.0001,pz),new T.Vector3(0,-1,0),0,hit.point.y-surface+.01);
          const base=supportRay.intersectObject(empty,true)[0];
          if(base&&Math.abs(base.point.y-surface)<.005)supported++;
        }
        assert.ok(supported>0,`${variants[index]}的${anchor.furniture}在实际${surface}台面上有材料`);
      }
    }
    const before=root.children.filter(o=>o.isMesh).length;props.parent.remove(props);assert.equal(root.getObjectByName('StudioMaterials'),undefined);
    assert.equal(root.children.filter(o=>o.isMesh).length,before,'取走材料保留独立家具合批');
  }
  assert.ok(new Set(counts.slice(0,-1)).size>1,'三种方向确实替换不同材料几何');
});
