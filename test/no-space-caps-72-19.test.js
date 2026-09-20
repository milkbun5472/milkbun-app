// 「这些不能搬到 indexdb 然后不上限吗」「查一下吧，全都带进 indexdb 取消上限」（她 2026-09-20）。
//
// 抽屉那次查出来的形状：**上限是为 localStorage 那 5MB 定的，键搬进 IndexedDB 之后
// 没人回来撤它**。于是一个早就不存在的墙，还在替她做「挤掉哪一条」的决定，而且不留痕。
// 这一份把同一个形状的其余几处一起收了。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const idbKeys = (() => {
  const i = eng.indexOf("const DURABLE_TEXT_KEYS = new Set([");
  const j = eng.indexOf("]);", i);
  assert.ok(i > 0 && j > i, "抠不出 DURABLE_TEXT_KEYS");
  return new Set((eng.slice(i, j).match(/"x_[A-Za-z0-9_]+"/g) || []).map(x => x.slice(1, -1)));
})();

test("会一直长大的那几样都住在 IndexedDB，不占那 5MB", () => {
  // 时光胶囊／我们说好的／朋友圈／钱包流水／她那箱匿名信／心愿／贴吧私信
  ["x_capsules", "x_promises", "x_moments", "x_walletLog", "x_anonMine", "x_shopWish", "x_forumPMs"]
    .forEach(k => assert.ok(idbKeys.has(k), k + " 还在 localStorage 里——那才真需要上限"));
  // 之前已经在里面的那几样别被顺手挪出去
  ["x_coupleDrawer", "x_coupleShots", "x_studio", "x_coupleLetters", "x_coupleExDiary", "x_coupleTimeline"]
    .forEach(k => assert.ok(idbKeys.has(k), k + " 被挪回 localStorage 了"));
});

test("搬进来的那几样一并免掉 localStorage journal", () => {
  // ⚠️不免就是 v72.02 那个坑原样重演：journal 写不进去 → 旧的那份赖着 → 开机拿旧的盖新的
  const i = eng.indexOf("function durableTextNeedsLocalJournal(k) {");
  const j = eng.indexOf("\n}", i);
  assert.ok(i > 0 && j > i, "抠不出 durableTextNeedsLocalJournal");
  const needs = new Function(eng.slice(i, j + 2) + "; return durableTextNeedsLocalJournal;")();
  ["x_chat:c1", "x_gchat:g1", "x_offline:c1", "x_goffline:g1",
   "x_capsules", "x_promises", "x_moments", "x_walletLog", "x_anonMine", "x_shopWish", "x_forumPMs"]
    .forEach(k => assert.equal(needs(k), false, k + " 还要求 localStorage 也塞一整份"));
  // 小配置键仍然三重核对，别把保险一起拆了
  assert.equal(needs("x_memLib"), true, "记忆库的三重核对被拆掉了");
});

test("那几个上限不再是「一个人够得着的数」", () => {
  const caps = {
    FORUM_PM_KEEP: "贴吧私信", WALLET_LOG_KEEP: "钱包流水", MOMENTS_CAP: "朋友圈",
    ANON_ME_CAP: "她那箱匿名信", COUPLE_SHOT_CAP: "合照", STUDIO_CAP: "照相馆",
    WISH_CAP: "心愿", DRAWER_CAP: "抽屉"
  };
  Object.keys(caps).forEach(c => {
    const m = new RegExp("const " + c + " = (\\d+);").exec(app);
    assert.ok(m, c + " 不见了");
    assert.ok(Number(m[1]) >= 10000, caps[c] + "（" + c + "）的上限是 " + m[1] + "，她一个人就能撞到");
  });
});

test("不是空间问题的那几个上限，一个都不许顺手撤掉", () => {
  // ⚠️这一条是反向的：撤上限只针对【为 5MB 定的】那些。
  //   下面这几个各有各的真理由，撤了会把功能改坏。
  assert.match(app, /const IF_CAP = 60;/, "如果馆那条线的长度限制被当成空间上限撤了——那是叙事设计（防它长成一本书）");
  assert.match(app, /const ON_ME_CAP = 2;/, "「身上同时带几件」被撤了——多了就不叫今天带着的了");
  assert.match(app, /const FORUM_NPC_CAP = 30;/, "论坛熟面孔池被撤了——那是可再生数据");
});
