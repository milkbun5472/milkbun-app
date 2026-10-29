// 一次全选导入（2026-10-29 群里十二包图）：一份读完导完再读下一份，不再全部同时读进内存；没导成的点名
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const a = app.indexOf("const doImportFiles = async files =>"), body = app.slice(a, a + 3000);
test("不再 Promise.all 一次读完", () => {
  assert.doesNotMatch(body, /Promise\.all\(arr\.map\(readOne\)\)/);
  assert.match(body, /let x = await readOne\(rows\[i\]\)/);
});
test("文字那份排在图片包前面，图片包按第几包排", () => {
  assert.match(body, /isMediaName\(x\) \? 1 : 0\) - \(isMediaName\(y\) \? 1 : 0\) \|\| partOf\(x\) - partOf\(y\)/);
});
test("没导成的点名", () => { assert.match(body, /这几份没导成：/); });
