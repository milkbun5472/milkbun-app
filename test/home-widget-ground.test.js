const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/components.js','utf8');
const cut=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
test('组件底色主题不改原主题，深浅字色与恢复原样',()=>{
  const c={};vm.createContext(c);
  vm.runInContext(cut('function decorGroundDark(', 'function normalizeHomeDecorTilt('),c);
  const base={ink:'#111111',bg:'#ffffff'};
  assert.equal(c.homeWidgetGroundTheme(base,null),base);
  assert.equal(c.homeWidgetGroundTheme(base,{color:'invalid'}),base);
  const dark=c.homeWidgetGroundTheme(base,{color:'#203040'});
  assert.equal(dark.homeWidgetGround,'#203040');assert.equal(dark.ink,'#fffaf1');
  assert.equal(c.homeWidgetGroundTheme(base,{color:'#eeeeee'}).ink,'#24231f');
  assert.equal(base.bg,'#ffffff');
});
test('只选底色仍持久化，恢复原样能清掉默认空壳',()=>{
  let state={},saved;
  const c={setWidgetLooks:fn=>state=fn(state),saveJSON:(key,value)=>{assert.equal(key,'x_homeWidgetLooks');saved=value},normalizeHomeDecorTilt:()=>0};
  vm.createContext(c);vm.runInContext(cut('  function setWidgetLook(', '  function setWidgetPreset('),c);
  c.setWidgetLook('weather',{ground:{color:'#203040'}});
  assert.equal(saved.weather.ground.color,'#203040');
  c.setWidgetLook('weather',{accent:'#ff0000'});
  assert.equal(saved.weather.ground.color,'#203040');
  c.setWidgetLook('weather',{ground:null});assert.equal(saved.weather.accent,'#ff0000');
  c.setWidgetLook('weather',{accent:null});assert.equal(saved.weather,undefined);
});
test('真正卡片覆盖自身白底，预览和主屏走同一内部组件',()=>{
  const c={useTheme:()=>({homeWidgetGround:'#203040'}),useOnWallpaper:()=>false,glassFill:()=>({background:'white'}),React:{createElement:(tag,props,children)=>({tag,props,children})}};
  vm.createContext(c);vm.runInContext(cut('function GlassCard(', '// ============================================================\n// HOME'),c);
  const node=c.GlassCard({style:{padding:12,background:'pink'},children:'fixture'});
  assert.equal(node.props.style.background,'#203040');assert.equal(node.props.style.padding,12);
  assert.match(src,/value: homeWidgetGroundTheme\(t, lookOf\(key\)\.ground\)/);
  assert.match(src,/Object\.assign\(pvShell, decorGroundStyle\(PV\)\)/);
  assert.match(src,/Object\.assign\(presetStyle, decorGroundStyle\(look\)\)/);
  assert.match(src,/aria-label": "自定义底色"/);
});
