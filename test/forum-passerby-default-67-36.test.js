// 她 2026-09-12：「论坛现在太多评论都是常驻 npc 了好无聊，说话调调也都一样宝宝你看看」
//
// 两件事其实是同一件：病根在代码，不在提示词写得不够清楚。
//   forumPublicNpcOf 原来的判据是【明确填了 guestName/guestHandle 才算路人】，
//   其余一律走 forumNpcOf，而那一支最后一步是 pool[forumHash(...) % pool.length]——
//   **模型随手写的一条路人，代码会硬指派给一个熟面孔**。
//   于是一帖十几条里大半顶着熟面孔的名字；而那些话本来就是按普通网友写的，
//   只是被盖了个熟面孔的戳——「调调都一样」就是这么来的：名字是熟面孔，声音不是。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 三支真跑起来：它们只用 FORUM_NPC_REGISTRY 和 forumHash
const F = (() => {
  const reg = app.slice(app.indexOf("const FORUM_NPC_REGISTRY = ["), app.indexOf("\n];", app.indexOf("const FORUM_NPC_REGISTRY = [")) + 3);
  // 一支一支地抠，别整段截了再按行过滤——多行函数的中间几行不带关键词，过滤会把它拆碎
  const block = name => {
    const i = app.indexOf("  const " + name + " = ");
    assert.ok(i > 0, "抠不出 " + name);
    const j = app.indexOf("\n  };", i);
    return app.slice(i, j + 5);
  };
  const line = name => {
    const i = app.indexOf("  const " + name + " = ");
    assert.ok(i > 0, "抠不出 " + name);
    return app.slice(i, app.indexOf("\n", i));
  };
  const src = reg + "\n" + [block("forumNpcPool"), block("forumNpcNamed"), block("forumGuestOf"), line("forumPublicNpcOf")].join("\n");
  return new Function("forumHash", src + "\nreturn { forumNpcPool, forumNpcNamed, forumGuestOf, forumPublicNpcOf };")(
    s => { let h = 0; for (let k = 0; k < String(s).length; k++) h = (h * 31 + String(s).charCodeAt(k)) >>> 0; return h; });
})();

// ⭐她报的那一条
test("模型没点名熟面孔的那几条，一律按路人落账", () => {
  const x = { authorName: "键盘上的猫毛", handle: "cat_hair", content: "我也是这样" };
  const who = F.forumPublicNpcOf(x, "日常吧", 3);
  assert.match(who.id, /^npc_guest_/, "又被硬指派成熟面孔了：" + who.name);
  assert.equal(who.name, "键盘上的猫毛", "模型起的名字要留住");
  // 连名字都没给的那种，也照样是路人，不许去名单里抽一个
  const bare = F.forumPublicNpcOf({ content: "同问" }, "日常吧", 7);
  assert.match(bare.id, /^npc_guest_/, "什么都没填就抽一个熟面孔顶上——正是她报的那个");
});

test("点名了就还是那个熟面孔：npcId、handle、名字三种点法都认", () => {
  ["npcId", "npc_id"].forEach(k => {
    const who = F.forumPublicNpcOf({ [k]: "npc_regular_moyu", content: "..." }, "吐槽吧", 1);
    assert.equal(who.id, "npc_regular_moyu", k + " 这种点法不认了");
  });
  assert.equal(F.forumPublicNpcOf({ handle: "@moyu_office", content: "..." }, "吐槽吧", 1).id, "npc_regular_moyu", "@ 前缀要剥掉");
  assert.equal(F.forumPublicNpcOf({ authorName: "摸鱼办主任", content: "..." }, "吐槽吧", 1).id, "npc_regular_moyu");
});

test("点的是【这个吧里没有】的熟面孔，也按路人落账，不许乱认一个", () => {
  // 三楼的猫只在匿名吧
  const who = F.forumPublicNpcOf({ npcId: "npc_anon_thirdcat", authorName: "三楼的猫", content: "..." }, "吐槽吧", 2);
  assert.match(who.id, /^npc_guest_/);
});

