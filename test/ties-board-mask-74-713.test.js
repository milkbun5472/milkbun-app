// 关系网上「我」那个节点戴哪张脸（群友 2026-10-03 在秋秋机群里报的）
//
// 她原话：「聊天里 u 和 c 绑专属面具的话，关系网上 u 显示的头像也是主面具」。
//
// 病根：关系网是【一人一页】的（v60.47 她要的），可这一页只拿到一张全局 profile；
//   而「这个人认识的是我哪一张脸」那一层走的是 profileFor——它是 ctxFor 那一口的
//   公共件，单聊线上/线下、通话、日记、查手机、穿书、匿名箱、解梦馆八处都接着，
//   偏偏关系网没接（four-surfaces-same-context 那个老形状）。
//
// 这儿不另算一遍换脸逻辑（one-public-mechanism）：把 profileFor 递下去就行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const scr = fs.readFileSync("js/screens.js", "utf8");
const live = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("① app.js 把公共件递给关系网，不是另造一份", () => {
  const i = app.indexOf('screen === "ties") body =');
  const j = app.indexOf("else if (screen ===", i + 10);
  const call = app.slice(i, j > i ? j : i + 2000);
  assert.match(call, /profileFor: profileFor/, "关系网没拿到 profileFor");
  assert.match(live(app), /const profileFor = charId =>/, "公共件本身不见了");
});

test("② 板子上的「我」戴的是这一页这个人认识的那张脸", () => {
  assert.match(live(scr), /const boardProfile = /, "没按这一页算过脸");
  const line = live(scr).split("\n").find(l => l.includes("const boardProfile"));
  assert.ok(/boardId !== "me"/.test(line), "「我」自己那一页该照旧用主面具");
  assert.ok(/profileFor\(boardId\)/.test(line), "要按这一页的人取脸");
  assert.ok(/\|\| profile/.test(line), "那张脸被删了要退回主面具，不能炸");
  assert.match(live(scr), /centerId: boardId, me, profile: boardProfile/,
    "板子拿到的还是全局 profile，等于没改");
});

test("③ profileFor 没传也不许炸（它是可选 prop）", () => {
  const line = live(scr).split("\n").find(l => l.includes("const boardProfile"));
  assert.ok(/typeof profileFor === "function"/.test(line), "没做函数判断");
  assert.match(live(scr), /^\s*profileFor,$/m, "Ties 的形参表里没收这一项");
});
