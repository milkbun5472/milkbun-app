// 一次全选导入（2026-10-29 群里十二包图）：一份读完导完再读下一份，不再全部同时读进内存；没导成的点名
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const a = app.indexOf("const doImportFiles = async"), body = app.slice(a, a + 3000);
test("不再 Promise.all 一次读完", () => {
  assert.doesNotMatch(body, /Promise\.all\(arr\.map\(readOne\)\)/);
  assert.match(body, /const text = await readText\(rows\[i\]\.f\)/);
});
test("文字那份排在图片包前面，图片包按第几包排", () => {
  assert.match(body, /\(a\.media \? 1 : 0\) - \(b\.media \? 1 : 0\) \|\| a\.part - b\.part/);
});
test("没导成的点名", () => { assert.match(body, /这几份没导成：/); });
