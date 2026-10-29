// 存完了要说清楚存到哪（群里 2026-10-28：「谷歌浏览器导出的文档从哪导入」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const eng = rd("engine.js");
test("安卓走的是普通下载，那句话要点名「下载」文件夹", () => {
  const i = eng.indexOf("function savedWhere(via)"), j = eng.indexOf("\n}", i);
  assert.ok(i > 0 && j > i, "抠不出 savedWhere");
  const f = eng.slice(i, j);
  assert.match(f, /via === "download" \? "存到手机的「下载」文件夹了"/);
  assert.match(f, /via === "share" \? "已交给分享面板，在里面选「存储到文件」"/);
  assert.match(eng, /window\.savedWhere = savedWhere/);
});
test("每一处导出都问它要，别各写一句（施工规则/one-public-mechanism）", () => {
  for (const f of ["app.js", "screens-ui.js", "theme-studio-ui.js"]) {
    assert.ok(rd(f).includes("savedWhere(via)"), f + " 没走公共那一份");
    assert.ok(!/\? "已交给分享面板，在里面选「存储到文件」"/.test(rd(f)), f + " 还留着自己那一句");
  }
});
