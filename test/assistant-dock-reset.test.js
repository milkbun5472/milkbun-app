const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const src = fs.readFileSync("js/assistant.js", "utf8");
const component = src.slice(src.indexOf("  const DOCK_BRIEF_AWAY"), src.indexOf("  window.AssistantDock"));

function boot() {
  const state = [], refs = [], effects = [], events = {}, winEvents = {};
  let si = 0, ri = 0, first = true;
  const context = {
    useState: init => {
      const i = si++;
      if (first) state[i] = typeof init === "function" ? init() : init;
      return [state[i], next => { state[i] = typeof next === "function" ? next(state[i]) : next; }];
    },
    useRef: init => { const i = ri++; return refs[i] || (refs[i] = {current:init}); },
    useEffect: fn => { if (first) effects.push(fn); },
    useTheme: () => ({bg:"#fff",bg2:"#fff",line:"#ccc"}),
    A: {loadCfg:()=>({ballOn:true,name:"fixture"})},
    useAssistChat:()=>({msgs:[],busy:false}),
    document: {visibilityState:"visible",addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]},
    window: {innerWidth:390,addEventListener:(k,f)=>winEvents[k]=f,removeEventListener:k=>delete winEvents[k]},
    // Legacy writer stored {x,y}; reading or writing it is now forbidden.
    localStorage: {getItem:()=>{throw Error("legacy position read");},setItem:()=>{throw Error("position persisted");}},
    setInterval:()=>1,clearInterval:()=>{},vhOf:()=>844,safeBottom:()=>14,BALL:46,
    h:(type,props,...children)=>({type,props,children}),QiuFace:()=>null,
    Bubbles:()=>null,StaleAsk:()=>null,F_BODY:"",F_DISPLAY:""
  };
  vm.createContext(context);vm.runInContext(component,context);
  const render=()=>{si=0;ri=0;const tree=context.AssistantDock({});first=false;return tree;};
  const tree=render(), cleanups=effects.map(fn=>fn()).filter(Boolean);
  return {tree,render,state,refs,events,winEvents,context,cleanups};
}
function drag(b) {
  b.tree.props.onPointerDown({clientX:340,clientY:700,pointerId:1,currentTarget:{setPointerCapture(){}}});
  b.tree.props.onPointerMove({clientX:50,clientY:10,preventDefault(){}});
  const moved=b.render();moved.props.onPointerUp();
  moved.props.onClick(); // Drag-generated click is swallowed.
  return b.render();
}
test("fresh launch ignores legacy position; dragging is temporary and still suppresses click",()=>{
  const b=boot(), start=b.tree.props.style;
  assert.equal(start.left,332);assert.equal(start.top,700);
  const moved=drag(b);
  assert.notEqual(moved.props.style.top,start.top);
  assert.equal(b.state[0],false);
  assert.equal(boot().tree.props.style.top,start.top);
  assert.doesNotMatch(src,/getItem\(DOCK_KEY|saveDock\(|loadDock\(/);
});
test("return from background restores default point and closes panel, retaining input",()=>{
  const b=boot();drag(b);
  b.state[0]=true;b.state[2]="unsent fixture";
  b.context.document.visibilityState="hidden";b.events.visibilitychange();
  assert.equal(b.state[0],true);
  b.refs[3].current=Date.now()-10*60*1000;   // 离开很久
  b.context.document.visibilityState="visible";b.events.visibilitychange();
  const restored=b.render();
  assert.equal(restored.props.style.top,700);assert.equal(restored.props.style.left,332);
  assert.equal(b.state[0],false);assert.equal(b.state[2],"unsent fixture");
});
test("back-forward cache restore resets position; listeners are removed on unmount",()=>{
  const b=boot();const moved=drag(b);
  b.winEvents.pageshow({persisted:false});
  assert.equal(b.render().props.style.top,moved.props.style.top);
  b.winEvents.pageshow({persisted:true});
  assert.equal(b.render().props.style.top,700);
  b.cleanups.forEach(fn=>fn());
  assert.deepEqual(Object.keys(b.events),[]);assert.deepEqual(Object.keys(b.winEvents),[]);
});

test("brief trip out (photo picker, copying a link) keeps the panel open where it was",()=>{
  const b=boot();drag(b);const at=JSON.stringify(b.state[4]);
  b.state[0]=true;b.state[3]={full:"x",thumb:"x"};
  b.context.document.visibilityState="hidden";b.events.visibilitychange();
  b.context.document.visibilityState="visible";b.events.visibilitychange();
  assert.equal(b.state[0],true);
  assert.equal(JSON.stringify(b.state[4]),at);
  assert.deepEqual(b.state[3],{full:"x",thumb:"x"});
});
