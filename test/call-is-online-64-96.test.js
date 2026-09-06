// 她 2026-09-06 把我上一版全推翻了，四条：
// 1. 言秋的东西不要动；她用 gemini，看普通路线就行
// 2. 有没有可能通话跟线上聊天没有区别呢？为什么要设上限？
// 3. 既然没有区别，那为什么不能每轮都写状态卡？
// 4. 别再自己开一个，挂到公共的里面跟着线上走
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("① 言秋/anthropic 那条路一个字没动", () => {
  // 她用 gemini（openai 方言），那条路本来就 thinOnline:true、本来就带着线下
  assert.match(app, /ctxFor\(char, \{ chat: true, thinOnline: !_singleHistoryLayout \}\)/, "又去动那条路了");
  assert.match(app, /_singleHistoryLayout \? \{ \.\.\._gated, recentChat: "" \} : _gated/, "又去动那条路了");
});

test("② 通话就是线上：摊平进同一条时间线，不另设时限和字数上限", () => {
  assert.match(app, /const expandCall = m => \{/, "还是把整通挤成一行");
  assert.match(app, /m\.kind === "callend" \? expandCall\(m\) : \[m\]/, "没接进 online 那一串");
  // 上一版那两个自造的上限必须没了——预算由公共那份收
  assert.ok(app.indexOf("CALL_VERBATIM_MS") < 0, "又设了时限");
  assert.ok(app.indexOf("CALL_LOG_CAP") < 0, "又设了字数上限");
  // 每一句带自己的时刻，才排得进 a→b→c 的顺序里
  assert.match(app, /ts: x\.ts \|\| m\.ts \|\| 0\n/, "通话那几句没有自己的时刻");
  // 视频里的动作行也算发生过的事
  assert.match(app, /x\.act \? "（" \+ String\(x\.content\)\.trim\(\) \+ "）"/, "动作行丢了");
  // ⚠️她 2026-09-06 追的：别在每一行后面挂「（视频通话里）」——一通几十句，
  //   每句多七个字，挤掉的是真内容。改成开始一次、结束一次。
  assert.ok(app.indexOf('m._call ? "（" + m._call + "里）"') < 0, "又在每一行后面挂标签了");
  assert.match(app, /_callMark: "—— " \+ zh \+ " 开始（到下面那句「" \+ zh \+ " 结束」为止/, "开始那句没说清管到哪儿");
  assert.match(app, /_callMark: "—— " \+ zh \+ " 结束" \+ \(m\.dur \? " · 时长 " \+ m\.dur : ""\)/, "结束那句没自带通话种类和时长");
  // 预算从最新往回收，可能只收到半通——结束那句得自己站得住
  assert.match(app, /const line = m\._callMark \? m\._callMark/, "标记行还被套上了「谁：」");
});

test("③ 每轮都写状态卡，字段跟线上那份协议一样", () => {
  assert.match(app, /【状态卡】跟平时聊天一样，每轮都要更新/, "1:1 通话没要状态卡");
  assert.match(app, /\\"mood\\":\\"心情词\\",\\"thought\\":\\"心里那句\\",\\"place\\":\\"在哪\\",\\"wearing\\":\\"穿着\\",\\"condition\\":null/, "输出契约里没这几栏");
  assert.match(app, /callPutState\(char\.id, d, "call_" \+ Date\.now\(\)\);/, "1:1 那轮没落状态");
  // 群通话跟群线上一样，一人一条各写各的
  assert.match(app, /【状态卡】跟群里平时聊天一样/, "群通话没要");
  assert.match(app, /callPutState\(spk\.id, arr\[i\], "gcall_"/, "群通话没落状态");
});

test("④ 没有另开一条写状态的路——用的是公共那个出口", () => {
  const i = app.indexOf("const callPutState = (cid, d, turnId) => {");
  assert.ok(i > 0, "没有这个公共小函数");
  const body = app.slice(i, app.indexOf("\n      };", i));
  assert.match(body, /setStateFor\(cid, ns\);/, "没走公共出口");
  assert.match(body, /pushStateHist\(cid, ns\);/, "没进状态历史");
  assert.match(body, /setMoodFor\(cid, \{ label: ml, ts: Date\.now\(\) \}\)/, "心情没走公共出口");
  assert.match(body, /if \(st\.thought\) st\.thoughtUpdatedAt = Date\.now\(\);/, "心声没盖时间戳");
  // 1:1 和群通话共用这一个，别各写一份
  assert.equal((app.match(/const callPutState = /g) || []).length, 1, "写了第二份");
  assert.equal((app.match(/callPutState\(/g) || []).length, 2, "调用点数量变了——该只有 1:1 那处和群那处");
  // 上一版那枪挂完电话才补的状态没了（那是「自己再开一个」）
  assert.ok(app.indexOf("const solo = (!cur.groupId && cur.participants.length === 1)") < 0, "挂断后那一枪又回来了");
});
