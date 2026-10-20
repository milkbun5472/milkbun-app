// 群友 2026-10-20：「转账的整个卡片可以改吗？想改成别的样式但是好像改不动」——虚线、缺口、底条、按钮、货币符号原来没挂点
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "../js/theme-studio.js"), "utf8");
for (const k of ["transfercur", "transferrule", "transfernotch", "transferfoot", "transferbtn"]) {
  assert.match(c, new RegExp('"data-wk": "' + k + '"'), k + " 挂在转账卡上");
  assert.match(ts, new RegExp('\\["' + k + '", "'), k + " 登记在主题工作台");
}
console.log("ok");
