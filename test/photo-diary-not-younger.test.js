// 她 2026-11-02：「怎么日记还是会生成小时候」——照片日记的要求里自己写着「回想起的往事（小时候……）不拍」，
//   光看字的 photoYoungerOf 一看到「小时候」就把整张当童年照。照片日记拍的永远是这一天的他：调用方明说 notYounger
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
// 病根坐实：那句要求本身就会被认成童年照
const f = new Function(eng.slice(eng.indexOf("function photoYoungerOf("), eng.indexOf("// 合照得是画面里真有两个人")) + "; return photoYoungerOf;")();
assert.ok(f("日记里回想起的往事（小时候、以前、梦里）只是他心里想的，不拍成画面。"), "这句要求自己就会触发");
// 修：buildPhotoPrompt 认 notYounger，照片日记传它
assert.match(eng, /const _y0 = char !== "__shots" && !\(opts && opts\.notYounger\) && typeof photoYoungerOf === "function"/);
const i = app.indexOf("const genPhotoDiary = async");
assert.match(app.slice(i, i + 6000), /buildPhotoPrompt\(char, sceneFinal, st, \{ kind: "other", notYounger: true,/);
console.log("ok");
