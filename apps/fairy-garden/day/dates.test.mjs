import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{MAPS,segmentClear}=await import('../world.mjs'),{registerCoreSpaces}=await import('./spaces.mjs'),{registerDayPlaces}=await import('./places/index.mjs'),{createTogether}=await import('./together.mjs'),{createSceneVisit}=await import('./visit.mjs');
registerCoreSpaces(MAPS);registerDayPlaces(MAPS);
const S=globalThis.CharDaySocial;
const actor=()=>{const root=new T.Group();for(const name of ['Right_hand','Left_hand','HeadAnchor']){const n=new T.Group();n.name=name;n.position.y=1;root.add(n);}return {root,animate(t,p){this.pose=p;root.position.y=p.height;},contactPose(p){this.contact=p;}};};
test('七个生活地点共用一份动作规则，外出手选且工作/预览不加入，临时改变沿实际安排',()=>{
 for(const map of Object.keys(S.scenes)){
  const snap={presentation:{map},slot:{type:'social',title:'一起过一会儿'}};
  assert.ok(S.setting(snap));assert.equal(!!S.setting(snap).home,map==='dayHome');
  for(const mode of ['editing','showcase','preview'])assert.equal(S.setting({...snap,[mode]:true}),null);
  if(map!=='dayHome')assert.equal(S.setting({...snap,slot:{type:'work',title:'正在工作'}}),null);
 }
 for(const map of ['dayWork','dayClinic','dayLaboratory','dayStudio','dayRehearsal'])assert.equal(S.setting({presentation:{map}}),null);
 assert.equal(S.setting({presentation:{map:'dayMarket',spot:'cashier'}}),null);
 assert.ok(S.setting({presentation:{map:'dayCafe'},slot:{type:'work',title:'上班',deviation:{actual:'和她喝咖啡',type:'social'}}}));
});
test('每个约会动作沿实际地点寻路和椅面，两个人到位后才开始，取消交还当前位置',()=>{
 for(const [id,scene]of Object.entries(S.scenes))for(const kind of scene.actions){
  const map=MAPS[id],a=actor(),b=actor(),from={a:{x:map.spawn.x,z:map.spawn.z-1.4},b:{...map.spawn}};let released;
  const c=createTogether({a,b,map:()=>map,from:()=>from,onStop:s=>released=s});assert.equal(c.start(kind).ok,true,id+':'+kind);
  for(let i=0;i<3500&&c.inspect()?.phase!=='active';i++)c.tick(.02,i*.02);
  assert.equal(c.inspect()?.phase,'active',id+':'+kind);c.tick(.02,80);
  const q=c.inspect(),aa=q.seats?.a||q.a,bb=q.seats?.b||q.b;assert.ok(Math.hypot(aa.x-bb.x,aa.z-bb.z)>=(kind==='hug'?.32:.75));
  if(q.seats)for(const s of Object.values(q.seats)){assert.ok(map.furniture.some(p=>p.id===s.piece));assert.equal(s.rise,.45);}
  if(['read','meal','drink'].includes(kind)){assert.ok(a.pose.task?.daily&&b.pose.task?.daily);}
  if(kind==='stretch'){assert.equal(a.pose.gesture,'stretch');assert.equal(b.pose.gesture,'stretch');}
  if(kind==='browse'){assert.ok(a.contact.right&&b.contact.left);}
  if(kind==='walk'){let previous=q,travel=0;for(let i=0;i<900;i++){c.tick(.02,80+i*.02);const next=c.inspect();assert.ok(next);for(const who of ['a','b']){assert.ok(segmentClear(previous[who],next[who],id));travel+=Math.hypot(previous[who].x-next[who].x,previous[who].z-next[who].z);}assert.ok(Math.hypot(next.a.x-next.b.x,next.a.z-next.b.z)>.72);previous=next;}assert.ok(travel>4);}
  assert.equal(c.stop(),true);assert.ok(released);assert.equal(c.inspect(),null);
 }
});
test('取消半途坐下不把第二个人瞬移到目标椅面；访客在外也沿原控制和真实路线',()=>{
 const map=MAPS.dayCafe,c=createTogether({a:actor(),b:actor(),map:()=>map,from:()=>({a:{x:0,z:3},b:map.spawn}),onStop:s=>{assert.equal(s.seats.b,null);}});c.start('drink');c.tick(.02,0);c.stop();
 for(const id of Object.keys(S.scenes)){
  const map=MAPS[id],host={x:map.spawn.x,z:map.spawn.z-2},v=createSceneVisit({avatar:actor(),ta:()=>host,map:()=>map,choice:'manual'});assert.equal(v.join({automatic:id==='dayHome'}),true);assert.equal(v.inspect().map,id);assert.equal(v.inspect().control,'manual');assert.equal(v.act('near'),true);
  for(let i=0;i<1200&&v.inspect().busy;i++)v.tick(.02,i*.02);assert.equal(v.inspect().busy,false);assert.equal(v.act('leave'),true);for(let i=0;i<2000&&v.inspect().present;i++)v.tick(.02,i*.02);assert.equal(v.inspect().present,false);
 }
});
