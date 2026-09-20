// 线下归档总结丢上文（她 2026-09-20 转来的：「总结太长了会丢一些上文，基本上后半段的剧情，
// 5w 字左右」）。
//
// v68.x 为了治「整场塞进去撞输入上限、整场一个字都没记进记忆库」，把喂进总结的那一段改成
// 【只要最后 24000 字 + 一份被压过的前情提要】。代价就是她转来的这条：前半截只剩一层影子。
//
// 她 2026-09-20 拍的是 A：分段跑。整场按 24000 字切块，每块各出一份，再合成一份最终的。
// 「按次收费跟这个没有关系，以后也不要想着省钱」——所以不挑段、不截尾。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

function grab(name, end) {
  const i = eng.indexOf("function " + name);
  const j = eng.indexOf(end, i);
  assert.ok(i > 0 && j > i, "抠不出 " + name);
  return eng.slice(i, j);
}

test("整场原样交出去，不再切尾巴", () => {
  const src = grab("offlineSummarySource", "// 按行切块");
  assert.ok(!/transcriptTail/.test(src), "还在切尾巴——切了就等于前半截没人看过");
  assert.match(src, /\(sess\.msgs \|\| \[\]\)\.filter\(m => !isOocMsg\(m\)\)\.map\(toLine\)\.join/, "整场那一份没了");
});

test("按行切块，一行都不许劈开", () => {
  const fn = grab("offlineSummaryChunks", "// 场次越长");
  const chunks = new Function("OFFLINE_SUM_FED_CAP", fn + "; return offlineSummaryChunks;")(24000);
  const lines = [];
  for (let i = 0; i < 300; i++) lines.push("第" + i + "行：" + "字".repeat(200));
  const text = lines.join("\n");
  const out = chunks(text, 24000);
  assert.ok(out.length >= 2, "该切成好几块的没切");
  // 一个字都不许丢
  assert.strictEqual(out.join("\n").length, text.length, "切完总字数对不上——丢字了");
  // 每一块都不该超过上限太多（单行超长那一种除外）
  out.forEach(c => assert.ok(c.length <= 24000 + 210, "有一块超出上限：" + c.length));
  // 行没被劈开：每块的首尾都得是完整的一行
  out.forEach(c => { assert.match(c.split("\n")[0], /^第\d+行：/, "从行中间切开了"); });
  // 单独一行就超长：它自己占一块，不硬切
  const one = chunks("短行\n" + "长".repeat(30000), 24000);
  assert.ok(one.some(c => c.length >= 24000), "超长的那一行被劈了");
});

test("额度跟着场次长度走，不再是写死的 1~3 句 / 6 条", () => {
  const fn = grab("offlineSummaryQuota", "async function offlineSummaryCall");
  const quota = new Function(fn + "; return offlineSummaryQuota;")();
  assert.deepStrictEqual(quota(5000), { sents: "1~3 句", details: 6, open: 6 }, "短场次的分寸被改大了");
  assert.ok(quota(50000).details > 6, "五万字还是只留 6 条细节");
  assert.ok(quota(200000).details > quota(50000).details, "二十万字该留得更多");
  assert.notStrictEqual(quota(200000).sents, quota(5000).sents, "句数没跟着长度走");
});

test("分段那一枪要知道自己只是一截，合成那一枪要知道自己读的是几段总结", () => {
  const fn = grab("offlineSummaryPartLine", "const OFFLINE_SUM_FED_CAP");
  const line = new Function(fn + "; return offlineSummaryPartLine;")();
  assert.strictEqual(line(null, "Lisa"), "", "整场一枪不该多这句");
  const part = line({ i: 2, n: 3 }, "Lisa");
  assert.match(part, /第 2 段（共 3 段）/, "没告诉它在看第几段");
  assert.match(part, /不是整场/, "不说的话每段都会被写成一份「整场总结」");
  assert.match(line("merge", "Lisa"), /串成一条线/, "合成那一枪没说清楚要干什么");
  assert.match(line("merge", "Lisa"), /别只复述最后一段/, "没挡住「只写最后一段」这个最顺手的偷懒");
});

test("单人和群线下都走同一条路（four-surfaces：一层写在两处，第二处要跟上）", () => {
  const calls = eng.match(/return await offlineSummaryRun\(p, systemFor, text\);/g) || [];
  assert.strictEqual(calls.length, 2, "只有 " + calls.length + " 处走分段跑，另一处还在老路上");
  // 两处都不许再自己打那一枪
  // 「整场经过」只许从一个地方发出去：共用的 offlineSummaryCall。多一处就是又开了一条老路。
  const sends = eng.match(/content: "【线下经过】/g) || [];
  assert.strictEqual(sends.length, 1, "有 " + sends.length + " 处在发整场经过，公共那一份之外还有别的路");
  assert.ok(eng.indexOf("content: \"【线下经过】") > eng.indexOf("async function offlineSummaryCall"),
    "发整场那一句不在公共那一份里");
});

test("合成失败也得留下东西，别整场白跑", () => {
  const run = grab("offlineSummaryRun", "async function summarizeOffline");
  assert.match(run, /merged\.summary \|\| joined/, "合成那一枪失败就什么都不剩了");
  assert.match(run, /catch \(e\) \{\}/, "合成那一枪抛错会把前面几枪一起带走");
});

test("两道静默的截断都放宽了，而且留记号", () => {
  // ① 滚动前情提要攒的那一份（原来写死 .slice(-4000)，静默）
  assert.match(app, /const OFF_PRE_CAP = 16000;/, "前情提要上限没放宽");
  assert.match(app, /console\.warn\("线下前情提要被截："/, "截掉了还是不留痕");
  assert.match(app, /OFF_PRE_MARK \+ "\\n" \+ s\.slice/, "截了没在正文里留记号");
  assert.ok(!/\.slice\(-4000\), lastSummarizedCount/.test(app), "老的那个写死 4000 还在");
  // ⚠️群线下那一份是照着单人抄的，单人改了它必须跟上（one-public-mechanism.md）
  const caps = app.match(/offlinePreCap\(/g) || [];
  assert.strictEqual(caps.length, 2, "单人和群线下要各用一次公共那把尺，现在是 " + caps.length + " 处");
  // ② 喂进 prompt 前的第二道（原来 .slice(-1200)，同样静默）
  assert.ok(!/String\(active\.summary\).trim\(\) : ""\)\.slice\(-1200\)/.test(app), "第二道静默截断还在");
  assert.match(app, /〔这一场更早的前情提要太长，下面是靠后的一段〕/, "第二道截断没留记号");
});
