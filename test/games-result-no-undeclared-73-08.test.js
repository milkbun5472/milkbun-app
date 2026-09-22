// 25 问 / 海龟汤揭晓那一刻崩成「Can't find variable: lisa」（她 2026-09-22 截图）：
// 结算那段照着别的游戏抄了 lisa，可 GuessGame 里用户那一位叫 me。
// 这里查 games.js 里每一处用到 lisa 变量的地方，前面都得有自己的 const lisa。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/games.js", "utf8").split("\n");
const bad = [];
src.forEach((l, i) => {
  const code = l.replace(/\/\/.*$/, "").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  if (!/\blisa\b/.test(code) || /const lisa\b/.test(code)) return;
  let ok = false;
  for (let k = i; k >= Math.max(0, i - 15); k--) if (/const lisa\b/.test(src[k])) ok = true;
  if (!ok) bad.push(i + 1);
});
assert.deepStrictEqual(bad, [], "games.js 这些行用了没声明的 lisa：" + bad.join(","));
const i = src.findIndex(l => /const title = kind === "haigui"/.test(l));
assert(i > 0);
assert(/\(me && me\.name\)/.test(src.slice(i, i + 8).join("\n")), "GuessGame 结算用 me");
console.log("games-result-no-undeclared-73-08 ok");
