import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{MAPS,segmentClear}=await import('../world.mjs'),{buildSpace}=await import('./spaces.mjs');
const {chorePlans,CHORES,choreIntent}=await import('./chores.mjs'),{createChoreVisual}=await import('./chore-visual.mjs'),{createSceneVisit}=await import('./visit.mjs');
const {createAutoInteraction,canTravelTogether}=await import('./social-flow.mjs'),{createDateTransfer}=await import('./date-transfer.mjs');
const {pairProfile,motionProfile,pairProgress}=await import('./motion-profile.mjs'),{createTogether}=await import('./together.mjs');
const actor=()=>{const root=new T.Group();for(const n of ['Right_hand','Left_hand','HeadAnchor']){const q=new T.Group();q.name=n;q.position.y=1;root.add(q);}return {root,animate(t,p){root.position.y=p.height;this.pose=p;},contactPose(p){this.contact=p;}};};
test('自动小互动只在空闲自动模式发生，手动接管无限等待仍不重启',()=>{
 const flow=createAutoInteraction(),visitor={control:'auto',present:true,busy:false},started=[];
 const state={enabled:true,eligible:true,visitor,ready:true,actions:['look','cup','closer'].map(kind=>({kind})),start:kind=>{started.push(kind);return {ok:true};}};
 assert.equal(flow.tick(18,state),true);assert.deepEqual(started,['look']);
 visitor.control='manual';flow.tick(999,state);assert.equal(started.length,1);visitor.control='auto';flow.tick(17,state);assert.equal(started.length,1);flow.tick(1,state);assert.equal(started[1],'cup');
 state.eligible=false;flow.tick(999,state);assert.equal(started.length,2);state.eligible=true;visitor.busy=true;flow.tick(999,state);assert.equal(started.length,2);
});
test('一起转场只沿同角色的真实生活地点；工作、预览、主动离开与在家缺席都撤销同行',()=>{
 const before={charId:'a',presentation:{map:'dayCafe'},slot:{type:'coffee'}};
 const after={charId:'a',presentation:{map:'dayStreet'},slot:{type:'out'}};
 const visitor={present:true};assert.ok(canTravelTogether(before,after,visitor,globalThis.CharDaySocial));
 for(const patch of [{charId:'b'},{preview:true},{slot:{type:'work'}},{socialPreferences:{followDates:false}},{presentation:{map:'dayHome'},visitorData:{homePresence:'away'}}])assert.equal(canTravelTogether(before,{...after,...patch},visitor,globalThis.CharDaySocial),false);
 assert.equal(canTravelTogether(before,after,{present:true,leaving:true},globalThis.CharDaySocial),false);
});
test('两人实际走到不同出口空位才切图，取消保留半路位置且不完成转场',()=>{
 MAPS.dayHome=buildSpace('dayHome');const origin={a:{x:0,z:3.3},b:{x:1.4,z:3.3}},a=actor(),b=actor();let done=null,cancelled=null;
 const flow=createDateTransfer({a,b,map:()=>MAPS.dayHome,from:()=>origin,onDone:i=>done=i,onCancel:i=>cancelled=i});
 assert.ok(flow.start('dayCafe',{control:'manual',manualAction:'read'}));flow.tick(.1,0);flow.cancel();assert.ok(cancelled);assert.equal(done,null);assert.ok(cancelled.a.x!==MAPS.dayHome.spawn.x||cancelled.a.z!==MAPS.dayHome.spawn.z);
 assert.ok(flow.start('dayCafe',{control:'manual',manualAction:'read'}));for(let i=0;i<2000&&flow.inspect();i++)flow.tick(.02,i*.02);assert.equal(done.destination,'dayCafe');assert.equal(done.choice.manualAction,'read');assert.ok(Math.hypot(done.a.x-done.b.x,done.a.z-done.b.z)>=1);
});
test('四种家务都寻实际家具；转动挪位改变接触面，收纳后不编造位置',()=>{
 const from={x:0,z:3.3},other={x:0,z:4.8};
 for(const kind of Object.keys(CHORES)){
  MAPS.dayHome=buildSpace('dayHome');const plan=chorePlans(MAPS.dayHome,kind,from,other)[0];assert.ok(plan,kind);
  let at=from;for(const next of plan.route){assert.ok(segmentClear(at,next,'dayHome'));at=next;}
  const id=plan.piece,piece=MAPS.dayHome.furniture.find(p=>p.id===id);MAPS.dayHome=buildSpace('dayHome',{[id]:{x:piece.x-.35,z:piece.z+.3,heading:Math.PI/2}});const moved=chorePlans(MAPS.dayHome,kind,from,other)[0];assert.ok(moved);assert.notDeepEqual(moved.target,plan.target);
  MAPS.dayHome=buildSpace('dayHome',{[id]:{stored:true}});assert.ok(chorePlans(MAPS.dayHome,kind,from,other).every(p=>p.piece!==id));const stored=Object.fromEntries(MAPS.dayHome.furniture.filter(p=>p.kind===CHORES[kind].kind).map(p=>[p.id,{stored:true}]));MAPS.dayHome=buildSpace('dayHome',{...stored,[id]:{stored:true}});assert.equal(chorePlans(MAPS.dayHome,kind,from,other).length,0,kind);
 }
});
test('家务到位才显示，完成或新命令清掉道具，互动后自动选择保持自动',()=>{
 MAPS.dayHome=buildSpace('dayHome');const avatar=actor(),visual=createChoreVisual(avatar),visit=createSceneVisit({avatar,choreVisual:visual,map:()=>MAPS.dayHome,ta:()=>({x:0,z:3.3})});
 assert.ok(visit.join());assert.ok(visit.act('wipe-table'));assert.equal(avatar.root.getObjectByName('FurnitureChore').visible,false);
 for(let i=0;i<1500&&visit.inspect().busy;i++)visit.tick(.02,i*.02);visit.tick(.1,31);assert.equal(avatar.root.getObjectByName('FurnitureChore').visible,true);assert.equal(visit.inspect().chore.kind,'wipe-table');
 visit.act('manual');assert.equal(avatar.root.getObjectByName('FurnitureChore').visible,false);
 visit.act('auto');visit.control({automatic:true,b:visit.inspect().position,kind:'look',phase:'active',label:'看看彼此'});assert.equal(visit.inspect().control,'auto');visit.release({b:visit.inspect().position});assert.equal(visit.inspect().control,'auto');
});
test('每人独立双人演法；手动无条件优先，害羞先看后伸手、主动先接触、黏人靠得更久',()=>{
 const base=motionProfile({id:'a',persona:'安静内敛'}),shy=pairProfile(base,'害羞'),active=pairProfile(base,'害羞','active'),clingy=pairProfile(base,'黏人');
 assert.equal(shy.style,'shy');assert.equal(active.source,'chosen');assert.ok(pairProgress(1,active)>pairProgress(1,shy));assert.ok(clingy.lean>active.lean);
 MAPS.dayHome=buildSpace('dayHome');const a=actor(),b=actor(),pair=createTogether({a,b,pair:()=>({a:shy,b:active}),map:()=>MAPS.dayHome,from:()=>({a:{x:0,z:3.3},b:{x:0,z:4.8}})});
 assert.ok(pair.start('hand').ok);for(let i=0;i<2000&&pair.inspect().phase!=='active';i++)pair.tick(.02,i*.02);pair.tick(.5,50);assert.notDeepEqual(a.contact.right,b.contact.left);assert.equal(pair.inspect().styles.a.style,'shy');assert.equal(pair.inspect().styles.b.style,'active');pair.stop();
});

test('家务沿当前实际日程，临时改变不沿用原家务',()=>{assert.equal(choreIntent({title:'回家洗碗'}),'wash-dishes');assert.equal(choreIntent({title:'回家洗碗',deviation:{actual:'去街边散步'}}),null);assert.equal(choreIntent({title:'在家整理床铺'}),'tidy-bed');assert.equal(choreIntent({title:'给植物浇水'}),'water-plant');assert.equal(choreIntent({title:'擦桌子'}),'wipe-table');assert.equal(pairProfile(null,'不黏人，也不害羞').style,'gentle');});
