// 她 2026-09-04 一口气报了四件：
//  ①「为啥基本上没有人会撤回自己说的话」
//  ②「现在我撤回啥也会直接主动触发他聊天」
//  ③「语音挂断后的 summary 也是灰的在 line 皮肤看不见」
//  ④「有些角色的 Ta 眼里确实一直不显示上次什么时候想过，没改」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const gaze = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const ts = fs.readFileSync(path.join(root, "js/theme-studio.js"), "utf8");
const core = fs.readFileSync(path.join(root, "js/core.js"), "utf8");

// ── ① 没人撤回 ────────────────────────────────────────────────────────────
// 病根不是模型不肯，是这个能力在 Protocol v2 里【只剩一个类型签名】。
// 旁边 gift/photo/call/voice/moment 都在【能力使用总则】里被点名鼓励过
//（「想到了就大方用」），recall 一个字都没有——它只在字段字典里躺着。
// 这就是 four-surfaces-same-context.md 那条：一层规则只作为类型存在，
// 等于没有；老的 _normalTaskFull 里那段用法在换协议时【没跟过来】。
test("撤回在能力总则里被点了名，不是只有一个类型签名", () => {
  const i = app.indexOf("【能力使用总则】");
  assert.ok(i > 0, "找不到能力使用总则");
  const g = app.slice(i, app.indexOf("【能力字段字典】", i));
  assert.match(g, /recall/, "总则里点名鼓励了 gift/photo/call/voice/moment，唯独没有 recall");
});

test("撤回的理由写的是【日常】那几种，不是只有「后悔、说漏嘴」", () => {
  // 只写戏剧性的触发条件，等于把这个能力锁在罕见情绪里——它当然几乎不发生。
  // 真人撤回多半是打错字、发漏了、手滑发重、语气重了、发错人。
  const i = app.indexOf("【能力使用总则】");
  const g = app.slice(i, app.indexOf("【能力字段字典】", i));
  assert.match(g, /recall 可用于日常纠错或调整已发消息/);
  assert.match(g, /不限于后悔、说漏嘴/);
  assert.match(g, /需要补发时写入 word/);
});

test("群聊那份也一起改了（一层写在两处，第二处别再落下）", () => {
  const i = app.indexOf('\\"recall\\":true');
  assert.ok(i > 0, "群聊那条 recall 说明没了");
  const g = app.slice(i - 200, i + 700);
  const mundane = ["打错字", "发漏", "发重", "说重"];
  assert.ok(mundane.filter(w => g.includes(w)).length >= 3, "群聊那份还是只写「后悔」");
  assert.doesNotMatch(g.slice(0, 500), /又后悔、想撤回/, "群聊那句旧措辞还在");
});

// ── ② 我一撤回就触发他聊天 ────────────────────────────────────────────────
test("撤回不再当场单独调一次模型", () => {
  assert.doesNotMatch(app, /reactToMyRecall\s*=/, "那个函数又回来了");
  assert.doesNotMatch(app, /reactToMyRecall\(/, "还有人在调它");
  // 撤回那一下只改本地数据，不许在这儿起调用
  const i = app.indexOf('} else if (act === "recall") {');
  assert.ok(i > 0, "找不到单聊撤回那一段");
  const seg = app.slice(i, i + 900);
  assert.doesNotMatch(seg, /callAI|replyNow|startLane/, "撤回那一下又去调模型了");
  assert.match(seg, /recalledTs: Date\.now\(\)/, "没记撤回的时刻，就没法判他看没看到");
});

test("撤回留在历史原位：他知道撤过一条（她 2026-10-01：「撤回他不知道我撤回了」）", () => {
  const i = app.indexOf("const recallStub = (m, inGroup) => {");
  assert.ok(i > 0, "没有 recallStub");
  const seg = app.slice(i - 200, i + 1200);
  assert.match(seg, /const RECALL_SEEN_MS = \d+;/, "没有那道时间闸");
  assert.match(seg, /const seen = !\(Number\(m\.recalledTs\) && gap >= 0 && gap < RECALL_SEEN_MS\)/);
  // 原文只挂在 seen 那一支上；没看清那一支是一句写死的话
  assert.match(seg, /content: seen && m\.content\s*\n?\s*\? "【[^"]*" \+ who \+ "[^"]*" \+ String\(m\.content\)[^\n]*\n\s*: "【[^"]*" \+ who \+ "[^"]*" \};/,
    "两支的形状不对：要么原文没挂在 seen 上，要么「没看清」那一支拼了东西进去");
  assert.match(app, /const history = base\.map\(m => \(m && m\.recalled && m\.role === "user"\) \? recallStub\(m\) : \(m && m\.kind === "loveletter"\) \? _letterRow\(m\) : (?:_letterAns\(m\) \? _ansRow\(m\) : )?m\)/);
  // 群聊也接上，而且群里撤回记下 recalledTs（她 2026-10-01）
  assert.ok(app.includes("? recallStub(m, true) : m)"));
  assert.ok(app.includes("recalled: true, recalledTs: Date.now(), origText: x.content"));
  assert.match(app, /const RECALL_SEEN_MS = 10000;/);
  // 末尾那句「多数时候当没看见」撤掉了：同一件事不说两遍
  assert.ok(app.includes('const _recallHint = "";'));
});

