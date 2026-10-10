const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const path = require('node:path'), base = path.join(__dirname,'..');
const read = f => fs.readFileSync(path.join(base,f),'utf8');
const app = read('js/app.js'), engine = read('js/engine.js');
const cut = (s,a,b) => {const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,'code anchors: '+a);return s.slice(i,j);};
function setup(at=Date.UTC(2026,9,1,12)) {
  let state={}, now=at;
  class ClockDate extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
  const env={Date:ClockDate,console,Promise,Map,Set,JSON,Math,loadJSON:(k,f)=>state[k]==null?f:JSON.parse(JSON.stringify(state[k])),saveJSON:(k,v)=>{state[k]=JSON.parse(JSON.stringify(v));}};
  env.window=env;vm.createContext(env);
  vm.runInContext(read('js/schedule-clock.js'),env);
  vm.runInContext(cut(read('js/screens.js'),'function schedFillEnds(', 'function schedSleepCarry('),env);
  vm.runInContext(read('js/radio-life.js'),env);
  // Fixture schedule is written through the actual saveSchedDay, not constructed by the reader.
  const save = new Function('setSchedules','schedulesRef','saveJSON',cut(app,'  const saveSchedDay =','  const applySchedChange =')+'return saveSchedDay;');
  let plans={};const ref={current:plans};
  const saveDay=save(fn=>{plans=fn(plans);},ref,env.saveJSON);
  const chars=[{id:'a',name:'甲',tz:'0'},{id:'b',name:'乙',tz:'0'},{id:'c',name:'丙',tz:'0'}];
  saveDay('a','2026-10-01',{generatedAt:now,seqs:[{seq:1,time:'09:00',end:'14:00',title:'核对装订稿',location:'工作室',type:'work',deviation:null},{seq:2,time:'14:00',end:'23:00',title:'出门送稿',location:'街上',type:'out',deviation:null},{seq:3,time:'23:00',end:'24:00',title:'睡觉',location:'家',type:'sleep',deviation:null}]});
  const scene=env.RadioLife.slot(chars[0],plans.a,now,0);
  const raw={title:'装订稿的争论',lines:[{speakerId:'a',speaker:'甲',text:'第二页的标注要改回去。'},{speakerId:'b',speaker:'乙',text:'好，我把最后一行一起校对。'},{speakerId:'a',speaker:'甲',text:'等核对完再装订。'}]};
  return {R:env.RadioLife,env,chars,scene,raw,plans:()=>plans,state:()=>state,now:t=>{now=t;}};
}
test('current scene uses actual schedule writer, character timezone, end, sleep and deviation',()=>{
  const f=setup(),{R,chars}=f;assert.equal(f.scene.title,'核对装订稿');assert.equal(f.scene.startAt,Date.UTC(2026,9,1,9));
  assert.equal(R.slot(chars[0],f.plans().a,Date.UTC(2026,9,1,14),0).title,'出门送稿');
  assert.equal(R.slot(chars[0],f.plans().a,Date.UTC(2026,9,1,23),0),null);
  assert.equal(R.slot(chars[0],{},Date.UTC(2026,9,1,12),0),null);
  const plan=JSON.parse(JSON.stringify(f.plans().a));plan['2026-10-01'].seqs[0].end='11:00';
  assert.equal(R.slot(chars[0],plan,Date.UTC(2026,9,1,12),0),null,'gap does not become a stale scene');
  assert.equal(R.slot({...chars[0],tz:'8'},f.plans().a,Date.UTC(2026,9,1,6),0).title,'出门送稿');
  plan['2026-10-01'].seqs[0].end='14:00';plan['2026-10-01'].seqs[0].deviation={reason:'临时改稿'};
  assert.notEqual(R.slot(chars[0],plan,Date.UTC(2026,9,1,12),0).key,f.scene.key);
});
test('connect is explicit, single flight, durable on return, sequential continuation without re-creation',async()=>{
  const f=setup(),{R,scene,chars,raw}=f;let calls=0,release;
  const gen=()=>{calls++;return new Promise(r=>release=r);};
  const a=R.connect(scene,chars,gen),b=R.connect(scene,chars,gen);assert.equal(calls,1);release(raw);
  const [e,z]=await Promise.all([a,b]);assert.equal(e.id,z.id);assert.equal(R.read().events.length,1);assert.equal(e.heard,0);
  assert.equal(R.contextFor('a'),'','unheard buffer is not an event yet');
  assert.equal((await R.connect(scene,chars,()=>{throw Error('must reuse');})).id,e.id);
  assert.throws(()=>R.reveal(e.id,2),/顺序/);R.reveal(e.id,0);
  assert.match(R.contextFor('a'),/第二页/);assert.doesNotMatch(R.contextFor('a'),/最后一行|等核对/);
  assert.equal((await R.connect(scene,chars,()=>{throw Error('unfinished');},true)).id,e.id);
  R.reveal(e.id,1);R.reveal(e.id,2);
  const next=await R.connect(scene,chars,async(s,old)=>{assert.equal(old.length,1);assert.match(R.lifePrompt(s,old),/等核对完/);calls++;return {...raw,lines:[{speakerId:'a',text:'校对结束了，我把这份稿子装订好。'}]};},true);
  assert.notEqual(next.id,e.id);assert.equal(next.ordinal,1);assert.equal(calls,2);
});
test('save has no listener notification; participant memory isolation and replay only include heard lines',async()=>{
  const f=setup(),{R,scene,chars,raw}=f;const e=await R.connect(scene,chars,async()=>raw);
  R.reveal(e.id,0);assert.match(R.contextFor('b'),/第二页/,'the actual other participant heard the first speaker');assert.equal(R.contextFor('c'),'');
  const before=R.contextFor('a');R.keep(e.id,true);assert.equal(R.contextFor('a'),before,'collection status must not enter character knowledge');
  R.reveal(e.id,1);assert.match(R.contextFor('b'),/第二页/);assert.equal(R.contextFor('c'),'');
  assert.doesNotMatch(R.contextFor('b'),/等核对完/);
  f.now(Date.UTC(2026,9,1,15));assert.match(R.contextFor('a'),/第二页/,'saved original persists beyond schedule');
  R.keep(e.id,false);assert.equal(R.contextFor('a'),'','unsaved slot expires from context');
  assert.equal(R.read().events[0].lines[0].text,raw.lines[0].text,'unsaving does not edit the facts');
});
test('bad output and expired generation leave no fabricated facts, and can retry explicitly',async()=>{
  const f=setup(),{R,scene,chars,raw}=f;
  await assert.rejects(R.connect(scene,chars,async()=>({lines:[{speakerId:'stranger',speaker:'陌生主角色',text:'假事件'}]})),/名单/);
  assert.equal(R.read().events.length,0);
  await assert.rejects(R.connect(scene,chars,async()=>{f.now(scene.endAt);return raw;}),/结束/);
  assert.equal(R.read().events.length,0);
  f.now(scene.startAt+60000);const e=await R.connect(scene,chars,async()=>raw);assert.ok(e.id);
});
test('joint radio retains user contributions, partner speech and finished archive across current and future context',()=>{
  const f=setup(),{R,chars}=f;const s=R.createShow(chars[0],'校稿间隙');const e=R.startEpisode(s.id,'今天的稿子','测试用户');
  assert.throws(()=>R.startEpisode(s.id,'另一份','我'),/已有/);
  R.appendShow(s.id,e.id,'我想换一个题。',{lines:[{text:'那就先说你手上的那件事。'}]},chars[0]);
  assert.match(R.contextFor('a'),/测试用户：我想换一个题/);assert.equal(R.contextFor('b'),'');
  R.finishEpisode(s.id,e.id,'临时换题');const stored=R.getShow(s.id).episodes[0];assert.equal(stored.status,'finished');assert.equal(stored.title,'临时换题');
  assert.throws(()=>R.appendShow(s.id,e.id,'追加',{lines:[{text:'已结束'}]},chars[0]),/录完/);
  const next=R.startEpisode(s.id,'明天再聊','测试用户');assert.match(R.studioPrompt(R.getShow(s.id),next,''),/临时换题/);
});
test('real app route uses shared probes and real actors; generation is system-only with full bundle',async()=>{
  const f=setup(),{R,chars,scene,raw}=f,calls=[];
  const start=app.indexOf('  else if (screen === "radio")'),end=app.indexOf('  else if (screen === "radioArchive")',start);assert.ok(start>0&&end>start);
  const env={window:{RadioLife:R,RadioLifeScreen:'life'},screen:'radio',body:null,h:(type,p)=>p,liveChars:chars,settingsFor:()=>({}),isBody:()=>false,userName:()=> '测试用户',profile:{},goHome:()=>{},setScreen:()=>{},setSelSched:()=>{},calReturnRef:{current:null},openChatById:()=>{},timeAwareFor:()=>true,schedulesRef:{current:f.plans()},rels:{'a->b':{label:'同事'}},characters:chars,bgActive:{},ctxFor:c=>({char:c,persona:'完整人设',radioLife:R.contextFor(c.id)}),loreForContext:()=> '世界书哨兵',characterText:c=>c.name+'完整角色卡',directedRelationLines:()=> '关系哨兵',runProbe:async(p,ctx,probe)=>{calls.push({ctx,probe});return raw;}};
  const props=new Function('env','with(env){'+app.slice(start,end).replace('  else if','  if')+';return body;}')(env);
  assert.equal(props.sceneFor(chars[0]).key,scene.key);
  await props.onConnect(chars[0],scene,false);assert.equal(calls.length,1);assert.match(calls[0].probe.instruction,/乙完整角色卡/);assert.doesNotMatch(calls[0].probe.instruction,/丙完整角色卡/);assert.equal(calls[0].ctx.worldbook,'世界书哨兵');assert.equal(calls[0].probe.voiceScene,true);assert.equal(calls[0].probe.maxTokens,65000);
  assert.match(cut(engine,'async function runProbeInner(', 'async function generateDiary('),/role: "user", content: "开始。"/);
  assert.match(app,/radioLife: window\.RadioLife \? window\.RadioLife\.contextFor\(char\.id\)/);
  const injection=engine.split('\n').find(l=>l.includes('parts.push(ctx.radioLife)'));
  const run=new Function('ctx','const parts=[];'+injection+';return parts;');assert.deepEqual(run({radioLife:'现场事实'}),['现场事实']);assert.deepEqual(run({radioLife:'现场事实',notRoleplay:true}),[]);
  assert.match(engine, /"x_radioLife"/);
});
test('group text, call and offline receive original facts only inside actual participants',async()=>{
  const f=setup(),e=await f.R.connect(f.scene,f.chars,async()=>({...f.raw,lines:[f.raw.lines[0]]}));f.R.reveal(e.id,0);f.R.keep(e.id,true);
  const {fixture,evaluate,wire,sections}=require('./_group-background-fixture.cjs');
  for(const surface of ['online','call','offline']){
    const env=wire(fixture());env.window.RadioLife=f.R;env.ctx.memberRadioLife={a:f.R.contextFor('a'),b:f.R.contextFor('b')};
    const out=evaluate(sections[surface],env,'memberDesc');const a=out.slice(out.indexOf('【甲】'),out.indexOf('【乙】')),b=out.slice(out.indexOf('【乙】'));
    assert.match(a,/第二页的标注/);assert.match(a,/以下事件属于 甲 本人经历/);assert.doesNotMatch(b,/第二页的标注/);
  }
});
test('saved older scenes are retained beyond a recent-items window; closed rooms honor formal memory gate',async()=>{
 const f=setup();for(let i=0;i<12;i++){const s={...f.scene,key:f.scene.key+i,title:'曾发生的事'+i};const e=await f.R.connect(s,f.chars,async()=>({title:'往期'+i,lines:[{speakerId:'a',text:'第'+i+'次已经说出口的事情。'}]}));f.R.reveal(e.id,0);f.R.keep(e.id,true);}
 f.now(f.scene.endAt+1);assert.match(f.R.contextFor('a'),/第0次已经说出口/);assert.match(f.R.contextFor('a'),/第11次已经说出口/);assert.equal(f.R.contextFor('c'),'');
 const rooms=require('../js/chat-rooms.js');assert.ok(rooms.CTX_GATE.formalMemory.includes('radioLife'));
 const gated=rooms.gateCtx({radioLife:f.R.contextFor('a')},{id:'fixture-room',cognition:{formalMemory:false}});assert.ok(!gated.radioLife);
});