test("空的 handle / 空名字不许当成「对上了」", () => {
  // pool 里每个人的 handle 都非空，空串不该匹配上任何人
  const who = F.forumPublicNpcOf({ handle: "", authorName: "", content: "路过" }, "日常吧", 9);
  assert.match(who.id, /^npc_guest_/);
  assert.equal(F.forumNpcNamed({ handle: "", authorName: "" }, "日常吧"), null);
  // ⚠️上面这条成立全靠一个前提：名单里没有空的 handle / name。前提塌了这条就白写。
  F.forumNpcPool("日常吧").concat(F.forumNpcPool("匿名吧")).forEach(n => {
    assert.ok(String(n.handle || "").trim(), "有人没有 handle：" + n.id);
    assert.ok(String(n.name || "").trim(), "有人没有名字：" + n.id);
  });
});

test("同一条评论认出来的路人是稳定的（刷新不会换个名字）", () => {
  const x = { guestName: "空调外机下面", guestHandle: "ac_unit", content: "笑死" };
  const a = F.forumPublicNpcOf(x, "吐槽吧", 4), b = F.forumPublicNpcOf(x, "吐槽吧", 4);
  assert.deepEqual(a, b);
  assert.notEqual(F.forumPublicNpcOf(x, "吐槽吧", 5).id, a.id, "换一楼就该是另一个 id，不然楼和楼会串");
});