// ── ③ 挂断小结在皮肤上看不见 ──────────────────────────────────────────────
test("居中那几行系统小字都挂上了点", () => {
  // 撤回 / 已撤回点看 / 已读不回 / 拍一拍 / 挂断回执 / 挂断小结，单聊群聊都算
  assert.ok((comp.match(/"data-wk": "note"/g) || []).length >= 7,
    "note 挂点只有 " + (comp.match(/"data-wk": "note"/g) || []).length + " 处");
  const pill = comp.slice(comp.indexOf("function CallEndPill("), comp.indexOf("function CallShotThumb("));
  assert.match(pill, /"data-wk": "note"/, "挂断回执那颗药丸没挂点");
  assert.match(pill, /m\.sum && !open \? h\("div", \{ "data-wk": "note"/, "挂断小结那一行没挂点——她报的就是这一行");
  assert.match(pill, /wk: "noteink"/, "回执里那个话筒图标没挂点，皮肤一换它还是灰的");
  // 图标的挂点得能透下去：收得下【而且】真的递给了 Svg——少哪一半都等于没挂
  const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
  const pg = phone.slice(phone.indexOf("function PGlyph({"), phone.indexOf("function PGlyph({") + 9000);
  assert.match(pg, /color = "#1b1a17",\n\s*wk\n\}\)/, "PGlyph 收不了挂点");
  assert.match(pg, /return h\(Svg, \{\n\s*size,\n\s*color,\n\s*wk,/, "PGlyph 收下了却没递给 Svg");
});

test("系统小字有自己那一档字色，不跟时间条共用", () => {
  // 时间条是【扫一眼就过】的四个字，各家真实配色本来就淡（微信 #b2b2b2 压在
  // #ededed 上只有 1.8）；通话小结是【要读的一句话】，照抄那个淡度等于没修。
  assert.match(ts, /\[data-wk="note"\] \{/);
  assert.match(ts, /background: ' \+ o\.noteBg/);
  assert.match(ts, /color: ' \+ o\.noteInk/);
  assert.match(ts, /svg\[data-wk="noteink"\] \{ stroke: ' \+ o\.noteInk/);
  assert.doesNotMatch(ts.slice(ts.indexOf('[data-wk="note"] {'), ts.indexOf('[data-wk="note"] {') + 400), /o\.timeInk/,
    "系统小字又去用时间条那档灰了");
});

// ── ④ Ta 眼里不显示上次什么时候想过 ──────────────────────────────────────
test("每一块都说得出上次什么时候被碰过", () => {
  // 原来这一行【只在复看过又没改时】才出现，而「复看没改」要模型主动填
  // impressionChecked，本来就少；只写过一次、从没被复看的块（绝大多数）
  // 这里一个字都没有——看着就像这一块没有时间。时间本来就在 b.ts 里。
  const i = gaze.indexOf("这一块【上次什么时候被碰过】");
  assert.ok(i > 0, "那段说明没了");
  const seg = gaze.slice(i, i + 1400);
  assert.match(seg, /var checked = ck > \(b\.ts \|\| 0\);/);
  assert.match(seg, /var when = checked \? ck : \(Number\(b\.ts\) \|\| 0\);/, "没复看过时不回落到写入时刻");
  assert.match(seg, /ago \+ \(checked \? "又想了一遍 · 没改" : "写的"\)/);
  assert.doesNotMatch(seg, /if \(!ck \|\| ck <= /, "旧的「没复看就什么都不显示」还在");
});

test("沙盒房不许往主线那张卡写「他又想了一遍」", () => {
  // 只封 impression 是漏了半边：impressionChecked 不改内容，却照样写 checks。
  const gates = [...app.matchAll(/parsed\.impression = null/g)];
  assert.ok(gates.length >= 3, "印象卡的闸只剩 " + gates.length + " 道");
  for (const g of gates) {
    const around = app.slice(g.index - 40, g.index + 200);
    assert.match(around, /parsed\.impressionChecked = null/,
      "这一道闸只封了 impression，没封 impressionChecked：\n" + around.slice(0, 160));
  }
});
