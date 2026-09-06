// 规则原文的真跑把手（v65.07）。
//
// 她 2026-09-06：「把 claude rule 的施工规则换个地方放吧，言秋不需要每次都看这个」——
// 十三份施工规则从 .claude/rules/ 搬去了仓库根的 施工规则/。
//
// ⚠️搬之前，那个路径【写在十二份测试里】：搬一次就得改十二处，漏一处那处当场炸。
//   这正是 one-public-mechanism.md 说的形状，所以现在路径只写在这一行：
//   下次再搬家，改这儿一处就够。
const fs = require("node:fs");
const path = require("node:path");
const DIR = path.join(__dirname, "..", "施工规则");
// 留在 .claude/rules/ 的那两份不归这儿管：它们不是施工规则（见 施工规则/README.md）
const ruleText = name => fs.readFileSync(path.join(DIR, name.replace(/\.md$/, "") + ".md"), "utf8");
module.exports = { DIR, ruleText };
