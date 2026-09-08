const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = fs.readFileSync('js/engine.js', 'utf8');
const screens = fs.readFileSync('js/screens.js', 'utf8');
const start = engine.indexOf('function captureWirePayload(');
const source = engine.slice(start, engine.indexOf('\n// 中转站', start));
function setup() { const ctx = {window:{}}; vm.createContext(ctx); vm.runInContext(source, ctx); return ctx; }
test('默认不捕获，手动开启只捕获单聊和既有线下入口', () => {
  const c=setup();
  c.captureWirePayload('openai', 'secret', {}, {tag:'聊天'});
  assert.equal(c.window.__offlineWireCaptures, undefined);
  c.window.__offlineWireCaptureEnabled=true;
  c.captureWirePayload('openai', 'secret', {}, {tag:'日程'});
  assert.equal(c.window.__offlineWireCaptures, undefined);
  for(const opts of [{tag:'聊天'}, {wireScope:'offline'}]) c.captureWirePayload('openai','secret',{},opts);
  assert.deepEqual(Array.from(c.window.__offlineWireCaptures,r=>r.scope), ['chat','offline']);
});
test('真实协议形状保留system和messages，移除图片与认证字段且不修改请求', () => {
  for(const format of ['openai','anthropic','gemini']) {
    const c=setup(); c.window.__offlineWireCaptureEnabled=true;
    const body={model:'fixture',system:'背景',messages:[{role:'user',content:[{type:'text',text:'好困'},{type:'image_url',image_url:{url:'https://private/image?token=secret'}},{type:'image',source:{type:'base64',data:'secret'}}]}],contents:[{parts:[{inlineData:{mimeType:'image/png',data:'secret'}}]}],api_key:'secret'};
    const before=JSON.stringify(body);
    c.captureWirePayload(format,'https://secret@host/secret?key=secret',body,{tag:'聊天'});
    const row=c.window.__offlineWireCaptures[0];
    assert.equal(row.body.system,'背景');
    assert.equal(row.body.messages[0].content[0].text,'好困');
    assert.ok(!JSON.stringify(row).includes('secret'));
    assert.equal(JSON.stringify(body),before);
  }
});
test('停止后不抓、仅保留最近八次、重开默认空', () => {
  const c=setup(); c.window.__offlineWireCaptureEnabled=true;
  for(let i=0;i<10;i++) c.captureWirePayload('openai','', {n:i}, {tag:'聊天'},'retry');
  assert.equal(c.window.__offlineWireCaptures.length,8);
  assert.equal(c.window.__offlineWireCaptures[0].body.n,2);
  c.window.__offlineWireCaptureEnabled=false;
  c.captureWirePayload('openai','', {n:10}, {tag:'聊天'});
  assert.equal(c.window.__offlineWireCaptures.at(-1).body.n,9);
  assert.equal(setup().window.__offlineWireCaptures,undefined);
});
test('真实CtxDebug窄屏复用现有容器，角色入口可见且提供停止刷新导出', () => {
  const a=screens.indexOf('function CtxDebug('), b=screens.indexOf('\nfunction ',a+1);
  const src=screens.slice(a,b);
  assert.match(src,/本轮请求诊断/);
  assert.match(src,/停止抓取/);
  assert.match(src,/导出这次请求/);
  assert.match(src,/await saveTextFile\(/);
  assert.match(src,/flexShrink: 0/);
  assert.match(src,/wordBreak: "break-all"/);
  assert.doesNotMatch(src,/!compact \? h\("div", \{ style: \{ border:/);
  assert.doesNotMatch(src,/callAI\(|localStorage\.setItem/);
});
test('实际组件按钮可开启、刷新、导出选中请求、停止与清空', async () => {
  const a=screens.indexOf('function CtxDebug('), b=screens.indexOf('\nfunction ',a+1);
  let idx=0; const state=[], saved=[];
  const c={window:{}, Eyebrow:'eyebrow', useTheme:()=>({}), F_BODY:'sans', F_DISPLAY:'serif', React:{Fragment:'fragment'},
    useState:init=>{const n=idx++; if(!(n in state)) state[n]=typeof init==='function'?init():init; return [state[n],v=>state[n]=v];},
    h:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
    saveTextFile:async(...args)=>saved.push(args)};
  vm.createContext(c); vm.runInContext(screens.slice(a,b),c);
  const render=()=>{idx=0; return c.CtxDebug({characters:[],lockedCharId:'fixture',compact:true,getBundle:()=>''});};
  const find=(node,label)=>{if(!node||typeof node!=='object')return null; if(node.type==='button'&&node.children.includes(label)) return node; for(const ch of node.children||[]){const hit=find(ch,label); if(hit)return hit;} return null;};
  find(render(),'开始抓取').props.onClick();
  assert.equal(c.window.__offlineWireCaptureEnabled,true);
  const row={id:'one',ts:1,scope:'chat',format:'openai',body:{messages:[]}};
  c.window.__offlineWireCaptures=[row];
  find(render(),'刷新记录').props.onClick();
  await find(render(),'导出这次请求').props.onClick();
  assert.equal(saved.length,1);
  assert.equal(JSON.parse(saved[0][1]).id,'one');
  find(render(),'停止抓取').props.onClick();
  assert.equal(c.window.__offlineWireCaptureEnabled,false);
  find(render(),'清空').props.onClick();
  assert.equal(c.window.__offlineWireCaptures.length,0);
});
