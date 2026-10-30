// 双击TA的气泡贴表情（群里 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const c = rd("components.js"), app = rd("app.js"), ts = rd("theme-studio.js");
test("双击认的是同一条的气泡，只给TA的消息开面板", () => {
  assert.match(c, /e\.target\.closest\('\[data-wk="bubble"\]'\)/);
  assert.match(c, /L\.i === at && now - L\.t < 320/);
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
  assert.match(c, /onStickMsg\(stickAt, \{ emoji: e, keyword: e \}\)/);
  assert.match(app, /st\.emoji \? \{ emoji: String\(st\.emoji\)\.slice\(0, 8\) \}/);
  assert.match(ts, /"msgstickemoji"/);
});
test("emoji 能自己打，最近贴过的排前面", () => {
  assert.match(c, /function MsgStickEmojiRow\(\{ onPick \}\)/);
  assert.match(c, /saveJSON\("x_stickEmojiRecent"/);
  assert.match(c, /"data-wk": "msgstickown"/);
  assert.match(ts, /"msgstickown"/);
});
