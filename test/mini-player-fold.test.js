const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/components.js','utf8');
const code=src.slice(src.indexOf('function MiniPlayer('),src.indexOf('// 全屏月历'));
test('fold persists, expands without navigation, and never changes audio state',()=>{
  const states=[],refs=[],store=new Map(),calls=[];let si=0,ri=0;
  const h=(type,props,...children)=>({type,props,children});
  const ctx={h,React:{Fragment:'fragment',useLayoutEffect:()=>{}},useTheme:()=>({ink:'#222222',bg2:'#ffffff'}),
    useState:init=>{const i=si++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
    useRef:init=>{const i=ri++;return refs[i]||(refs[i]={current:init});},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
    skinAlpha:(s,a)=>s+a,MINI_PLAYER_Z:45,F_BODY:'',F_DISPLAY:''};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  const render=()=>{si=0;ri=0;return ctx.MiniPlayer({song:{title:'fixture'},playing:true,onOpen:()=>calls.push('open'),onToggle:()=>calls.push('toggle'),onClose:()=>calls.push('close')});};
  const find=(n,label)=>{if(!n||typeof n!=='object')return null;if(n.props&&n.props['aria-label']===label)return n;return(n.children||[]).map(c=>find(c,label)).find(Boolean);};
  const initial=render();find(initial,'收起一起听播放器').props.onClick({stopPropagation(){}});
  const folded=render();assert.equal(folded.props['aria-label'],'展开一起听播放器');assert.equal(store.get('x_miniFolded'),'1');assert.deepEqual(calls,[]);
  folded.props.onClick();assert.equal(render().props['aria-label'],'一起听悬浮播放器');assert.equal(store.get('x_miniFolded'),'0');assert.deepEqual(calls,[]);
  render().props.onClick();assert.deepEqual(calls,['open']);
});
