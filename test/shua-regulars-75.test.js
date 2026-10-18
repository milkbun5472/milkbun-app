// 片刻熟面孔（她 2026-10-16）：论坛那批常驻网友换了片刻网名和刷视频的习惯；碰面账两边共用
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const src = (fs.readFileSync(__dirname + "/../js/shua-core.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/shua.js", "utf8")), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("同一批人：论坛常驻网友都有 shua 网名和习惯，匿名吧那几位没有", () => {
  const reg = app.slice(app.indexOf("const FORUM_NPC_REGISTRY = ["), app.indexOf("];", app.indexOf("const FORUM_NPC_REGISTRY = [")));
  const rows = reg.split("\n").filter(l => /\{ id: "npc_/.test(l));
  rows.forEach(l => { if (/npc_regular_/.test(l)) assert.match(l, /shua: \{ name: "[^"]+", voice: "[^"]+" \}/, l.slice(0, 40)); else assert.ok(!/shua:/.test(l)); });
  assert.match(app, /touchRegular: \(id, dir, tone\) => touchForumPublicTie\(id, dir, tone\)/);
});
test("熟面孔进片刻的评论串、刷点评论、路人视频；回了她记碰面账，她回他们也记", () => {
  assert.match(src, /crowdSystem\(v, \{ regs: regsText\(\),/);
  assert.match(src, /的名义写任何一句。" \+ regsText\(\);/);
  assert.match(src, /hotToday\(\), regsText\(\)/);
  assert.equal((src.match(/if \(reg && to === myName\) touchReg\(reg, "theirs", x\.tone\);/g) || []).length, 2);
  assert.match(src, /touchReg\(who\.reg \|\| regOf\(who\.name\), "mine"\)/);
  assert.match(src, /if \(id && props\.touchRegular && !onAlt\)/);
});
test("regularsBlock：见过她的排前面、带碰面次数；他们之间的交情一起给", () => {
  const f = new Function("S", src.slice(src.indexOf("function regularsBlock"), src.indexOf("\n  }\n", src.indexOf("function regularsBlock")) + 4) + "\nreturn regularsBlock;")(String);
  const out = f([{ id: "a", name: "前排占座", voice: "玩梗", tie: { encounters: 3, warm: 3, spar: 0 } }, { id: "b", name: "摸鱼中勿扰", voice: "冷笑话", tie: null }], [{ a: "a", b: "b", line: "「摸鱼中勿扰」↔「前排占座」：老搭子" }], "Lisa");
  assert.match(out, /「前排占座」：玩梗；跟 @Lisa 在评论区碰过 3 次，碰上多半聊得来/);
  assert.match(out, /老搭子/);
  assert.match(out, /tone 填 warm/);
});
