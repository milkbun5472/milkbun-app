// 双击TA的气泡贴表情（群里 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const c = rd("components.js"), app = rd("app.js"), ts = rd("theme-studio.js");
test("双击认的是同一条的气泡，只给TA的消息开面板", () => {
  assert.match(c, /e\.target\.closest\('\[data-wk="bubble"\]'\)/);
  assert.match(c, /L\.i === at && now - L\.t < 400/);
  assert.match(c, /mm\.role === "assistant" && !mm\.recalled\) setStickAt\(i\)/);
});
test("贴的存在那一条上，画在气泡角上，TA 下一轮看得到", () => {
  assert.match(c, /msgStickEl\(m, isU\)/);
  assert.match(app, /onStickMsg: \(idx, st\) => pChat\(/);
  assert.match(app, /后来往你这句上贴了一个表情/);
  assert.match(ts, /"msgstick"/);
  assert.match(ts, /"msgstickoff"/);
});
test("也能贴 emoji", () => {
  assert.match(c, /const MSG_STICK_EMOJI = \[/);
  assert.match(c, /onPick\(\{ emoji: v, keyword: v \}\)/);
  assert.match(app, /st\.emoji \? \{ emoji: String\(st\.emoji\)\.slice\(0, 8\) \}/);
  assert.match(ts, /"msgstickemoji"/);
});
test("QQ 那样的小条＋面板，能自己建几栏、挑快捷条用哪栏", () => {
  assert.match(c, /function MsgStickPicker\(\{ at, hasStick, onPick, onClose, onPacks \}\)/);
  assert.match(c, /saveJSON\("x_stickEmoji", b\)/);
  assert.match(c, /const quickGroup = book\.groups\.find\(g => g\.id === book\.quick\)/);
  assert.match(c, /Date\.now\(\) - bornAt\.current > 450/);
  for (const k of ["msgstickbar", "msgstickpanel", "msgstickgroup", "msgstickgroupnew", "msgstickedit", "msgstickown", "msgstickpacks"]) assert.match(ts, new RegExp('"' + k + '"'));
});
test("TA 也能往她的气泡上贴一个 emoji", () => {
  assert.match(app, /stick:\{"quote":"她某句话里的原话，照抄几个字","emoji":"一个 emoji"\}=往她那句话上贴一个表情/);
  assert.match(app, /theirStick: \{ \.\.\._st, ts: Date\.now\(\) \}/);
  assert.match(app, /你往她这句上贴过一个/);
  assert.match(c, /const st = m && \(isU \? m\.theirStick : m\.stick\);/);
});
test("群聊也接上：她双击别人的气泡贴、成员也能往气泡上贴", () => {
  assert.equal((c.match(/onDoubleTap: onStickMsg \?/g) || []).length, 2);
  assert.match(c, /m\.gSticks/);
  assert.match(app, /const gStickField = /);
  assert.match(app, /gPatField \+ gStickField \+ "" \+ gDmField/);
  assert.match(app, /gSticks: \(x\.gSticks \|\| \[\]\)\.filter\(g => g\.by !== spk\.id\)/);
  assert.match(app, /fmtGLine\(m\) \+ groupStickNote\(m\)/);
});
test("贴表情有场合：她哪句让他当下有反应就贴", () => {
  assert.match(app, /capState\.push\("stick：" \+ uName \+ " 的某句话让你当下有了反应、这个反应一个表情就说得清的时候/);
  assert.match(app, /群里谁的哪句话让你当下有了反应、这个反应一个表情就说得清的时候/);
});
test("TA 也能贴自己的表情包", () => {
  assert.match(app, /const _em = _ek && emotes\.length \? emoteMatch\(emotes, _ek\) : null;/);
  assert.match(app, /emoteMatch\(emotesForChar\(spk\.id\), String\(item\.stick\.emote\)\.trim\(\)\)/);
  assert.match(c, /m\.gSticks\.filter\(x => x && \(x\.emoji \|\| x\.url\)\)/);
});
