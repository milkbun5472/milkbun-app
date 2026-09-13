// 她 2026-09-12：「电话可以开关做那种伪流式，就他说的话一字一句显示出来在屏幕中间，
// 换句就清掉上一句的显示，不说话等我说的时候就啥也不显示，挂了照样可以回看。」
// 追问之后她定的三条：
//   · 一字一句【跟着这一句的语音走】（B），没时长才退回固定速度；
//   · 连续播报本身也要【分角色】，只有开了连续播报的角色才能开流式；
//   · 回看就接现成那条——挂断后聊天里那条逐字记录，不另做一套。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), C = strip(comp);

// ── 分角色 ────────────────────────────────────────────────
test("连续播报按角色算，没单独设过的用设置里那个全局默认", () => {
  assert.match(A, /const callAutoFor = id => \{/);
  assert.match(A, /s0\.callAuto == null \? \(typeof callAutoVoice === "function" && callAutoVoice\(\)\) : !!s0\.callAuto/,
    "不是三态的话，改成分角色那天她全局开着的那份会静默失效");
  assert.match(A, /const autoVoice = people\.some\(c => callAutoFor\(c\.id\)\);/, "群里有一位开着就该有声音");
  assert.match(A, /const audioSession = autoVoice \? prepareCallAudio\(\) : null/);
});

test("流式挂在连续播报下面：没播报就没有「这一句念多久」", () => {
  assert.match(A, /const callStreamFor = id => callAutoFor\(id\) && !!\(settingsFor\(id\) \|\| \{\}\)\.callStream;/);
  assert.match(A, /const stream = people\.some\(c => callStreamFor\(c\.id\)\);/);
  // 界面上也不许在没开播报时摆这一格
  assert.match(C, /callAuto \? h\("div", \{ className: "flex items-center justify-between pt-4" \}/);
  assert.match(C, /"流式字幕"/);
  // 关掉播报要顺手把流式也关掉，不然存下来的是一个开不了的开关
  assert.match(C, /onClick: \(\) => setCallAuto\(v => \{ if \(v\) setCallStream\(false\); return !v; \}\)/);
});

test("拨通那一刻定下来，通话中改设置不半路变脸", () => {
  assert.match(A, /msgs: \[\], startTs: Date\.now\(\), autoVoice, stream \}/);
  assert.match(A, /autoVoice: !!call\.autoVoice,\n\s*stream: !!call\.stream,/, "没传给 CallScreen");
  assert.match(C, /autoVoice: autoVoiceProp,\n\s*stream,/, "CallScreen 没收");
  assert.match(C, /const autoVoice = autoVoiceProp == null \? autoVoiceGlobal : !!autoVoiceProp;/,
    "旧的通话对象没有这两格，得能退回全局那一份");
});

test("两项都存得下来（设置页交出来、存档那头接住）", () => {
  assert.match(C, /const \[callAuto, setCallAuto\] = useState\(settings\.callAuto == null \? callAutoVoice\(\) : !!settings\.callAuto\);/);
  assert.match(C, /const \[callStream, setCallStream\] = useState\(!!settings\.callStream\);/);
  assert.match(C, /\n      callAuto,\n      callStream,\n/, "保存键里没带上");
  assert.match(A, /callAuto: s\.callAuto == null \? null : !!s\.callAuto,/, "写进存档时被 !! 归一了，「没设过」会变成「设过而且是关」");
  assert.match(A, /callStream: !!s\.callStream,/);
});

// ── 屏幕中间那一句 ──────────────────────────────────────────
test("字幕跟着这一句的语音走，没时长才退回固定速度", () => {
  const i = C.indexOf("function CallSubtitle(");
  assert.ok(i > 0, "字幕那一支没了");
  const blk = C.slice(i, C.indexOf('function CallScreen(', i));
  assert.match(blk, /const ms = Math\.max\(300, Number\(line && line\.ms\) \|\| text\.length \* 78\);/,
    "没有真实时长时要有兜底，不然一个字都不铺");
  assert.match(blk, /const k = Math\.min\(1, \(Date\.now\(\) - at\) \/ ms\);/, "按挂钟算进度：切后台回来不会错位");
  assert.match(blk, /requestAnimationFrame\(step\)/);
  assert.match(blk, /if \(raf\) cancelAnimationFrame\(raf\)/, "换句时上一句的动画要停，不然两句抢着写");
  assert.match(blk, /text\.slice\(0, n\)/);
  // ⚠️没话的时候空的是【字】，不是【这块地方】：整块 return null 的话，
  //   flex-1 那个撑子没了，下面的输入框会浮到屏幕中间去（她 2026-09-12 当场报的）。
  assert.match(blk, /className: "flex-1 min-h-0 overflow-y-auto px-7"/);
  assert.match(blk, /text \? h\("div", \{/);
  assert.match(blk, /text\.slice\(0, n\)\) : null\)\);/);
  assert.ok(blk.indexOf("if (!text) return null;") < 0, "整块 return null 那一版又回来了");
});

test("这一句的真实时长是从解码出来的音频拿的", () => {
  assert.match(C, /if \(stream\) setSubLine\(\{ text: m\.content, ms: abuf\.duration \* 1000, at: Date\.now\(\), index: idx \}\);/);
  const i = C.indexOf("if (stream) setSubLine({ text: m.content");
  const blk = C.slice(Math.max(0, i - 400), i);
  assert.match(blk, /srcN\.start\(0\);/, "字幕得和开播同一拍，不能早也不能晚");
});

test("换句就换掉上一句；念完、她一开口都清空", () => {
  assert.match(C, /if \(stream && audioRef\.current\.epoch === epoch\) setSubLine\(null\);/, "队列念完了中间还挂着最后一句");
  assert.match(C, /useEffect\(\(\) => \{ if \(stream && sending\) setSubLine\(null\); \}, \[stream, !!sending\]\);/,
    "她开口的那一刻就该没了，不是等他下一句来了才换");
});

test("开了流式就把滚动的气泡列换掉，没开一个字都不变", () => {
  assert.match(C, /stream \? h\(CallSubtitle, \{ line: subLine, onPhoto: onPhoto, actions: isVideo \? callActionsFor\(list, subLine && subLine.index\) : \[\] \}\) : h\("div", \{\n\s*ref: ref,\n\s*"data-call-history": true,/);
  // 逐字记录那条路一个字没动（她选的 A：就接现成那条）
  assert.match(C, /"data-call-history": true/);
});
