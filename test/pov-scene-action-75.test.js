// TA 帮她拍：描述写了她在做什么，就不再掷「她回头」那类动作格（她 2026-10-15：写咬汤匙，出来河边回头）
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
test("pov 且描述里有动作：机位行只说镜头是谁的眼睛，动作照描述", () => {
  const i = eng.indexOf("function photoShotLine(kind, seed)"), seg = eng.slice(i, i + 1400);
  assert.ok(/if \(opts\.pov && \/.*咬.*\/\.test\(String\(sceneDesc/.test(seg));
  assert.ok(/不另编动作/.test(seg));
  assert.ok(seg.indexOf("不另编动作") < seg.indexOf("const list = opts.pov"));
});
