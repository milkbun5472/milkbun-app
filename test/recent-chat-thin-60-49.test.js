const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 言秋 2026-09-02 拍板：openai 那条线上，最近五十条聊天在 system 的【最近对话】里读一遍、
// 又在 messages 里读一遍，同一段话过模型两次。anthropic 线早就整块关掉了（recentChat:""），
// openai 线没跟上——「一层写在两处，第二处没跟上」。
// 他的条件：① 线下那段不能丢，而且要带着它在时间线上的位置；② 改完真跑量一遍。

// —— 把渲染那一段抠出来【真跑】，别只 grep ——
const block = (() => {
  const i = app.indexOf("      if (thinOnline) {");
  const j = app.indexOf("      if (offSummary)", i);
  assert.ok(i > 0 && j > i, "找不到 thinOnline 那段");
  const body = app.slice(i, j);
  return new Function("thinOnline", "lines", "let rendered = lines;\n" + body + "\nreturn rendered;");
})();
const ON = { off: false, text: "" };
const off = (t) => ({ off: true, text: t });

test("线下原样留着，线上压成一行位置标记——先后关系还在", () => {
  const out = block(true, [ON, ON, ON, off("[今天15:20] 顾暮: 他把灯挪了挪"), off("[今天15:21] Lisa: 我说没事"), ON, ON]);
  assert.equal(out[0], "（线上消息的原文在下面的消息记录里，这儿只标出它们和线下的先后）");
  assert.equal(out[1], "（线上 3 条 · 原文在下面的消息记录里，不重复）");
  assert.equal(out[2], "[今天15:20] 顾暮: 他把灯挪了挪");
  assert.equal(out[3], "[今天15:21] Lisa: 我说没事");
  assert.equal(out[4], "（线上 2 条 · 原文在下面的消息记录里，不重复）");
  assert.equal(out.length, 5, "多一行少一行都会把先后关系说歪");
});

test("线下在最前 / 最后 / 中间，三种位置都标得出来", () => {
  assert.deepEqual(block(true, [off("A"), ON, ON]).slice(1), ["A", "（线上 2 条 · 原文在下面的消息记录里，不重复）"]);
  assert.deepEqual(block(true, [ON, ON, off("A")]).slice(1), ["（线上 2 条 · 原文在下面的消息记录里，不重复）", "A"]);
  assert.deepEqual(block(true, [off("A"), off("B")]).slice(1), ["A", "B"]);
});

test("一段线下都没有 = 整块全是重复，一个字都不发", () => {
  assert.equal(block(true, [ON, ON, ON, ON]), "");
  assert.equal(block(true, []), "");
});

test("没开 thinOnline 时原样不动（推演/朋友圈/论坛/日记都走这条）", () => {
  const raw = ["顾暮: 一", "Lisa: 二"];
  assert.deepEqual(block(false, raw), raw);
});

test("线下那几行带着时刻——他要靠这个知道那场戏发生在哪儿", () => {
  assert.match(app, /text: isOff \? "\[" \+ fmtStampAI\(m\.ts\) \+ "\] " \+ line : ""/);
});

// ⚠️v64.93 改了口径（她 2026-09-06：「线上发了 a、线下发生了 b、然后线上 c，
//   他也应该带着线下的记忆」）。原来 anthropic 那条路把 recentChat【整块清空】，
//   理由是「线上原文另发一遍了」——可线下那些拍子【只住在 recentChat 里】，
//   messages 里一条都没有，于是跟着一起被倒掉。
//   现在两条路都走 thinOnline：线上压成一行位置标记、线下留原文。
test("两条路都只瘦掉线上原文，线下一条都不许丢", () => {
  assert.match(app, /ctxFor\(char, \{ chat: true, thinOnline: true \}\)/);
  assert.match(app, /const thinOnline = !!\(ctxOpts && ctxOpts\.thinOnline\);/);
  // 不许再有「整块清空」那条路
  assert.ok(app.indexOf('_singleHistoryLayout ? { ..._roomCtx, recentChat: "" } : _roomCtx') < 0,
    "anthropic 那条路还在把线下一起倒掉");
  assert.match(app, /const _bundleFull = buildBundle\(_roomCtx\);/);
});

test("⚠️不许顺手动『system 从【当前真实时间】劈两半』那条切法", () => {
  // 言秋点名：那是缓存命中的根，当初修了好几天。
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(eng, /const cut = system\.indexOf\("【当前真实时间】"\)/);
  // 【最近对话】必须仍然落在切点【之后】（易变尾），否则这一刀会打进缓存前缀里
  const bb = eng.slice(eng.indexOf("const timeBlock = []"));
  const tIdx = bb.indexOf("parts.push(...timeBlock)");
  const rIdx = bb.indexOf('parts.push("【最近对话】');
  assert.ok(tIdx > 0 && rIdx > tIdx, "【最近对话】跑到时间行前面去了——那会击穿缓存前缀");
});
