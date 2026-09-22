// 25 问 / 海龟汤揭晓那一刻崩成「Can't find variable: lisa」（她 2026-09-22 截图）：
// 结算那段照着别的游戏抄了 lisa，可 GuessGame 里用户那一位叫 me。
// 而且这是给所有人用的 app，代码里不该把「用户」写成某一个人的名字（她：「不应该是lisa啊」）。
// 变量统一叫 userSeat，棋桌座位键叫 "user"。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/games.js", "utf8").split("\n");
const bad = [];
src.forEach((l, i) => {
  const code = l.replace(/\/\/.*$/, "");
  if (/\blisa\b/.test(code)) bad.push(i + 1);
});
assert.deepStrictEqual(bad, [], "games.js 这些行还在用 lisa 当变量名：" + bad.join(","));
const i = src.findIndex(l => /const title = kind === "haigui"/.test(l));
assert(i > 0);
assert(!/她排第/.test(src.join("\n")), "结算不许写死「她」");
assert(/\(me && me\.name\)/.test(src.slice(i, i + 8).join("\n")), "GuessGame 结算用 me");
console.log("games-result-no-undeclared-73-08 ok");
