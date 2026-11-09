// 她 2026-11-02：「这些提示词里面日子都全给我删了」——「（她 2026-10-24）」这种来由是写给施工看的，只许留在注释里，不发给模型
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
// stamps.js 是印章窗口的（不归这边改）；攻略、更新日志本来就是给人看的
const skip = new Set(["stamps.js", "assistant-manual.js", "changelog-data.js", "theme-studio.js"]);
const PAT = /[（(](?:她|群友|群里)[ ]?20\d\d-\d\d-\d\d[^（）()]{0,200}?[）)]|(?:^|[\s】」。])(?:她|群友) 20\d\d-\d\d-\d\d(?: 转群里读者| 报)?[：「]/;
const bad = [];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js") && !skip.has(x))) {
  fs.readFileSync(path.join(dir, f), "utf8").split("\n").forEach((ln, i) => {
    const m = PAT.exec(ln); if (!m) return;
    const before = ln.slice(0, m.index);
    if (/\/\/|^\s*\*|\/\*/.test(before)) return;   // 注释里的来由照留
    bad.push(f + ":" + (i + 1) + "  " + m[0].trim().slice(0, 40));
  });
}
assert.deepEqual(bad, [], "提示词里又写进了带日期的来由（放进注释里）：\n" + bad.join("\n"));
console.log("ok");