// 她 2026-09-12（v67.36 当天）：「那你实测路人名字也太像了吧，
//   以前大家都很有灵气的 id 好玩说的话也很活人」——v67.36 我在兜底里摆了一张
//   「前缀×名词」的表，那张表就是她说的八股，只不过是我写的：换几个词，骨架一模一样。
//   所以这一条反过来钉：**代码这一手不许再假装自己会起名字**。
test("兜底名字是系统默认账号的样子，不是一张凑名字的表", () => {
  // ⚠️「路过的人」那个字符串还在，但它是 hash 的种子、不是给人看的名字——
  //   所以这条钉的是【给人看的那两行】，不是全文搜词。
  assert.match(A, /const name = String\(\(x && \(x\.guestName \|\| x\.authorName\)\) \|\| \("网友" \+ hh\.toString\(36\)\.slice\(-4\)\)\);/);
  assert.match(A, /const handle = String\(\(x && \(x\.guestHandle \|\| x\.handle\)\) \|\| \("u_" \+ hh\.toString\(36\)\)\)/);
  assert.ok(!/const GN = \[|const GP = \[/.test(A), "又在代码里摆名词表了");
  const names = [];
  for (let i = 0; i < 40; i++) names.push(F.forumPublicNpcOf({ content: "第" + i + "条" }, "日常吧", i).name);
  names.forEach(n => assert.match(n, /^网友[0-9a-z]{1,4}$/, "兜底名字长得像个真名字，会和模型起的混在一起：" + n));
  assert.ok(new Set(names).size >= 36, "四十条兜出的 id 撞了太多：" + new Set(names).size);
  // 模型给了名字就一个字都不许改
  assert.equal(F.forumPublicNpcOf({ guestName: "隔壁装修队队长", guestHandle: "drill_all_day", content: "..." }, "日常吧", 1).name, "隔壁装修队队长");
  assert.equal(F.forumPublicNpcOf({ authorName: "三点半的咖啡机", content: "..." }, "日常吧", 1).name, "三点半的咖啡机");
});

// ── 人少才是「调调都一样」的另一半 ────────────────────────────
// 下限不是拍的：一批最多 18 条、熟面孔「最多不过一半」＝最多 9 条、
// 同一个熟面孔「最多冒两次」→ 至少要有 5 个人才摊得开。匿名吧那一套是另开的四位。
test("每个吧都得有够多的熟面孔，两三个人撑不起一帖十几楼", () => {
  ["吐槽吧", "日常吧", "求助吧", "兴趣吧", "脑洞吧"].forEach(b => {
    const n = F.forumNpcPool(b).length;
    assert.ok(n >= 5, "「" + b + "」只有 " + n + " 个常驻，摊在一帖十几楼上怎么写都是一个调调");
  });
  assert.ok(F.forumNpcPool("匿名吧").length >= 4);
  // 匿名吧不许被别的吧的人混进来（那几位是另一套身份）
  assert.ok(F.forumNpcPool("匿名吧").every(n => (n.boards || []).includes("匿名吧")));
  assert.ok(F.forumNpcPool("吐槽吧").every(n => !(n.boards || []).includes("匿名吧")));
});

test("没列进名单的吧，兜底给的是全部非匿名熟面孔", () => {
  const p = F.forumNpcPool("搜索");
  assert.equal(p.length, 10);
  assert.ok(p.every(n => !(n.boards || []).includes("匿名吧")));
});

// ── 提示词那一头：两边给一样的具体度 ──────────────────────────
test("路人是默认那一头，而且和熟面孔一样具体", () => {
  const i = A.indexOf("【论坛人口】");
  assert.ok(i > 0, "那一段没了");
  const blk = A.slice(i, i + 700);
  assert.match(blk, /大半是只在这一帖出现的路人/, "默认那一头还是熟面孔");
  assert.match(blk, /填 guestName、guestHandle/);
  assert.match(blk, /一人一个来路/, "路人的 id 没给判据，它就会凑一张表出来");
  assert.match(blk, /同一批里别长成一个模子/);
  assert.match(blk, /说的话也得是活人说的/, "她那句「说的话也很活人」得有个落点");
  assert.match(blk, /大约三分之一、最多不过一半/, "比例没说死，模型会照老习惯来");
  assert.match(blk, /没写 npcId 的一律按路人落账/, "代码改了规矩却不告诉它，它还以为写不写都一样");
  assert.ok(blk.indexOf("约六成发言来自固定熟面孔") < 0, "老那句还在");
  assert.ok(blk.indexOf("其余约四成可以是") < 0, "「可以是」那种软说法还在——两头具体度不对等正是病根之一");
});

test("同一个熟面孔不许在一批里刷屏", () => {
  const i = A.indexOf("【论坛人口】");
  assert.match(A.slice(i, i + 700), /同一批里同一个熟面孔最多冒两次/);
});

// ⚠️别再把「点不上就抽一个」写回去
test("代码里不许再有「抽一个熟面孔顶上」那一步", () => {
  assert.ok(A.indexOf("pool[forumHash(") < 0, "那一步又长回来了——它保证的恰恰是坏结果");
  assert.equal((A.match(/const forumPublicNpcOf = /g) || []).length, 1);
  assert.match(A, /const forumPublicNpcOf = \(x, board, salt\) => forumNpcNamed\(x, board\) \|\| forumGuestOf\(x, salt\);/);
  const i = app.indexOf("const forumPublicNpcOf = ");
  const doc = app.slice(Math.max(0, i - 900), i);
  assert.match(doc, /代码会硬指派给一个熟面孔/, "病历要留着，别让下一个人又改回去");
  assert.match(doc, /2026-09-12/);
});

test("六个落点全走同一支，别有哪一处绕过去", () => {
  // 定义那一行是 `= (x, board, salt) =>`，名字后面带空格，不会被这条数进来
  assert.equal((A.match(/forumPublicNpcOf\(/g) || []).length, 6, "主帖/评论/楼中楼/追评/楼层展开/搜索，六处都得走它");
  assert.ok(A.indexOf("forumGuestOf(x, salt) : forumNpcOf") < 0, "老那条三元判断还在");
});

// 五处 schemaHint 里那两栏是同一层（施工规则/one-public-mechanism.md）
test("路人那两栏的说明只写一份，五处 schemaHint 共用", () => {
  assert.match(A, /const FORUM_GUEST_FIELDS = /);
  assert.equal((A.match(/FORUM_GUEST_FIELDS/g) || []).length, 6, "一处定义、五处 schemaHint 各取一次");
  assert.ok(A.indexOf('\\"guestHandle\\":\\"路人id\\"') < 0, "还有哪一处留着自己那份");
  // 占位值要写【说明】不写【样例内容】——摆一个具体网名会被逐字照抄
  const m = app.match(/const FORUM_GUEST_FIELDS = "([^;]+)";/);
  assert.ok(m, "抠不出那一份");
  assert.match(m[1], /像真人自己起的，不是占位名/);
  assert.match(m[1], /和网名是一路的/, "handle 和网名对不上就会看出是两套东西拼的");
});
