const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const comp=fs.readFileSync(require('node:path').join(__dirname,'../js/components.js'),'utf8');
const a=comp.indexOf('function useChatWindow('),b=comp.indexOf('function useListWindow(',a);assert.ok(a>0&&b>a);
function windowFor(){
 const values=[],refs=[];let cursor=0,refCursor=0;
 const e={Math,Number,CHAT_WINDOW:200,useEffect:()=>{},React:{useLayoutEffect:()=>{}},useState:seed=>{const i=cursor++;values[i]??=seed;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},useRef:v=>refs[refCursor++]|| (refs[refCursor-1]={current:v})};
 vm.createContext(e);vm.runInContext(comp.slice(a,b),e);
 return (total,limit=0)=>{cursor=refCursor=0;return e.useChatWindow({current:{scrollHeight:600,scrollTop:100}},total,'same-role',limit);};
}
test('TA一天只画最后20个原始消息下标，翻到顶和定位都不会扩大窗口',()=>{
 const render=windowFor();let w=render(65,20);assert.equal(w.winStart,45);assert.equal(w.startRef.current,45);
 w.growMore();w.reveal(0);w=render(65,20);assert.equal(w.winStart,45);assert.equal(w.growing(),false);
 const original=Array.from({length:65},(_,i)=>i),shown=original.filter((_,i)=>i>=w.winStart);assert.equal(shown.length,20);assert.equal(shown[0],45);assert.equal(shown.at(-1),64);
});
test('新消息加入后仍显示最新20条，窗口不改变数据长度或原始下标',()=>{
 const render=windowFor();assert.equal(render(65,20).winStart,45);assert.equal(render(66,20).winStart,46);assert.equal(render(9,20).winStart,0);
});
test('主聊天原200条窗口和翻旧消息行为保留，关闭限制后仍可扩展',()=>{
 const render=windowFor();let w=render(650);assert.equal(w.winStart,450);w.growMore();w=render(650);assert.equal(w.winStart,250);w.reveal(0);assert.equal(render(650).winStart,0);
});
