// 她 2026-11-18：「这个主还是没修好」——名字后面写着「群主」时，头像上不再挂一枚压图的「主」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
test("同一行名字旁有看得见的身份标，头像角标就不挂", () => {
  const i = comp.indexOf("const gAvBadgePin = el =>"), body = comp.slice(i, comp.indexOf("const gAvBadge = character", i));
  assert.match(body, /const msg = el\.closest\('\[data-wk="msg"\]'\), box = msg && msg\.parentElement;/);
  assert.match(body, /getAttribute\("data-part"\) !== "avatar"/);
  assert.match(body, /if \(named\) \{ el\.style\.setProperty\("display", "none", "important"\); return; \}/);
});
