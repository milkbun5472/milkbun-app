import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const T=await import('three');
const {DAY_PLACES,DAY_FACTORIES}=await import('./places/index.mjs');
const {PLACE_MODULES,placeModules,createPlaceModules}=await import('./places/modules.mjs');
const {PROFESSIONAL_OPTIONS,professionalOptions}=await import('./professional.mjs');
const {environmentAt,weatherKind}=await import('./environment.mjs');
const {QUALITY_LEVELS,qualityFor,createQualityMonitor}=await import('./quality.mjs');
const {disposeMap,createMapLoader}=await import('../map-loader.mjs');

test('只请求选中的职业场景，同一请求合并、失败后可以重试',async()=>{
 let calls=0;const loader=createPlaceModules(async url=>{calls++;assert.match(url,/legal\.mjs/);return {ok:true};});
 const [a,b]=await Promise.all([loader.load('dayLegal'),loader.load('dayLegal')]);assert.strictEqual(a,b);assert.equal(calls,1);
 let tries=0;const retry=createPlaceModules(async()=>{if(++tries===1)throw Error('offline');return 'ready';});
 await assert.rejects(retry.load('dayWorkshop'),/offline/);assert.equal(await retry.load('dayWorkshop'),'ready');assert.equal(tries,2);
});
test('生成的轻量地图沿真实建造方，座位引用和全部活动锚点保留',async()=>{
 for(const [id,p]of Object.entries(PLACE_MODULES)){const actual=(await placeModules.load(id))[p.map];assert.deepEqual(DAY_PLACES[id],actual,id);for(const spot of DAY_PLACES[id].spots)if(spot.seat)assert.ok(Object.values(DAY_PLACES[id].seats).includes(spot.seat),id);}
});
test('全部职业场景都能选配色，明确手选优先并保留旧器材选择',()=>{
 assert.equal(Object.keys(PROFESSIONAL_OPTIONS).length,Object.keys(DAY_PLACES).length);
 const raw={dayLaboratory:{equipment:'none',style:'original'},dayWorkshop:{display:'repair',style:'clean'}};
 assert.deepEqual(professionalOptions(raw,'dayLaboratory','喜欢暖木，做显微细胞研究'),{equipment:'none'});
 assert.deepEqual(professionalOptions(raw,'dayWorkshop','喜欢复古深木，是木工'),{display:'repair',style:'clean'});
 assert.deepEqual(professionalOptions({},'dayWorkshop','偏好暖木，木作手艺人'),{display:'woodwork',style:'warm'});
 assert.deepEqual(professionalOptions({},'dayWorkshop','不是木工，不喜欢深木'),{display:'repair'});
});
test('异步建造改变真实材料和实物，保留工具接触工位与通道',async()=>{
 for(const id of Object.keys(DAY_PLACES)){
  const option=PROFESSIONAL_OPTIONS[id],values=Object.keys(option.values),original=await DAY_FACTORIES[id](professionalOptions({},id));
  const raw={[id]:{[option.field]:values.at(-1),style:'ink'}},changed=await DAY_FACTORIES[id](professionalOptions(raw,id));
  const colors=root=>{const v=[];root.traverse(o=>{if(o.material?.color&&!o.material.map)v.push(o.material.color.getHex());});return v;};
  assert.notDeepEqual(colors(original.root),colors(changed.root),id);
  if(option.field==='display')assert.equal(changed.root.userData.professionalDecor?.choice,values.at(-1),id);
  for(const p of DAY_PLACES[id].furniture)if(original.root.getObjectByName(p.id))assert.ok(changed.root.getObjectByName(p.id),id+':'+p.id);
  disposeMap(original.root);disposeMap(changed.root);
 }
});
test('晨昏平滑过渡，未知天气不冒充晴雨、当天降雨预测不冒充现在',()=>{
 for(const m of [299,300,301,360,420,1049,1050,1051,1200,1230]){const a=environmentAt(m),b=environmentAt(m+.1);assert.ok(Math.abs(a.sun-b.sun)<.01);}
 assert.equal(environmentAt(720).kind,'unknown');assert.equal(environmentAt(720,{source:'real',code:null}).known,false);
 assert.equal(environmentAt(720,{source:'real',code:0,dayCode:65}).kind,'clear');assert.equal(environmentAt(720,{source:'real',code:63}).wet,true);
 assert.equal(environmentAt(0).night,true);assert.equal(environmentAt(720).night,false);assert.equal(weatherKind(85),'snow');
});
test('场景复杂度与持续掉帧降低渲染成本，恢复有迟滞、不删家具',()=>{
 assert.equal(qualityFor({triangles:10000,meshes:50}),'high');assert.equal(qualityFor({furniture:60}),'balanced');assert.equal(qualityFor({triangles:700000}),'light');
 const monitor=createQualityMonitor();monitor.reset({triangles:10000});for(let i=0;i<110;i++)monitor.observe(.04);assert.equal(monitor.inspect().level,'balanced');
 for(let i=0;i<200;i++)monitor.observe(.016);assert.equal(monitor.inspect().level,'balanced');for(let i=0;i<850;i++)monitor.observe(.016);assert.equal(monitor.inspect().level,'high');
 assert.ok(QUALITY_LEVELS.light.shadow<QUALITY_LEVELS.high.shadow);assert.ok(QUALITY_LEVELS.light.particles<QUALITY_LEVELS.high.particles);
});
test('切换与关闭时尚未到达的异步场景也释放，没有迟到的旧房驻留',async()=>{
 let resolve;const disposed=[],attached=[];
 const root=id=>{const g=new T.Group();g.name=id;const geo=new T.BoxGeometry();geo.addEventListener('dispose',()=>disposed.push(id));g.add(new T.Mesh(geo,new T.MeshStandardMaterial()));return g;};
 const loader=createMapLoader({maps:{a:{renderer:'a'},b:{renderer:'b'}},loadAsset:()=>{},factories:{a:()=>new Promise(r=>{resolve=()=>r({root:root('a')});}),b:()=>({root:root('b')})},attach:g=>attached.push(g.name),detach:g=>{}});
 const old=loader.ensure('a');await Promise.resolve();await loader.ensure('b');loader.keep('b');resolve();await old;
 assert.deepEqual(Object.keys(loader.views),['b']);assert.deepEqual(attached,['b']);assert.ok(disposed.includes('a'));loader.close();assert.ok(disposed.includes('b'));assert.deepEqual(Object.keys(loader.views),[]);
});

test('同地点加载期间连续手选，迟到的旧陈设不能盖掉最后选择',async()=>{
 let complete,version=1;const attached=[];
 const makeRoot=n=>{const g=new T.Group();g.name='room-'+n;g.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));return g;};
 const loader=createMapLoader({maps:{a:{renderer:'a'}},loadAsset:()=>{},factories:{a:()=>{const n=version;return n===1?new Promise(r=>{complete=()=>r({root:makeRoot(n),version:n});}):{root:makeRoot(n),version:n};}},attach:g=>attached.push(g.name),detach:()=>{}});
 const first=loader.ensure('a');await Promise.resolve();loader.keep(null);version=2;const last=loader.ensure('a');complete();assert.equal((await first).stale,true);assert.equal((await last).version,2);assert.deepEqual(attached,['room-2']);loader.close();
});
