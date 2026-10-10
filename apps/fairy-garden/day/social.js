// One scene policy for the host menu and the actual two-person renderer.
(function(root){
  const labels={look:'看看彼此',cup:'递一杯水',closer:'坐近一点',hand:'牵手',hug:'拥抱',shoulder:'靠肩',read:'一起看书',meal:'一起吃饭',cook:'一起做饭',drink:'坐着喝一杯',walk:'并肩散步',stretch:'一起拉伸',browse:'一起看蔬果',wait:'并肩候车',rest:'并排歇会'};
  const chores={'tidy-bed':{label:'整理床铺',kind:'bed',duration:9},'water-plant':{label:'给植物浇水',kind:'plant',duration:7},'wipe-table':{label:'擦桌子',kind:'table',duration:8},'wash-dishes':{label:'洗碗',kind:'kitchen',duration:10}};
  const scenes={
    dayHome:{home:true,actions:['look','cup','closer','hand','hug','shoulder','read','meal','cook']},
    dayCafe:{actions:['look','cup','drink','meal','hand','hug']},
    dayStreet:{actions:['look','walk','shoulder','hand','hug']},
    dayLibrary:{actions:['look','read','hand','hug']},
    dayGym:{actions:['look','stretch','rest','hand','hug']},
    dayMarket:{actions:['look','browse','rest','hand','hug']},
    dayStation:{actions:['look','closer','wait','shoulder','read','hand','hug']}
  };
  function source(slot){const d=slot?.deviation;return d?.actual?{title:d.actual,type:d.type||(d.actual===slot.title?slot.type:'other')}:slot||{};}
  function setting(snapshot){
    if(!snapshot||snapshot.preview||snapshot.showcase||snapshot.editing)return null;
    const map=snapshot.presentation?.map,scene=scenes[map];if(!scene)return null;
    const s=source(snapshot.slot);
    if(!scene.home&&(['work','create','study'].includes(s.type)||/上班|值班|执勤|接诊|收银工位|工作任务|授课|教练带课/.test(String(s.title||''))||snapshot.presentation?.spot==='cashier'))return null;
    return {...scene,map,actions:scene.actions.map(kind=>({kind,label:scene.home&&kind==='cook'?'锅边搭把手':labels[kind]}))};
  }
  function automaticSetting(snapshot){const s=source(snapshot?.slot);return setting(snapshot)&&!['work','create','study','sleep'].includes(s.type)&&!snapshot?.visitorPreview&&!snapshot?.kitchenJob&&!/工作|上班|值班|睡觉|睡眠/.test(String(s.title||''));}
  root.CharDaySocial={labels,chores,scenes,setting,automaticSetting};
})(globalThis);
