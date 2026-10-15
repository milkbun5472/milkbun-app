// One scene policy for the host menu and the actual two-person renderer.
(function(root){
const rest={
 'sit-hand':{label:'坐着牵手',posture:'sit',motion:'hand'},
 'sit-pat':{label:'坐着摸摸头',posture:'sit',motion:'pat'},
 'sit-hug':{label:'坐着搂肩',posture:'sit',motion:'shoulder'},
 'sit-lean':{label:'靠进怀里',posture:'sit',motion:'lean'},
 'lie-hand':{label:'躺着牵手',posture:'lie',motion:'hand',quiet:true},
 'lie-hug':{label:'侧身抱着你',posture:'lie',motion:'hug',quiet:true},
 'lie-rest':{label:'并排躺着歇会',posture:'lie',motion:'rest',quiet:true}
};

  const intimate={
    pat:{label:'摸头顺顺发',distance:.62},
    'kiss-forehead':{label:'亲亲额头',distance:.84},
    'kiss-cheek':{label:'亲亲脸颊',distance:.58},
    kiss:{label:'轻轻亲一下',distance:.48},
    'back-hug':{label:'从背后抱抱',distance:.28},
    'arm-walk':{label:'挽手散步',distance:.58,tour:true},
    cuddle:{label:'沙发搂抱',seated:true},
    forehead:{label:'额头贴贴',distance:.48},
    feed:{label:'喂一小口',seated:true},
    dance:{label:'双人慢舞',distance:.48},
    ...Object.fromEntries(Object.entries(rest).map(([kind,p])=>[kind,{...p,seated:p.posture==='sit',lying:p.posture==='lie'}]))
  };
  const labels={look:'看看彼此',cup:'递一杯水',closer:'坐近一点',hand:'牵手',hug:'拥抱',shoulder:'靠肩',read:'一起看书',meal:'一起吃饭',cook:'一起做饭',drink:'坐着喝一杯',walk:'并肩散步',stretch:'一起拉伸',browse:'一起看蔬果',wait:'并肩候车',rest:'并排歇会',...Object.fromEntries(Object.entries(intimate).map(([kind,p])=>[kind,p.label]))};
  const chores={shower:{label:'洗个澡',kind:'shower',duration:18,personal:true},'wash-hands':{label:'洗洗手',kind:'basin',duration:8,personal:true},toilet:{label:'上厕所',kind:'toilet',duration:9,personal:true},'tidy-bed':{label:'整理床铺',kind:'bed',duration:9},'water-plant':{label:'给植物浇水',kind:'plant',duration:7},'wipe-table':{label:'擦桌子',kind:'table',duration:8},'wash-dishes':{label:'洗碗',kind:'kitchen',duration:10}};
  const scenes={
    dayHome:{home:true,actions:['look','cup','closer','hand','hug','shoulder','read','meal','cook']},
    dayCafe:{actions:['look','cup','drink','meal','hand','hug']},
    dayStreet:{actions:['look','walk','shoulder','hand','hug']},
    dayLibrary:{actions:['look','read','hand','hug']},
    dayGym:{actions:['look','stretch','rest','hand','hug']},
    dayMarket:{actions:['look','browse','rest','hand','hug']},
    dayStation:{actions:['look','closer','wait','shoulder','read','hand','hug']}
  };
  for(const [map,kinds]of Object.entries({
    dayHome:Object.keys(intimate),
    dayCafe:['pat','kiss-forehead','kiss-cheek','kiss','back-hug','forehead','feed'],
    dayStreet:['pat','kiss-forehead','kiss-cheek','kiss','back-hug','arm-walk','cuddle','forehead','dance'],
    dayLibrary:['pat','kiss-forehead','kiss-cheek','forehead'],
    dayGym:['pat','back-hug','forehead'],
    dayMarket:['pat','kiss-cheek','arm-walk'],
    dayStation:['pat','kiss-forehead','kiss-cheek','kiss','back-hug','cuddle','forehead']
  }))scenes[map].actions.push(...kinds);
  for(const map of ['dayStreet','dayStation'])scenes[map].actions.push(...Object.keys(rest).filter(k=>rest[k].posture==='sit'));
  function source(slot){const d=slot?.deviation;return d?.actual?{title:d.actual,type:d.type||(d.actual===slot.title?slot.type:'other')}:slot||{};}
  function outing(snapshot){
    const trip=snapshot?.outing;
    return trip&&['solo','together'].includes(trip.mode)&&trip.map===snapshot.presentation?.map&&!snapshot.preview&&!snapshot.showcase&&!snapshot.editing?trip:null;
  }
  function setting(snapshot){
    if(!snapshot||snapshot.preview||snapshot.showcase||snapshot.editing)return null;
    const map=snapshot.presentation?.map,trip=outing(snapshot);
    if(trip?.mode==='solo')return {map,solo:true,home:false,actions:[]};
    const scene=scenes[map]||(trip?{actions:['look','hand','hug']}:null);if(!scene)return null;
    const s=source(snapshot.slot);
    if(!trip&&!scene.home&&(['work','create','study'].includes(s.type)||/上班|值班|执勤|接诊|收银工位|工作任务|授课|教练带课/.test(String(s.title||''))||snapshot.presentation?.spot==='cashier'))return null;
    return {...scene,map,actions:scene.actions.map(kind=>({kind,intimate:!!intimate[kind],label:scene.home&&kind==='cook'?'锅边搭把手':labels[kind]}))};
  }
  function automaticSetting(snapshot,{resting=false}={}){const s=source(snapshot?.slot),trip=outing(snapshot),sleeping=s.type==='sleep'||/睡觉|睡眠/.test(String(s.title||''));return trip?.mode!=='solo'&&setting(snapshot)&&!['work','create','study'].includes(s.type)&&(!sleeping||resting&&snapshot?.presentation?.map==='dayHome')&&!snapshot?.visitorPreview&&!snapshot?.kitchenJob&&!/工作|上班|值班/.test(String(s.title||''));}
  root.CharDaySocial={labels,intimate,rest,chores,scenes,outing,setting,automaticSetting};
})(globalThis);
