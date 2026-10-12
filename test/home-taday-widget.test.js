const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8'),app=fs.readFileSync('js/app.js','utf8'),kit=fs.readFileSync('js/char-day.js','utf8');
test('TA在干嘛小组件：放在最后一页，一次一位，默认轮换可钉住，读同一份 dayState/aroundNow，点了进那位的TA的一天',()=>{
  const i=src.indexOf('function TaDayWidget(');assert.ok(i>0,'抠不出 TaDayWidget');
  const body=src.slice(i,src.indexOf('\n}\n',i));
  assert.match(body,/kit\.dayState\(c, \(schedules \|\| \{\}\)\[c\.id\] \|\| \{\}, at\)/);assert.match(body,/kit\.aroundNow\(st\)/);
  assert.doesNotMatch(body,/callAI|runProbe|generateThought/);
  assert.match(body,/setInterval\(function \(\) \{ setIx\(function \(i\) \{ return i \+ 1; \}\); \}, 6000\)/);
  assert.match(body,/if \(pinned \|\| rows\.length < 2\) return;/);
  assert.match(kit,/root\.CharDayKit = \{ dayState, aroundNow, spanText,/);
  assert.match(src,/w_taday: \{ kind: "widget", which: "taday", tail: true \}/);
  assert.match(src,/var dp = REG\[key\]\.tail \? Math\.max\(0, out\.length - 1\) :/);
  assert.match(src,/pin: lookOf\(key\)\.pin, onOpen:/);
  assert.match(src,/!cur\.tapImageRef && !cur\.pin &&/);
  assert.match(src,/A\.isWidget && A\.type === "taday" \?/);
  assert.match(src,/setWidgetLook\(A\.key, \{ pin: o\.id \|\| null \}\)/);
  assert.match(app,/onOpenDay: id => \{ setGardenEntryWorld\("day"\); setGardenDayCharId\(String\(id \|\| ""\)\); setScreen\("fairyGarden"\); \}/);
});
