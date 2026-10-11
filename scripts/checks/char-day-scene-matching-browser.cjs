// The actual App reads the reported natural-language plans through its original writer.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=process.env.DAY_ENGINE||'webkit',base=process.env.DAY_URL||'http://127.0.0.1:18985',out=process.env.DAY_EVIDENCE||'/tmp/char-day-scene-matching';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1000,height:800}}),errors=[];try{
 p.setDefaultTimeout(45000);p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base+'/apps/companion/');
 const report={};
 const app=fs.readFileSync(path.join(process.cwd(),'js/app.js'),'utf8'),a=app.indexOf('  const saveSchedDay ='),z=app.indexOf('  const applySchedChange =',a);assert.ok(a>0&&z>a);
 const cases=[
 ['在医学院附属图书馆安静阅读神经解剖外科学专著','医学院附属图书馆二楼自习区','dayLibrary','desk-reading','read','work',{scene:'dayWork',spot:'work'}],
 ['陪Lisa逛复古市集挑选旧布料杂货与古董小件','城中复古跳蚤市集','dayFleaMarket','fabric','market-pick','out',{scene:'dayStreet',spot:'walk'}],
 ['在星露谷小窝农场整理作物与钓鱼记录','秋声农场码头','dayFarm','records','write','work',{scene:'dayWork',spot:'work'}],
 ['在集市旁的面包房买肉桂卷并与热红茶歇脚','红河岸边法式烘焙店','dayCafe','tea','drink','coffee',{scene:'dayHome',spot:'tea'}],
 ['挑选古董杂货','旧货市场','dayFleaMarket','antiques','market-pick','out',null],
 ['整理作物和钓鱼笔记','田间小农场','dayFarm','records','write','work',null],
 ['整理观察笔记','实验室','dayLaboratory','records','write','work',null],
 ['实验间隙坐着歇一会儿','实验室','dayLaboratory','break',null,'work',{scene:'dayLaboratory',spot:'break'}]
 ];
 await p.setViewportSize({width:390,height:844});await p.unroute('**/pet.mjs*');await p.clock.setFixedTime(new Date('2026-10-09T00:04:00Z'));await p.goto(base);await p.waitForFunction(()=>window.CharDayLink&&typeof txtVaultState==='function'&&txtVaultState().ok);
 await p.evaluate(async({writer,cases})=>{
  const chars=[{id:'occupation-a',name:'场景匹配测试角色',gender:'male',tz:'0',persona:'虚构角色，按当天的具体安排做事。'}];let plans={};const ref={current:plans},save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,saveJSON);
  const timeAt=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  save(chars[0].id,'2026-10-09',{seqs:cases.map(([title,location,,,,type,world],index)=>({time:timeAt(index*30),end:timeAt((index+1)*30),title,location,type,world}))});
  const features=Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(id=>[id,{global:false,chars:{}}]));
  for(const [k,v]of Object.entries({x_characters:chars,x_schedules:ref.current,x_homeLayout:{'0':['fairyGarden']},x_homeFolders:[],x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features},x_companion:{charId:chars[0].id,autoFace:true,float:false,looks:{[chars[0].id]:{outfit:'academy',hair:'korean'}}}}))await saveJSONDurable(k,v);
 },{writer:app.slice(a,z),cases});
 await p.reload();await p.locator('#qiu-splash button').click();await p.locator('#qiu-splash').waitFor({state:'hidden'});await p.evaluate(()=>{window.sceneModels=0;window.callAI=()=>{sceneModels++;throw Error('Unexpected AI');};window.sceneWrites=[];const original=saveJSON;window.saveJSON=(k,...args)=>{sceneWrites.push(k);return original(k,...args);};});
 await p.locator('[data-appkey=fairyGarden]').click();await p.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();await p.locator('[data-wk=cdaypick]').filter({hasText:'场景匹配测试角色'}).click();await p.waitForFunction(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect().ready);
 const frame=p.frames().find(f=>f.url().includes('/fairy-garden/day/')),before=await p.evaluate(()=>JSON.stringify(loadJSON('x_schedules',{})));report.schedules=[];
 for(const [hour,[title,location,map,spot,kind]]of cases.entries()){
  const now=new Date('2026-10-09T00:00:00Z');now.setUTCMinutes(hour*30+4);await p.clock.setFixedTime(now);
  await p.waitForFunction(({title,location})=>{const text=document.querySelector('[data-wk=cdaynow]')?.textContent||'';return text.includes(title)&&text.includes(location);},{title,location});
  await frame.waitForFunction(({map,spot,kind})=>{const s=CharDayScene.inspect();return s.map===map&&!s.changing&&!s.route.length&&(!spot||s.activity?.spot===spot)&&(!kind||s.workAction?.kind===kind);},{map,spot,kind});
  if(kind==='write')await frame.waitForFunction(()=>CharDayScene.inspect().workAction?.pen);
  if(kind==='market-pick')await frame.waitForFunction(()=>CharDayScene.inspect().workAction?.product);
  // Allow the physical seat transition to settle before capturing the actual pose.
  await p.waitForTimeout(1200);
  const state=await frame.evaluate(()=>CharDayScene.inspect());assert.match(await p.locator('[data-wk=cdaynow]').innerText(),new RegExp(title));assert.match(await p.locator('[data-wk=cdaynow]').innerText(),new RegExp(location));
  await p.screenshot({path:path.join(out,'schedule-'+hour+'-'+map+'.png')});if(map==='dayFleaMarket')assert.equal(state.workAction.productKind,spot==='fabric'?'fabric':'antique');if(map==='dayFarm'||map==='dayLaboratory')assert.equal(state.seat.pose,'deep');assert.equal(state.markersVisible,false);report.schedules.push({hour,title,location,map,spot,kind,actual:state.activity,workAction:state.workAction,dailyAction:state.dailyAction,sceneAction:state.sceneAction});
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_schedules',{}))),before);assert.equal(await p.evaluate(()=>sceneModels),0);assert.deepEqual(await p.evaluate(()=>sceneWrites.filter(k=>/^x_(?:schedules|chat(?::|$)|fairyGardenSaves)/.test(k))),[]);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,errors,...report},null,2));console.log(JSON.stringify({ok:true,engine,schedules:report.schedules.length}));
 }catch(e){await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,state:await p.evaluate(()=>document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect()).catch(()=>null)},null,2));throw e;}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
