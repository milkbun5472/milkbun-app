// 她 2026-09-17 拿来一份别人的世界书问「有没有我们能参考的」。
// 大部分不该抄——那份里「绝对禁止」出现了四十多次，正是 施工规则/bans-make-it-dumber.md
// 要防的写法（她原话：「一堆禁令会变笨的」）。捞回来的只有这一条：
//
//   **【别说线上兑现不了的话】**「我在这儿」「我陪着你」「有我呢」——
//   隔着屏幕这几句什么都没发生，它只是一个温暖的形状。
//
// ⚠️为什么要单开一条（先查「已经有人管了吗」，bans-make-it-dumber ①）：
//   · STOCK_REPLY_BAN 挡的是「关心＋方案＋马上过去」那个三拍模板；
//   · OVERREACH_BAN 挡的是【揽了自己接不住的活】；
//   · 这一条挡的是【压根没许诺任何东西】——连"揽"都算不上，那两条一个都盖不住。
//
// ⚠️第一版我在里面写了一句正面例句，她当场指出「这不也是 example 吗」——对的。
//   被禁的那几句可以留（那是点名这一族），**正面例句才是会被逐字抄走的那一个**
//   （施工规则/prompt-no-content-samples.md）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.join(__dirname, "..", f);
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const app = fs.readFileSync(P("js/app.js"), "utf8");
const fic = fs.readFileSync(P("js/fanfic.js"), "utf8");
const BAN = (eng.match(/const EMPTY_COMFORT_BAN = `([\s\S]*?)`;/) || [])[1] || "";

test("这一条存在，而且是【判据】不是【台词】", () => {
  assert.ok(BAN, "常量没了");
  assert.match(BAN, /这句话说完，对方手上多了什么？/, "判据那一句是这条的骨头");
  // 被禁的那几句留着：点名这一族，不是给模板
  ["我在这儿", "我陪着你", "有我呢"].forEach(x => assert.ok(BAN.includes(x), "少了一句：" + x));
});

test("没有正面例句——那是会被逐字抄走的那一个", () => {
  // 她抓到的就是这个：我原来写了「我不知道该说什么，但我在看」
  assert.ok(!/我不知道该说什么/.test(BAN), "正面例句又回来了");
  // 判据：把引号里的话逐字抄走，是对的还是错的？
  // 这一条里带引号的短句必须【全是被禁的那一族】，不许出现"该这么说"的示范
  const quoted = [...BAN.matchAll(/「([^」]+)」/g)].map(m => m[1]);
  assert.ok(quoted.length >= 3, "被禁那一族得点够名");
  quoted.forEach(q => assert.ok(BAN.indexOf("「" + q + "」") < BAN.indexOf("判据一句话"),
    "「" + q + "」出现在判据之后，读起来会像示范"));
});

test("禁的是模子不是尺度——结尾那句不许删", () => {
  // 不写这句的话它会被读成「要更热情」，方向正好走反
  assert.match(BAN, /一个字都不管你该多热情，只管别端出一句空的/);
  // 也不许用判决式收尾（bans-make-it-dumber：「删掉重说」那种会让模型绕开整个话题）
  ["删掉重说", "整句删掉", "禁止出现"].forEach(x =>
    assert.ok(!BAN.includes(x), "判决式收尾：" + x));
});

// ── 四处一样喂 · 八处都得接上 ────────────────────────────────
// ⚠️判据（施工规则/four-surfaces-same-context.md）：这一处是靠【打包函数白送的】，
//   还是靠【调用点一条条 push 的】？后者换个入口就一条都没有，而且 grep 不出痕迹。
test("群那几处：走 groupBans（群线上 / 群线下 / 群通话 / 群投票）", () => {
  const gb = eng.slice(eng.indexOf("function groupBans(opts)"), eng.indexOf("const GROUP_USER_IS_PRESENT"));
  assert.match(gb, /P\.push\(EMPTY_COMFORT_BAN\);/);
  // 跟 OVERREACH_BAN 同进同出——它俩是一族，漏一处就整族回来
  assert.ok(gb.indexOf("P.push(OVERREACH_BAN)") < gb.indexOf("P.push(EMPTY_COMFORT_BAN)"));
  // groupBans 真的是那几处在用
  assert.ok((app.match(/groupBans\(/g) || []).length >= 3, "群那几处不再走 groupBans 了");
  assert.match(eng, /groupBans\(\{ narrative: true, mood: true, echo: true/, "群线下那一处没了");
});

test("单聊线上/线下 · 单人通话 · 匿名信箱 · 解梦馆：走 buildBundle 白送", () => {
  const bb = eng.slice(eng.indexOf("parts.push(ANTI_CLICHE);"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  assert.match(bb, /parts\.push\(EMPTY_COMFORT_BAN\);/);
  assert.ok(bb.indexOf("parts.push(OVERREACH_BAN)") < bb.indexOf("parts.push(EMPTY_COMFORT_BAN)"));
  // ⚠️它在 notRoleplay 的 else 分支里：言秋不吃扮演类规则，那是写着理由的合法差异
  const nr = eng.slice(eng.indexOf("if (ctx.notRoleplay) {"), eng.indexOf("parts.push(CHARCARD_RULE);"));
  assert.ok(nr.indexOf("EMPTY_COMFORT_BAN") > nr.indexOf("} else {"), "跑到言秋那一支里去了");
});

test("穿书（加笔）：第六处，靠自己一条条 push——最容易漏的那种", () => {
  assert.match(fic, /if \(typeof EMPTY_COMFORT_BAN !== "undefined"\) parts\.push\(EMPTY_COMFORT_BAN\);/);
  assert.ok(fic.indexOf("OVERREACH_BAN") < fic.indexOf("EMPTY_COMFORT_BAN"), "跟那一族走散了");
});

test("八处一个都不少（按分发点点名，不是按文件）", () => {
  const hubs = [
    ["群线上 / 群线下 / 群通话 / 群投票", /P\.push\(EMPTY_COMFORT_BAN\);/.test(eng)],
    ["单聊线上 / 单聊线下 / 单人通话 / 匿名信箱 / 解梦馆", /parts\.push\(EMPTY_COMFORT_BAN\);/.test(eng)],
    ["穿书（加笔）", /parts\.push\(EMPTY_COMFORT_BAN\)/.test(fic)]
  ];
  const miss = hubs.filter(h => !h[1]).map(h => h[0]);
  assert.deepEqual(miss, [], "这些还没接上：" + miss.join(" / "));
});
