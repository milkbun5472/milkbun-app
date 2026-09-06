// 「她叫什么」的真跑把手（v65.05）。
//
// ⚠️core.js 在 node 里 require 不动（第一行就在解构 React），可 app.js 里现在到处都调
//   userName(profile)——凡是把 app.js 抠一段出来 eval 的测试，不把它递进去就整段
//   ReferenceError。抄一份「name || 用户」进测试也不行：那正是 stub-from-the-writer.md
//   说的「照着要测的那段编」，兜底哪天改了这儿也不会知道。
//   所以从 core.js 的源码里把【真的那一个】抠出来，一处开好，谁要用谁 require。
const fs = require("node:fs");
const path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const m = /function userName\(profile\) \{[\s\S]*?\n\}/.exec(core);
if (!m) throw new Error("core.js 里没有 userName 了——它被改名或删掉了");
const userName = new Function("return (" + m[0] + ")")();
if (userName({ name: "阿念" }) !== "阿念" || userName({}) !== "用户") {
  throw new Error("抠出来的 userName 行为不对：" + userName({ name: "阿念" }) + " / " + userName({}));
}
module.exports = { userName };
