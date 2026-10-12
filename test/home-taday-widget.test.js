const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8'),app=fs.readFileSync('js/app.js','utf8'),kit=fs.readFileSync('js/char-day.js','utf8');
test('TA在干嘛小组件：放在最后一页，一次一位，默认轮换可钉住，读同一份 dayState/aroundNow，点了进那位的TA的一天',()=>{
  const i=src.indexOf('function TaDayWidget(');assert.ok(i>0,'抠不出 TaDayWidget');
  const body=src.slice(i,src.indexOf('\n}\n',i));
  assert.match(body,/kit\.dayState\(c, \(schedules \|\| \{\}\)\[c\.id\] \|\| \{\}, at\)/);assert.match(body,/kit\.aroundNow\(st\)/);
  assert.doesNotMatch(body,/callAI|runProbe|generateThought/);
  assert.match(body,/setIx\(function \(i\) \{ return i \+ 1; \}\); \}, 6000\)/);
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
test('TA在干嘛小组件：念头只读已存那句、一条全天时间线、碰一下停轮换、睡着换月亮',()=>{
  const i=src.indexOf('function TaDayWidget(');const body=src.slice(i,src.indexOf('\n}\n',i));
  assert.match(body,/kit\.lastThought\(loadJSON\("x_charDayHomes", \{\}\) \|\| \{\}, it\.c\.id\)/);
  assert.match(body,/kit\.dayLine\(st, \{ accent: t\.accent \}\)/);
  assert.match(body,/onPointerDown: hold/);assert.match(body,/if \(Date\.now\(\) < holdUntil\.current\) return;/);
  assert.match(body,/const Icon = asleep \? GMoon : GWalk;/);
  assert.match(kit,/function lastThought\(homes, id\)/);assert.match(kit,/function dayLine\(state,/);
  assert.match(kit,/const thoughtOf = x => lastThought\(homes, x\.id\);/);
});
