// One scene policy for the host menu and the actual two-person renderer.
(function(root){
  const labels={hand:'牵手',hug:'拥抱',shoulder:'靠肩',read:'一起看书',meal:'一起吃饭',cook:'一起做饭',drink:'坐着喝一杯',walk:'并肩散步',stretch:'一起拉伸',browse:'一起看蔬果',wait:'并肩候车',rest:'并排歇会'};
  const scenes={
    dayHome:{home:true,actions:['hand','hug','shoulder','read','meal','cook']},
    dayCafe:{actions:['drink','meal','hand','hug']},
    dayStreet:{actions:['walk','shoulder','hand','hug']},
    dayLibrary:{actions:['read','hand','hug']},
    dayGym:{actions:['stretch','rest','hand','hug']},
    dayMarket:{actions:['browse','rest','hand','hug']},
    dayStation:{actions:['wait','shoulder','read','hand','hug']}
  };
  function source(slot){const d=slot?.deviation;return d?.actual?{title:d.actual,type:d.type||(d.actual===slot.title?slot.type:'other')}:slot||{};}
  function setting(snapshot){
    if(!snapshot||snapshot.preview||snapshot.showcase||snapshot.editing)return null;
    const map=snapshot.presentation?.map,scene=scenes[map];if(!scene)return null;
    const s=source(snapshot.slot);
    if(!scene.home&&(['work','create','study'].includes(s.type)||/上班|值班|执勤|接诊|收银工位|工作任务|授课|教练带课/.test(String(s.title||''))||snapshot.presentation?.spot==='cashier'))return null;
    return {...scene,map,actions:scene.actions.map(kind=>({kind,label:scene.home&&kind==='cook'?'锅边搭把手':labels[kind]}))};
  }
  root.CharDaySocial={labels,scenes,setting};
})(globalThis);
