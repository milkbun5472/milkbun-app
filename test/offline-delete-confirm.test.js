const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("线下卡删除先问一句（群友 2026-10-26）", () => {
  assert.match(c, /iconBtn\(ITrash, \(\) => requestAppConfirm\("删掉这一段？"/);
  assert.match(c, /requestAppConfirm\("删掉这张照片？", "删了找不回来。", \(\) => onDelete\(m\.id, msgIndex\)/);
});
