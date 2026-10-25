const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/companion.js','utf8');
function host(){const data={},listeners={};const window={addEventListener(k,f){(listeners[k]??=[]).push(f);},dispatchEvent(e){for(const f of listeners[e.type]||[])f(e);}};vm.runInNewContext(source,{window,Date,CustomEvent:class{constructor(type,opts){this.type=type;Object.assign(this,opts);}},loadJSON:(k,d)=>data[k]??d,saveJSON:(k,v)=>{data[k]=structuredClone(v);}});return {api:window.CompanionFace,data,event:d=>window.dispatchEvent({type:'companion-chat',detail:d})};}
const {api}=host(),clock=(phase,day='2026-10-24',minute=23*60,enabled=true,sleepUntil=0)=>({kind:'clock',routine:{phase,day,minute,clock:enabled,sleepUntil}});
test('真实心情独立于手选表情，字段与实际心情写入方一致',()=>{
 const app=fs.readFileSync('js/app.js','utf8');assert.match(app,/n\[charId\] = \{ label: current\.mood, ts: Date\.now\(\) \}/);
 const msg=api.petMessage({id:'c1'},{c1:{label:'难过',ts:Date.now()}},{autoFace:false,looks:{c1:{face:'happy'}}});assert.equal(msg.mood,'sad');assert.equal(msg.look.face,'happy');
 assert.equal(api.petMessage({id:'c2'},{c1:{label:'难过'}},{looks:{}}).mood,'default');
});
test('睡眠段入睡、戳醒后保持清醒、下一个睡眠段重新入睡',()=>{
 const start=Date.now(),until=start+8*3600000;let s=api.lifeStep(null,clock('asleep','d',1380,true,until),start);assert.ok(s.sleeping);
 s=api.lifeStep(s,{kind:'wake'},start+1000);assert.equal(s.sleeping,false);
 const repeated=api.lifeStep(s,clock('asleep','d',1381,true,until),start+30000);assert.deepEqual(repeated,s,'同段不逼他睡回去，也不重复写库');
 s=api.lifeStep(s,clock('asleep','next',1380,true,until+86400000),start+86400000);assert.ok(s.sleeping,'关着一天再回来也认下一觉');
 s=api.lifeStep(s,clock('waking'),start+86401000);assert.equal(s.sleeping,false);assert.equal(s.wakeAt,start+86401000);
});
test('晚安保存到文字库、不同角色隔离；否定和问句不触发睡眠',()=>{
 const h=host();for(const said of ['晚安','宝宝晚安呀','我先睡了']){h.event({charId:'c1',said,act:''});assert.equal(h.api.lifeRead('c1').sleeping,true);h.event({charId:'c1',said:'早上好',act:''});assert.equal(h.api.lifeRead('c1').sleeping,false);}
 for(const said of ['别说晚安','你先睡吧','我不睡','晚安？','如果我先睡了怎么办'])assert.notEqual(h.api.actForChat('',said),'sleep',said);
 h.event({charId:'c1',said:'晚安'});h.event({charId:'c2',said:'你好'});assert.equal(h.data.x_companionLife.c1.sleeping,true);assert.equal(h.api.lifeRead('c2').sleeping,false);
 assert.doesNotMatch(source.slice(source.indexOf('const LIFE_KEY'),source.indexOf('const IDLE_MS')),/localStorage|callAI|runProbe/);
});
test('隔夜早晨只揉眼一次，关闭时间感知不按钟点醒；睡眠段和刚睡的小憩优先',()=>{
 const t=Date.now();let s=api.lifeStep(null,{kind:'sleep'},t);s=api.lifeStep(s,clock('awake','tomorrow',480,false),t+8*3600000);assert.ok(s.sleeping);
 s=api.lifeStep(s,clock('awake','tomorrow',480),t+8*3600000);assert.equal(s.sleeping,false);assert.equal(s.wakeAt,t+8*3600000);
 assert.deepEqual(api.lifeStep(s,clock('awake','tomorrow',500),t+9*3600000),s);
 const nap=api.lifeStep(api.lifeStep(null,{kind:'sleep'},t),clock('awake','d',480),t+1000);assert.ok(nap.sleeping);
 const scheduled=api.lifeStep(null,clock('asleep','d',480),t);assert.ok(scheduled.sleeping);assert.equal(scheduled.wakeAt,0);
});
test('整页与悬浮接同一份作息、聊天和新消息入口',()=>{
 const app=fs.readFileSync('js/app.js','utf8');assert.equal((app.match(/companionRoutineFor: companionRoutineFor/g)||[]).length,2);
 assert.match(app,/const companionRoutineFor = char => \(\{ phase: sleepPhaseOf\(char\), sleepUntil: sleepHoldFor\(char\)/);
 for(const [a,b] of [['function Companion(props)','function useTyping('],['function CompanionFloat(props)','window.GCompanion']]){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);const piece=source.slice(start,end);assert.match(piece,/useChatAct\(/);assert.match(piece,/useMessageNotice\(/);}
});
test('低落更慢更少；所有触摸和放下入口按心情作出有效动作',async()=>{
 const {MOODS,DUR,touchForMood}=await import('../apps/companion/motion.mjs');for(const mood of ['sad','gloomy']){assert.ok(MOODS[mood].every>MOODS.default.every);assert.ok(MOODS[mood].tempo<1);}assert.ok(MOODS.happy.every<MOODS.default.every);assert.ok(MOODS.happy.acts.includes('hop'));
 for(const mood of ['sad','gloomy','irritated'])for(const kind of ['head','face','hand','body','lift'])for(const side of ['left','right'])for(const count of [1,2,3]){const k=touchForMood(mood,kind,side,count);assert.ok(DUR[k],k);assert.ok(!/happy|amazed|five|clap/.test(k));}
 assert.equal(touchForMood('happy','hand'),'');assert.equal(touchForMood('happy','lift'),'emotion-happy');
});
