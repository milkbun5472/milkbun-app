const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),app=read('js/app.js');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);};
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const e={Date,JSON,Math};e.window=e;vm.createContext(e);
 for(const f of ['js/schedule-clock.js','apps/fairy-garden/day/catalog.js','js/char-day-link.js','apps/fairy-garden/day/kitchen.js','js/char-day-life.js','js/char-day.js'])vm.runInContext(read(f),e);
 vm.runInContext(cut(read('js/screens.js'),'function schedFillEnds(','function schedTzShiftMin('),e);
 let stored={},writes=[],fail=false;e.schedulesRef={current:stored};e.setSchedules=v=>{stored=typeof v==='function'?v(stored):v;};e.saveJSON=(key,value)=>{if(fail)return false;writes.push({key,value:plain(value)});return true;};
 vm.runInContext(cut(app,'  const saveSchedDay =','  const applySchedChange =')+'this.save=saveSchedDay;',e);
 vm.runInContext(cut(app,'  const editSchedSeq =','  const schedWeekKeysFrom =')+'this.edit=editSchedSeq;',e);
 const row={seq:1,time:'00:00',end:'12:00',title:'在面包房吃早饭',location:'面包房',type:'meal',busy:1,place:'城中',world:{scene:'dayCafe',spot:'meal'},deviation:{plan:'先回家',actual:'在面包房吃早饭',reason:'等她过来',world:{scene:'dayCafe',spot:'meal'}}};
 e.save('a','2026-10-09',{load:'NORMAL',seqs:[row,{seq:2,time:'12:00',end:'23:00',title:'处理邮件',location:'公司办公室',type:'work'},{seq:3,time:'23:00',end:'24:00',title:'歇下',location:'卧室',type:'sleep'}],murmurs:[{time:'10:00',text:'留着'}],generatedAt:123});
 e.save('a','2026-10-10',{seqs:[{seq:1,time:'08:00',end:'09:00',title:'吃早饭',type:'meal'}]});e.save('b','2026-10-09',{seqs:[{seq:1,time:'00:00',end:'24:00',title:'另一位自己的事',location:'家里',type:'home'}]});
 return {e,L:e.CharDayLink,get:()=>e.schedulesRef.current,row:()=>e.schedulesRef.current.a['2026-10-09'].seqs[0],writes,fail:v=>fail=v};
}
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
