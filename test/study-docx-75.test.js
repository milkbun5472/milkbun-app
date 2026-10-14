// 群友 2026-10-14：扫描 PDF 转成 Word，一起读能导，一起学选不中
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "study.js"), "utf8");
assert.match(s, /accept: "[^"]*\.docx[^"]*\.epub/);
assert.match(s, /const isDocx = \/\\\.docx\$\/i\.test\(f\.name\)/);
assert.match(s, /typeof docxToText === "function" \? docxToText/);
console.log("ok");
