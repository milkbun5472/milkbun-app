// 她 2026-10-14：「秋秋不收 css 文件吗」——iPhone 照后缀清单把 .css 变灰；一律放行、读的时候拦非文本
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const fn = c.slice(c.indexOf("function pickTextFile("), c.indexOf("function pickTextFile(") + 4000);
assert.match(fn, /inp\.accept = "\*\/\*";/);
assert.match(fn, /这不像文字文件/);
console.log("ok");
