const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8');
const start=src.indexOf('recent.map((m, i) => {');
const render=src.slice(start,src.indexOf('\n  }),',start)+5);
const h=(tag,props,...children)=>({tag,props,children});
const rows=new Function('h','TransText','F_BODY','list',`const recent=list.slice(-16),people=[],isGroup=false,primary=null,onPhoto=false,autoZh=false,litText={},tp={play:null},callBubble=()=>({background:'#abc',color:'#222'});return ${render};`);
test('通话窗口16→17→40条：同一条key稳定，新消息不继承旧位置',()=>{
 // 消息形状钉在真实通话写入方；无需假造不存在的消息id。
 const app=fs.readFileSync('js/app.js','utf8');
 assert.match(app,/msgs: \[\.\.\.c.msgs, \{ ts: Date.now\(\), \.\.\.line \}\]/);
 const list=Array.from({length:40},(_,i)=>({role:i%2?'user':'char',content:'message '+i,ts:i}));
 const a=rows(h,()=>{},'sans',list.slice(0,16));
 const b=rows(h,()=>{},'sans',list.slice(0,17));
 assert.equal(a[1].props.key,b[0].props.key);
 assert.ok(!a.some(x=>x.props.key===b[15].props.key));
 assert.deepEqual(rows(h,()=>{},'sans',list).map(x=>x.props.key),Array.from({length:16},(_,i)=>i+24));
 assert.match(render,/tp.toggle\(messageKey,/);
});
test('公共翻译的状态实例跟原文、说话方、自带译文绑定，主题不重置',()=>{
 const body=src.slice(src.indexOf('function TransText('),src.indexOf('function TransTextState('));
 const fn=new Function('h','TransTextState',body+';return TransText;')(h,()=>{});
 const props={text:'Hello',isU:false,zhReady:'你好',ink:'#222'};
 const key=p=>fn(p).props.key;
 assert.equal(key(props),key({...props,ink:'#fff'}));
 for(const delta of [{text:'Bye'},{isU:true},{zhReady:'您好'}])assert.notEqual(key(props),key({...props,...delta}));
});
