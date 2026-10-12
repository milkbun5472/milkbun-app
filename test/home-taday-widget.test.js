const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8'),app=fs.readFileSync('js/app.js','utf8');
test('TA在干嘛小组件：默认不上桌，从做一件装饰放上去，读同一份 dayState，点了进那位的TA的一天',()=>{
  const i=src.indexOf('function TaDayWidget('),j=src.indexOf('function',i+30);assert.ok(i>0&&j>i,'抠不出 TaDayWidget');
  const body=src.slice(i,src.indexOf('\n}\n',i));assert.match(body,/kit\.dayState\(c, \(schedules \|\| \{\}\)\[c\.id\] \|\| \{\}, at\)/);assert.doesNotMatch(body,/callAI|runProbe|generateThought/);
  assert.match(src,/w_taday: \{ kind: "widget", which: "taday", optIn: true \}/);
  assert.match(src,/!REG\[key\]\.optIn && hiddenW\.indexOf\(key\) < 0 && !reach\[key\]/);
  assert.match(src,/onClick: function \(\) \{ showWidget\("w_taday"\); \}/);
  assert.match(src,/else if \(it\.which === "taday"\) inner = h\(TaDayWidget,/);
  assert.match(app,/onOpenDay: id => \{ setGardenEntryWorld\("day"\); setGardenDayCharId\(String\(id \|\| ""\)\); setScreen\("fairyGarden"\); \}/);
  assert.match(app,/schedules: schedules,\n    onOpenDay:/);
});