test('solo self-talk is a valid schedule scene and does not make available contacts participants',async()=>{
 const f=setup();const e=await f.R.connect(f.scene,f.chars,async()=>({title:'独处的片段',lines:[{speakerId:'a',text:'这一页还得重新校对。'},{speakerId:'a',text:'先把纸张理好。'}]}));
 f.R.reveal(e.id,0);assert.deepEqual(Array.from(e.participantIds),['a']);assert.match(f.R.contextFor('a'),/重新校对/);assert.equal(f.R.contextFor('b'),'');assert.match(f.R.lifePrompt(f.scene,[]),/无需安排别人出场/);
});

test('continuation carries exact past facts and saved end position; copied output does not append or retry',async()=>{
 const f=setup(),{R,scene,chars,raw}=f;const e=await R.connect(scene,chars,async()=>({...raw,progress:{reached:'第二页和末行已校对完',open:'下一步装订，尚未发生'}}));
 raw.lines.forEach((_,i)=>R.reveal(e.id,i));let calls=0;const prompt=R.lifePrompt(scene,R.read().events);assert.match(prompt,/已校对完/);assert.match(prompt,/下一步装订，尚未发生/);assert.match(prompt,/第2段/);assert.match(prompt,/换词复述同一件事不算新的进展/);
 await assert.rejects(R.connect(scene,chars,async()=>{calls++;return raw;},true),/重复的片段/);assert.equal(calls,1);assert.equal(R.read().events.length,1);assert.equal(R.read().events[0].id,e.id);
 const fresh=await R.connect(scene,chars,async()=>({title:'校对之后',progress:{reached:'稿件开始装订',open:'装订仍在进行'},lines:[{speakerId:'a',text:'校对好了，这会儿把稿页整理好再装订。'}]}),true);assert.equal(fresh.ordinal,1);assert.equal(fresh.progress.reached,'稿件开始装订');
});
