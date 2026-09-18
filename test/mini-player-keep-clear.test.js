const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/components.js','utf8');
// ⚠️连禁区那一层一起切进来：分开写桩的话，测的就不是真的那一层了
//   （施工规则/stub-from-the-writer.md）。
const code=src.slice(src.indexOf('let floatKeepClear = 0;'),src.indexOf('// 全屏月历'));

// 她 2026-09-18：「音乐栏压着画面」——庭院整屏是一张画布，
// 底下那条行动栏是它自己的操作位，悬浮播放器默认正好停在它头上。
function harness(innerHeight=844){
  const states=[],refs=[],store=new Map();let si=0,ri=0;
  const listeners={};
  const h=(type,props,...children)=>({type,props,children});
  const ctx={h,React:{Fragment:'fragment',useLayoutEffect:()=>{}},
    useTheme:()=>({ink:'#222222',bg2:'#ffffff'}),
    useState:init=>{const i=si++;if(!(i in states))states[i]=typeof init==='function'?init():init;
      return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
    useEffect:fn=>{const off=fn();void off;},
    useRef:init=>{const i=ri++;return refs[i]||(refs[i]={current:init});},
    localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
    skinAlpha:(s,a)=>s+a,MINI_PLAYER_Z:45,F_BODY:'',F_DISPLAY:'',innerHeight,
    // 真的把订阅接起来：不接的话 useFloatKeepClear 永远停在初值，
    // 测出来的就是桩的行为，不是那一层的行为。
    window:{innerWidth:390,innerHeight,
      addEventListener:(k,f)=>{(listeners[k]=listeners[k]||[]).push(f);},
      removeEventListener:(k,f)=>{listeners[k]=(listeners[k]||[]).filter(x=>x!==f);},
      dispatchEvent:e=>{for(const f of listeners[e&&e.type||'']||[])f(e);}},
    CustomEvent:function(type){this.type=type;}};
  ctx.window.window=ctx.window;
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return {ctx,render:()=>{si=0;ri=0;return ctx.MiniPlayer({song:{title:'fixture'},playing:false,
    onOpen(){},onToggle(){},onClose(){}});},states};
}

test('底下有操作条的时候，悬浮播放器默认就落在它上面',()=>{
  const {ctx,render}=harness();
  assert.equal(render().props.style.bottom,84,'没人报禁区时照旧贴着屏幕底');
  ctx.setFloatKeepClear(220);
  assert.equal(ctx.window.FloatKeepClear.get(),220);
  assert.equal(render().props.style.bottom,304,'报了 220 就整条抬 220');
  ctx.setFloatKeepClear(0);
  assert.equal(render().props.style.bottom,84,'出了那一屏要还原');
});

// ⚠️那条操作条可能占掉大半个屏（庭院行动栏展开时就是 451px）。
//   照单全收会把它顶到画面正中央——比压在操作条上更碍事。
test('操作条占掉大半个屏时，它最多被推到顶上那一截为止',()=>{
  const {ctx,render}=harness(844);
  ctx.setFloatKeepClear(451);
  assert.equal(render().props.style.bottom,84+451);
  ctx.setFloatKeepClear(1200);
  assert.equal(render().props.style.bottom,84+(844-150),'再高也就到这儿');
});

