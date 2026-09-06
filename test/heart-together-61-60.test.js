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
// ⚠️桩数据必须照【真存档】写，不许照代码编（v62.14 血的教训，见文件末尾那两条）。
//   一起学：js/study.js 存的是 { character_ids:[], teacher_id, subject, created_at, updated_at }
//   时间线：js/app.js addTimelineEvent 存的是 { characterId, date, type, title, content, createdAt }
const FULL = {
  x_coupleDisc: { c1: { songs: [{ title: "漠河舞厅", note: "走夜路那首" }, { title: "晚安晚安" }, { title: "白露" }] } },
  x_read_books: [{ title: "献给阿尔吉侬的花束", partnerId: "c1", lastReadTs: now - 2 * D },
                 { title: "别人的书", partnerId: "c9", lastReadTs: now - D }],
  // ⚠️旧的那门【排在前面】：一起学只取最近一门，排序真的按时刻走才会挑中「法语动词变位」。
  //   照数组顺序（＝时刻字段读错、sort 全是 undefined）的话，挑中的会是「很久以前学的那门」。
  x_study_sessions: [{ character_ids: ["c1"], teacher_id: null, subject: "很久以前学的那门", created_at: now - 200 * D, updated_at: now - 200 * D },
                     { character_ids: ["c1"], teacher_id: null, subject: "法语动词变位", created_at: now - 3 * D, updated_at: now - 3 * D },
                     { character_ids: ["c9"], teacher_id: null, subject: "不该出现的", created_at: now, updated_at: now }],
  // 陆闻那条排在最前：数组是新的在前，旧代码只取第 1 条又不筛人，所以正好会端上它
  x_coupleTimeline: [{ characterId: "c9", title: "陆闻的私事", content: "不该被沈屿白说出来" },
                     { characterId: "c1", title: "她把钥匙给了我", content: "那天下着雨" }]
};
const out = mk(FULL)({ id: "c1", name: "沈屿白" });

test("只列真一起做过的，别人的一条都不许串进来", () => {
  assert.match(out, /漠河舞厅/);
  assert.match(out, /献给阿尔吉侬的花束/);
  assert.match(out, /法语动词变位/);
  // 只取最近学的那一门，而且日期得算对（时刻字段读错的话这两条都会歪）
  assert.ok(!out.includes("很久以前学的那门"), "一起学没按时刻排——挑中的是最旧那门");
  assert.match(out, /一起学过『法语动词变位』（3天前）/);
  assert.match(out, /她把钥匙给了我/);
  assert.ok(!out.includes("别人的书"), "串进了别的角色的书（partnerId 没筛）");
  assert.ok(!out.includes("不该出现的"), "串进了别的角色的一起学（没按 character_ids 认人）");
  // ⚠️这一条是隐私围栏，不是文案：v62.14 之前时间线按 x.charId 筛，而真字段叫 characterId，
  //   于是 !x.charId 对每条都成立、又只取第 1 条 → 谁发呆都会端上全库最新那一条。
  //   她昨天跟陆闻记的里程碑，今天会从沈屿白嘴里说出来。
  assert.ok(!out.includes("陆闻的私事"), "串进了别人的恋爱时间轴（characterId 没筛）");
  assert.ok(!out.includes("不该被沈屿白说出来"), "同上");
});

// 这一条立成了规矩：施工规则/stub-from-the-writer.md
// v62.14：这四样里有两样的字段名是【照着我以为的样子】写的，从没对着真存档验过；
// 而这个文件的桩数据又是照着那份代码编的——于是测试和代码一起错，一路绿到线上。
// 一起学那条更狠：它【从上线起就一次都没出现过】，而测试一直是绿的。
// 所以下面这条把桩钉死在【真正写入那份存档的那段代码】上：写的人改了字段名，这里就红。
test("⚠️桩数据必须跟真正写存档的那段代码对得上（照代码编桩＝测试和代码一起错）", () => {
  const study = fs.readFileSync(path.join(root, "js/study.js"), "utf8");
  assert.match(study, /character_ids: \(cur\.character_ids \|\| \[\]\)\.slice\(\)/, "一起学存的不再是 character_ids");
  assert.match(study, /created_at: Date\.now\(\), updated_at: Date\.now\(\)/, "一起学存的时刻字段变了");
  assert.doesNotMatch(study.slice(study.indexOf("const sess = {"), study.indexOf("saveSessions(loadSessions().concat([sess]))")),
    /\bcharId\b/, "一起学又长出 charId 了？那就回去重看这一条");
  assert.match(app, /characterId: char\.id, date: date, type: "里程碑", title: title\.trim\(\), content:/,
    "时间线存的不再是 characterId / title / content");
  // 读的那一头也必须是同一批名字
  // 注释里当然要提这两个坏字段（写着它们为什么坏），判的是【真代码】
  const seg = app.slice(app.indexOf("  const togetherLines = char => {"), app.indexOf("  const ambientMaterialFor"))
    .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(seg, /String\(x\.characterId \|\| ""\) === String\(char\.id\)/, "时间线又按不存在的字段筛了");
  assert.match(seg, /A\(x\.character_ids\)\.some\(id => String\(id\) === String\(char\.id\)\)/, "一起学又按不存在的字段筛了");
  assert.doesNotMatch(seg, /x\.charId|x\.text\b/, "又回到了那两个从来不存在的字段");
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
