// 心上架构的最后一条：共生【从真实共同活动里长】，不照抄那份文档的第三块。
//
// 那份参考文档第三块叫「欲望共生」：记用户的兴趣 → 找共同点 → 说一句
// 「我最近也想试试这个，要不我们一起？」。本质是个轻用户画像。
// ⚠️我们不照做：这个 app 里【已经有真发生过的共同活动】——唱片架、一起读、
//   一起学、你俩的时间线。从真做过的事里长，比从一张兴趣表里长既更准，
//   也彻底不是那份文档。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const heart = fs.readFileSync(path.join(root, "js/heart.js"), "utf8");

const mk = store => {
  const i = app.indexOf("  const togetherLines = char => {");
  const j = app.indexOf("  const ambientMaterialFor");
  assert.ok(i > 0 && j > i, "抠不出 togetherLines");
  return new Function("loadJSON", app.slice(i, j) + "\nreturn togetherLines;")(
    (k, d) => (store && k in store ? store[k] : d));
};
const now = Date.now(), D = 86400000;
const FULL = {
  x_coupleDisc: { c1: { songs: [{ title: "漠河舞厅", note: "走夜路那首" }, { title: "晚安晚安" }, { title: "白露" }] } },
  x_read_books: [{ title: "献给阿尔吉侬的花束", partnerId: "c1", lastReadTs: now - 2 * D },
                 { title: "别人的书", partnerId: "c9", lastReadTs: now - D }],
  x_study_sessions: [{ charId: "c1", subject: "法语动词变位", ts: now - 3 * D },
                     { charId: "c1", subject: "法语动词变位", ts: now - 5 * D },
                     { charId: "c9", subject: "不该出现的", ts: now }],
  // ⚠️别人的那条故意排最前：旧代码查的是不存在的 x.charId，谁都放行、正好取走第一条——
  //   这条断言就是要踩中它。第二条是没有归属字段的旧形状（当旧全局放行）；
  //   真实写入路径（addTimelineEvent / leaveInCoupleSpace）产出的一律带 characterId。
  x_coupleTimeline: [{ characterId: "c9", title: "别人的时间线" },
                     { text: "她把钥匙给了我" }]
};
const out = mk(FULL)({ id: "c1", name: "沈屿白" });

test("只列真一起做过的，别人的一条都不许串进来", () => {
  assert.match(out, /漠河舞厅/);
  assert.match(out, /献给阿尔吉侬的花束/);
  assert.match(out, /法语动词变位/);
  assert.match(out, /她把钥匙给了我/);
  assert.ok(!out.includes("别人的书"), "串进了别的角色的书（partnerId 没筛）");
  assert.ok(!out.includes("不该出现的"), "串进了别的角色的一起学（charId 没筛）");
  assert.ok(!out.includes("别人的时间线"), "串进了别的角色的时间线（characterId 没筛——它存的是 characterId 不是 charId）");
});

test("⚠️每一样各留各的位子，不许一样把名额占满", () => {
  // 唱片架动辄三十首。先各取几条再统一截 6 的话，排在后面的时间线、
  // 一起学永远轮不上（第一版就是这样，跑出来一看时间线根本没进去）。
  const many = JSON.parse(JSON.stringify(FULL));
  many.x_coupleDisc.c1.songs = [...Array(30)].map((_, i) => ({ title: "歌" + i }));
  const s = mk(many)({ id: "c1" });
  assert.ok(s.includes("她把钥匙给了我"), "时间线被唱片架挤没了");
  assert.ok(s.includes("法语动词变位"), "一起学被挤没了");
  assert.ok((s.match(/你往你俩的唱片上刻过/g) || []).length <= 2, "唱片架占的位子超过 2 条");
});

test("说清它是土壤不是任务——不然每天都会硬凑一条", () => {
  assert.match(out, /【土壤】不是【任务】/);
  assert.match(out, /多数日子想不起来就算了/);
  // 长出来的该是「一起再做点什么」，不是把这件事复述一遍
  assert.match(out, /想跟她一起再做点什么/);
  assert.match(out, /不是把这件事复述一遍/);
});

test("没有共同活动就一个字都不发；存档坏了也不许把发呆弄挂", () => {
  assert.equal(mk({})({ id: "c1" }), "", "没数据时不该发空壳标题");
  assert.equal(mk(FULL)(null), "", "没角色时也不许炸");
  const withLoader = loader => {
    const i = app.indexOf("  const togetherLines = char => {");
    const j = app.indexOf("  const ambientMaterialFor");
    return new Function("loadJSON", app.slice(i, j) + "\nreturn togetherLines;")(loader);
  };
  assert.equal(withLoader(() => { throw new Error("坏了"); })({ id: "c1" }), "", "全坏时要静默降级");
});

test("⚠️一样读坏了，不许把别的几样一起丢掉", () => {
  // 变异测试抓出来的：原来是整段一个 try——一起读的存档一坏，
  // 唱片架那几条也跟着没了。一样一样各自兜底才对。
  const i = app.indexOf("  const togetherLines = char => {");
  const j = app.indexOf("  const ambientMaterialFor");
  const partial = new Function("loadJSON", app.slice(i, j) + "\nreturn togetherLines;")(
    (k, d) => { if (k === "x_read_books") throw new Error("这一样坏了"); return (k in FULL ? FULL[k] : d); });
  const s = partial({ id: "c1" });
  assert.match(s, /漠河舞厅/, "一起读坏了，把唱片架也一起丢了");
  assert.match(s, /她把钥匙给了我/, "后面几样没接着跑");
  assert.ok(!s.includes("阿尔吉侬"), "坏掉那一样不该有内容");
  assert.match(app, /const grab = fn => \{ try \{ fn\(\); \} catch/, "不是一样一样兜底");
});

test("接进发呆，而且【不新增来源枚举】", () => {
  assert.match(app, /HeartKit\.museSpec\(char, box, \{ together: togetherLines\(char\) \}\)/, "没接进发呆");
  assert.match(heart, /function museSpec\(char, box, opts\)/);
  assert.match(heart, /briefsTxt\(box\) \+ avoidTxt\(box\) \+ together \+/, "收下了但没拼进提示词");
  assert.match(heart, /也算这样的土壤/, "铁网那句没说共同活动也算合法土壤");
  // ⚠️共同活动【就是旧事】，走已有的 echo。加一个 source 值就要动存档
  //   （老数据读不回来），而它并没有换来任何新语义。
  const srcVals = (heart.match(/source: *['"](\w+)['"]/g) || []);
  assert.ok(!heart.includes('"together"') && !heart.includes("'together'"),
    "新增了 together 来源——共同活动就是旧事，该走 echo，加枚举要动存档");
});
