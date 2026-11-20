// 她 2026-11-18：「这个主还是没修好」「可是我喜欢两边都显示」——头像角标挂在头像框外面那层，名字旁那枚照旧
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
test("头像角标挂在框外那层，不再收进框里压图，也不因名字旁有就藏", () => {
  assert.match(comp, /const gAvWrap = \(av, character\) =>/);
  assert.match(comp, /"data-wk": "avatarwrap"/);
  assert.equal((comp.match(/gAvWrap\(h\("(?:button|span)", \{ "data-wk": "avatar"/g) || []).length, 2);
  const i = comp.indexOf("const gAvBadgePin = el =>"), body = comp.slice(i, comp.indexOf("};", i));
  assert.doesNotMatch(body, /msgStickClipped|display", "none"/);
});
