const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const screens = fs.readFileSync(path.resolve(__dirname, "../js/screens.js"), "utf8");
const cast = screens.slice(screens.indexOf("function Cast("), screens.indexOf("function CastForm("));
const form = screens.slice(screens.indexOf("function CastForm("), screens.indexOf("// TIES (directed)"));

test("名录使用自己的奶油纸人格档案馆视觉，而不是套用参考图", () => {
  assert.match(cast, /PERSONA ARCHIVE/);
  assert.match(cast, /人格档案馆/);
  assert.match(cast, /FILE ·/);
  assert.match(cast, /TIMEZONE/);
  assert.match(cast, /BIRTHDAY/);
  assert.match(cast, /castSummary\(c\)/);
  assert.match(cast, /background: t\.bg2/);
  assert.doesNotMatch(cast, /CLASSIFIED|ARCHIVAL INFORMATION|THE INTELLIGENCE DATABASE/);
});

test("名录和编辑档案都遵守子页面安全区与单滚动容器", () => {
  for (const source of [cast, form]) {
    assert.match(source, /paddingTop: safeTop\(8\)/);
    assert.match(source, /flex-1 min-h-0 overflow-y-auto/);
    assert.doesNotMatch(source, /React\.createElement\(Head/);
  }
});

test("编辑页保留完整资料字段，并按四卷分区", () => {
  assert.match(form, /PERSONA DOSSIER/);
  for (const label of ["人物底稿", "时间坐标", "视觉档案", "声音档案"]) {
    assert.match(form, new RegExp(label));
  }
  for (const field of ["persona", "tz", "birthday", "appearance", "photoCanon", "photoOutfit", "photoAccessories", "voiceId"]) {
    assert.match(form, new RegExp("\\b" + field + "\\b"));
  }
});
