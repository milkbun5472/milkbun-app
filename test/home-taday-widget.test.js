// 2026-10-18 起 char-day.js / fairy-garden.js 拆出 -core.js（开机那半）：读源码、跑沙盒都先带上 core
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8'),app=fs.readFileSync('js/app.js','utf8'),kit=(fs.readFileSync('js/char-day-core.js','utf8')+'\n'+fs.readFileSync('js/char-day.js','utf8'));
test('TA在干嘛小组件：放在最后一页，一次一位，默认轮换可钉住，读同一份 dayState/aroundNow，点了进那位的TA的一天',()=>{
  const i=src.indexOf('function TaDayWidget(');assert.ok(i>0,'抠不出 TaDayWidget');
  const body=src.slice(i,src.indexOf('\n}\n',i));
  assert.match(body,/kit\.dayState\(c, \(schedules \|\| \{\}\)\[c\.id\] \|\| \{\}, at, kit\.clockOptions \? kit\.clockOptions\(homes, c\.id\) : \{\}\)/);assert.match(body,/kit\.aroundNow\(st\)/);
  assert.doesNotMatch(body,/callAI|runProbe|generateThought/);
  assert.match(body,/stepNext\(\); \}, 6000\)/);
  assert.match(body,/if \(pinned \|\| rows\.length < 2\) return;/);
  assert.match(kit,/root\.CharDayKit = \{ dayState, clockOptions, aroundNow, spanText,/);
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
  assert.match(body,/kit\.lastThought\(homes, it\.c\.id\)/);
  assert.match(body,/kit\.dayLine\(st, \{ accent: t\.accent \}\)/);
  assert.match(body,/onPointerDown: hold/);assert.match(body,/if \(Date\.now\(\) < holdUntil\.current\) return;/);
  assert.match(body,/const Icon = asleep \? GMoon : GWalk;/);
  assert.match(kit,/function lastThought\(homes, id\)/);assert.match(kit,/function dayLine\(state,/);
  assert.match(kit,/const thoughtOf = x => lastThought\(homes, x\.id\);/);
});
test('TA在干嘛小组件按人轮换、按各自时钟、小家存档每分钟读一次',()=>{
  const i=src.indexOf('function TaDayWidget(');const body=src.slice(i,src.indexOf('\n}\n',i));
  assert.match(body,/const \[curId, setCurId\] = useState\(""\);/);assert.match(body,/return ids\[\(at0 \+ 1\) % ids\.length\];/);
  assert.match(body,/React\.useMemo\(function \(\) \{ return loadJSON\("x_charDayHomes", \{\}\) \|\| \{\}; \}, \[minuteKey\]\)/);
});
