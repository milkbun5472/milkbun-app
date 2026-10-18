const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),app=read('js/app.js');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);};
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const e={Date,JSON,Math};e.window=e;vm.createContext(e);
 for(const f of ['js/schedule-clock.js','apps/fairy-garden/day/catalog.js','js/char-day-link.js','apps/fairy-garden/day/kitchen.js','js/char-day-life.js','js/char-day.js'])vm.runInContext(read(f),e);
 vm.runInContext(cut((read('js/screens.js') + "\n" + read('js/screens-ui.js')),'function schedFillEnds(','function schedTzShiftMin('),e);
 let stored={},writes=[],fail=false;e.schedulesRef={current:stored};e.setSchedules=v=>{stored=typeof v==='function'?v(stored):v;};e.saveJSON=(key,value)=>{if(fail)return false;writes.push({key,value:plain(value)});return true;};
 vm.runInContext(cut(app,'  const saveSchedDay =','  const applySchedChange =')+'this.save=saveSchedDay;',e);
 vm.runInContext(cut(app,'  const editSchedSeq =','  const schedWeekKeysFrom =')+'this.edit=editSchedSeq;',e);
 const row={seq:1,time:'00:00',end:'12:00',title:'在面包房吃早饭',location:'面包房',type:'meal',busy:1,place:'城中',world:{scene:'dayCafe',spot:'meal'},deviation:{plan:'先回家',actual:'在面包房吃早饭',reason:'等她过来',world:{scene:'dayCafe',spot:'meal'}}};
 e.save('a','2026-10-09',{load:'NORMAL',seqs:[row,{seq:2,time:'12:00',end:'23:00',title:'处理邮件',location:'公司办公室',type:'work'},{seq:3,time:'23:00',end:'24:00',title:'歇下',location:'卧室',type:'sleep'}],murmurs:[{time:'10:00',text:'留着'}],generatedAt:123});
 e.save('a','2026-10-10',{seqs:[{seq:1,time:'08:00',end:'09:00',title:'吃早饭',type:'meal'}]});e.save('b','2026-10-09',{seqs:[{seq:1,time:'00:00',end:'24:00',title:'另一位自己的事',location:'家里',type:'home'}]});
 return {e,L:e.CharDayLink,get:()=>e.schedulesRef.current,row:()=>e.schedulesRef.current.a['2026-10-09'].seqs[0],writes,fail:v=>fail=v};
}
const compoundRow=()=>({seq:7,time:'10:00',end:'11:00',title:'买完菜回家做饭',location:'北街超市和家里',place:'原城市',type:'home',busy:1,world:{scene:'dayMarket',spot:'produce',stages:[{title:'挑选蔬菜',location:'北街超市',scene:'dayMarket',spot:'produce',minutes:25},{title:'提袋回家',location:'回家路上',scene:'dayStreet',spot:'walk',minutes:5},{title:'在家做饭',location:'家里厨房',scene:'dayHome',spot:'cook',minutes:30}]}});
test('纠正未来一步保留当前日程标识与动作；纠正整段的位置仍立即改变标识',()=>{
 const f=fixture();f.e.save('a','2026-10-09',{seqs:[compoundRow()]});const at=Date.parse('2026-10-09T10:12:00Z'),now=()=>f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at).slot,before=now(),p=f.L.resolve(before,at).presentation;
 assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:1,anchor:{scene:'dayLibrary',spot:'window-reading'}}}),1);assert.equal(now().key,before.key);assert.deepEqual(plain(f.L.resolve(now(),at).presentation),plain(p));
 assert.equal(f.e.edit('a','2026-10-09',7,{world:{scene:'dayClinic',spot:'casework',manual:true}}),1);assert.notEqual(now().key,before.key);
});
test('旧复合文本首次纠正及恢复自动也保留当前标识，实际偏差分支一样',()=>{
 for(const deviation of [false,true]){
  const f=fixture(),legacy={seq:7,time:'10:00',end:'11:00',title:'先在家看书，然后去实验室分析数据',location:'家里与实验室',type:'home'};
  if(deviation)legacy.deviation={actual:legacy.title,reason:'实际安排'};
  f.e.save('a','2026-10-09',{seqs:[legacy]});const at=Date.parse('2026-10-09T10:05:00Z'),now=()=>f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at).slot,before=now(),presentation=plain(f.L.resolve(before,at).presentation),calendar=JSON.stringify(f.L.publicSchedules(f.get()));
  assert.equal(f.L.stagesFor(before).length,2);assert.equal(presentation.map,'dayHome');
  assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:1,anchor:{scene:'dayLaboratory',spot:'records'}}}),1);
  assert.equal(now().key,before.key);assert.deepEqual(plain(f.L.resolve(now(),at).presentation),presentation);assert.equal(JSON.stringify(f.L.publicSchedules(f.get())),calendar);
  assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:1,anchor:null}}),1);assert.equal(now().key,before.key);
 }
});
test('只纠正一阶段沿原编辑writer保存，日历投影、时长、负荷、编号与其他安排逐字相同',()=>{
 const f=fixture();f.e.save('a','2026-10-09',{load:'NORMAL',estTime:7,seqs:[compoundRow(),{seq:12,time:'12:00',end:'13:00',title:'吃饭',type:'meal'}],murmurs:[{time:'09:00',text:'原来的念头'}]});
 const before=plain(f.get()),publicBefore=JSON.stringify(f.L.publicSchedules(before)),row=f.row();
 assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:1,anchor:{scene:'dayLibrary',spot:'window-reading'}}},JSON.stringify(row)),1);
 const next=f.row();assert.equal(JSON.stringify(f.L.publicSchedules(f.get())),publicBefore);assert.equal(f.get().a['2026-10-09'].estTime,7);assert.equal(next.edited,undefined);
 assert.deepEqual(plain(next.world.stages[0]),before.a['2026-10-09'].seqs[0].world.stages[0]);assert.deepEqual(plain(next.world.stages[2]),before.a['2026-10-09'].seqs[0].world.stages[2]);
 assert.deepEqual(plain(next.world.stages[1].override),{scene:'dayLibrary',spot:'window-reading'});assert.equal(next.world.stages[1].scene,'dayStreet');assert.equal(next.world.manual,undefined);
 const at=Date.parse('2026-10-09T10:27:00Z'),slot=f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at).slot,p=f.L.resolve(slot,at);
 assert.equal(p.presentation.map,'dayLibrary');assert.equal(p.presentation.spot,'window-reading');assert.equal(p.presentation.stageManual,true);assert.equal(p.presentation.manual,true);assert.equal(p.presentation.stageIndex,1);
 const later=f.L.resolve(f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at+8*60000).slot,at+8*60000);assert.equal(later.presentation.map,'dayHome');assert.equal(later.presentation.manual,undefined);assert.equal(later.presentation.stageIndex,2);
 const reboot=fixture();reboot.e.schedulesRef.current=plain(f.writes.at(-1).value);assert.equal(reboot.L.resolve(reboot.e.CharDayKit.dayState({id:'a',tz:0},reboot.get().a,at).slot,at).presentation.map,'dayLibrary');
});
test('阶段恢复自动保留其他步骤的纠正，偏差的阶段只改实际分支，旧文本可建立内部链',()=>{
 const f=fixture(),raw=compoundRow();raw.deviation={actual:raw.title,reason:'临时换了安排',world:plain(raw.world)};
 const changed=f.L.editRow(raw,{worldStage:{index:0,anchor:{scene:'dayFleaMarket',spot:'fabric'}}});assert.ok(changed);assert.deepEqual(plain(changed.world),raw.world);
 assert.equal(changed.deviation.world.stages[0].override.scene,'dayFleaMarket');
 const second=f.L.editRow(changed,{worldStage:{index:1,anchor:{scene:'dayLibrary',spot:'window-reading'}}});
 const restored=f.L.editRow(second,{worldStage:{index:0,anchor:null}});assert.equal(restored.deviation.world.stages[0].override,undefined);assert.equal(restored.deviation.world.stages[1].override.scene,'dayLibrary');assert.deepEqual(plain(f.L.publicRow(restored)),plain(f.L.publicRow(raw)));
 const legacy={seq:1,time:'10:00',end:'11:00',title:'先在超市买菜，然后回家做饭',location:'超市和家里',type:'home'};assert.ok(f.L.stagesFor(legacy).length>1);
 const fixed=f.L.editRow(legacy,{worldStage:{index:0,anchor:{scene:'dayLibrary',spot:'window-reading'}}});assert.ok(fixed.world.stages);assert.deepEqual(plain(f.L.publicRow(fixed)),legacy);
});
test('无效阶段、混合文字修改、保存失败与并发冲突不覆盖存档；全目录的单阶段选择均保留后续',()=>{
 const f=fixture(),raw=compoundRow();f.e.save('a','2026-10-09',{seqs:[raw]});
 for(const scene of f.e.CharDayCatalog)for(const spot of scene.spots){const fixed=f.L.editRow(raw,{worldStage:{index:0,anchor:{scene:scene.id,spot:spot.id}}});assert.equal(f.L.resolve(fixed,null,{preview:true}).presentation.spot,spot.id);assert.equal(f.L.stagesFor(fixed).length,3);assert.deepEqual(plain(fixed.world.stages[2]),raw.world.stages[2]);}
 for(const patch of [{index:-1,anchor:null},{index:3,anchor:null},{index:0,anchor:{scene:'dayLibrary',spot:'missing'}},{index:0,anchor:undefined}])assert.equal(f.L.editRow(raw,{worldStage:patch}),null);
 assert.equal(f.L.editRow(raw,{title:'同时改文字',worldStage:{index:0,anchor:null}}),null);
 assert.equal(f.L.editRow({...raw,world:{scene:'dayHome',spot:'rest',manual:true}},{worldStage:{index:0,anchor:null}}),null);
 const before=JSON.stringify(f.get()),count=f.writes.length;assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:0,anchor:null}},'old snapshot'),0);f.fail(true);assert.equal(f.e.edit('a','2026-10-09',7,{worldStage:{index:0,anchor:null}}),0);assert.equal(JSON.stringify(f.get()),before);assert.equal(f.writes.length,count);
 const invalid=plain(raw.world);invalid.stages[0].override={scene:'dayHome',spot:'missing'};assert.equal(f.L.validateStages(invalid.stages),null);
});
test('手动位置沿真实日程writer落库，只改这一段，原文、偏差、其他角色和日期都保留',()=>{
 const f=fixture(),before=plain(f.get()),row=plain(f.row());
 assert.match(app,/const n = \{ \.\.\.p, \[charId\]: \{ \.\.\.cur, \[dayKey\]: plan \} \};/);
 assert.equal(f.e.edit('a','2026-10-09',1,{world:{scene:'dayHome',spot:'rest',manual:true}},JSON.stringify(row)),1);
 const next=f.row();assert.equal(next.edited,true);assert.deepEqual(plain(next.deviation),row.deviation);
 for(const k of ['title','location','time','end','type','busy','place'])assert.equal(next[k],row[k]);
 assert.deepEqual(plain(next.world),{scene:'dayHome',spot:'rest',manual:true});assert.equal(f.writes.at(-1).key,'x_schedules');
 assert.deepEqual(plain(f.get().b),before.b);assert.deepEqual(plain(f.get().a['2026-10-10']),before.a['2026-10-10']);
 assert.deepEqual(plain(f.get().a['2026-10-09'].murmurs),before.a['2026-10-09'].murmurs);
 assert.equal(f.L.presentation(next).map,'dayHome');assert.equal(f.L.presentation(next).spot,'rest');
 assert.equal(f.L.presentation(f.get().a['2026-10-09'].seqs[1]).map,'dayOffice');
 const reboot=fixture();reboot.e.schedulesRef.current=plain(f.writes.at(-1).value);
 const slot=reboot.e.CharDayKit.dayState({id:'a',tz:0},reboot.get().a,Date.parse('2026-10-09T03:00:00Z')).slot;
 assert.equal(slot.seq,1);assert.equal(slot.sourceDay,'2026-10-09');assert.equal(reboot.L.presentation(slot).spot,'rest');
 assert.equal(f.L.publicRow(next).world,undefined);assert.equal(f.L.publicRow(next).deviation.world,undefined);
});
test('全部真实场景与位置支持手动纠正，地点文字与旧睡眠类型不会把选择改回去',()=>{
 const f=fixture();let count=0;
 for(const scene of f.e.CharDayCatalog)for(const spot of scene.spots){
  assert.ok(spot.label,scene.id+'/'+spot.id+'有中文位置名');
  const row=f.L.editRow({title:'睡觉',type:'sleep',location:'面包房'},{world:{scene:scene.id,spot:spot.id}}),p=f.L.presentation(row);
  assert.equal(p.map,scene.id);assert.equal(p.spot,spot.id);assert.equal(p.manual,true);count++;
 }assert.ok(count>150);
 assert.equal(f.L.editRow(f.row(),{world:{scene:'dayHome',spot:'不存在'}}),null);
 assert.equal(f.e.edit('a','2026-10-09',1,{world:{scene:'不在地图上',spot:'rest'}}),0);
});
test('恢复自动清掉手动与旧偏差的视觉钉子，重新按事实匹配；日历文字编辑仍清旧类型和偏差',()=>{
 const f=fixture();f.e.edit('a','2026-10-09',1,{world:{scene:'dayHome',spot:'read'}});
 f.e.edit('a','2026-10-09',1,{world:null});assert.equal(f.row().world,undefined);assert.equal(f.row().deviation.world,undefined);
 assert.equal(f.row().deviation.actual,'在面包房吃早饭');assert.equal(f.L.presentation(f.row()).map,'dayCafe');
 f.e.edit('a','2026-10-09',1,{title:'去图书馆看书',location:'图书馆',time:'01:00',end:'11:00'});
 assert.equal(f.row().deviation,undefined);assert.equal(f.row().type,undefined);assert.equal(f.L.presentation(f.row()).map,'dayLibrary');
});
test('编辑期间另一窗口改过或删过这一段，旧页面不覆盖新安排；保存失败保留原档',()=>{
 const f=fixture(),expected=JSON.stringify(f.row());f.e.edit('a','2026-10-09',1,{title:'新的安排'});
 const before=JSON.stringify(f.get()),n=f.writes.length;
 assert.equal(f.e.edit('a','2026-10-09',1,{world:{scene:'dayHome',spot:'rest'}},expected),0);
 assert.equal(f.e.edit('a','2026-10-09',999,{world:null}),0);assert.equal(f.e.edit('missing','2026-10-09',1,{world:null}),0);
 f.fail(true);assert.equal(f.e.edit('a','2026-10-09',1,{world:{scene:'dayHome',spot:'read'}}),0);
 assert.equal(JSON.stringify(f.get()),before);assert.equal(f.writes.length,n);
});
test('凌晨跨夜睡眠修改昨晚的原段，携带手动位置到早晨，醒后不串到今天的新段',()=>{
 const f=fixture();const at=Date.parse('2026-10-10T02:00:00Z');let s=f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at);
 assert.equal(s.slot.carry,true);assert.equal(s.slot.seq,3);assert.equal(s.slot.sourceDay,'2026-10-09');
 f.e.edit('a',s.slot.sourceDay,s.slot.seq,{world:{scene:'dayHome',spot:'rest'}});
 s=f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,at);assert.equal(f.L.presentation(s.slot).spot,'rest');
 s=f.e.CharDayKit.dayState({id:'a',tz:0},f.get().a,Date.parse('2026-10-10T08:20:00Z'));
 assert.equal(s.slot.sourceDay,'2026-10-10');assert.equal(f.L.presentation(s.slot).spot,'meal');
});
test('指定具体位置后不被日程阶段和短暂休息挪开，原自动流程继续运作',async()=>{
 const {activityPhase}=await import('../apps/fairy-garden/day/workflow.mjs');
 const slot={startAt:0,endAt:3600000,title:'处理邮件'};
 for(const map of ['dayOffice','dayLibrary','dayGym','dayStation','dayHome']){
  const f=fixture(),scene=f.e.CharDayCatalog.find(s=>s.id===map),spot=scene.spots[1];
  const p=f.L.presentation({world:{scene:map,spot:spot.id,manual:true}});
  for(const at of [1000,60000,780000,3590000])assert.equal(activityPhase(p,slot,at).spot,spot.id);
 }
 assert.equal(activityPhase({map:'dayOffice',spot:'computer',action:'work'},slot,1000).spot,'entrance');
});
test('手机位置编辑复用整页公共Head、单滚动正文与56px安全区底栏；示例和试玩不写真实日程',()=>{
 const src=read('js/char-day.js'),editor=cut(src,'    const positionScene=','    return outer(h(React.Fragment, null, h("div",');
 assert.match(editor,/className:"absolute inset-0 flex flex-col"/);assert.match(editor,/h\(Head,/);assert.match(editor,/menuBody\(/);assert.match(editor,/style:footerStyle/);
 assert.match(src,/minHeight:56/);assert.match(src,/safe-area-inset-bottom\) \* 0\.4/);assert.match(src,/menuPositions\.current\[menuKey\]/);
 assert.match(src,/const controlsOpen=!!positionEdit\|\|book/);assert.match(src,/scenePaused:!!\([^\n]*positionEdit/);
 assert.match(src,/!demo&&!showcase&&slot\?\.seq!=null&&props\.onEditSchedSeq/);assert.doesNotMatch(editor,/Sheet|callAI|runProbe|localStorage/);
 assert.match(app,/onEditSchedSeq: \(c, dayKey, seqNo, patch, expected\) => editSchedSeq/);
});
