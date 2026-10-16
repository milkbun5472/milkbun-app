const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, a); return s.slice(i, s.indexOf(b, i + a.length)); };

// 群里 2026-10-16：「备份不下来了，秋秋说可能是内存太大了」——图和视频拼成一整串，手机撑不住
test("导出全部数据：先存文字那份，图片和视频按包另存", () => {
  const ex = cut(app, "const doExport = async () => {", "\n  };");
  assert.match(ex, /buildExportPack\(\{ noImages: true \}\)/);
  assert.match(ex, /const box = await planMedia\(\);/);
  assert.ok(ex.indexOf("planMedia") > ex.indexOf("saveTextFile"), "文字那份要先存");
  const plan = cut(app, "const planMedia = async () => {", "\n  };");
  assert.match(plan, /size \+ n > MEDIA_PART/, "没切包");
  assert.match(plan, /return \{ broken: true \}/, "图库读失败那道闸没跟过来");
  assert.match(app, /kind: "media"/);
});

test("导入图片包：只往库里加，不清 x_、不清图库", () => {
  const im = cut(app, 'if (parsed.__archive && parsed.kind === "media") {', "return true;");
  assert.ok(im.indexOf("idbVaultClear") < 0, "图片包把图库清了");
  assert.ok(im.indexOf("localStorage") < 0, "图片包动了文字");
  assert.match(im, /idbVaultPut/);
  assert.match(scr, /onExportMedia\(k \+ 1\)/);
});
