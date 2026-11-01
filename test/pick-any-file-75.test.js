// 她 2026-10-14：「秋秋不收 css 文件吗」——iPhone 照后缀清单把 .css 变灰；一律放行、读的时候拦非文本
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const fn = c.slice(c.indexOf("function pickTextFile("), c.indexOf("function pickTextFile(") + 8000);   // 2026-10-31 v88.809 多了发音频听写那一支，函数变长
assert.match(fn, /inp\.accept = ANY_FILE;/);
assert.match(fn, /这不像文字文件/);
console.log("ok");
assert.match(fn, /document\.body\.appendChild\(inp\)/);

// 她 2026-10-21：「给秋秋发文件有时候很久都不显示」——iCloud 文件下载期间别把 input 拆了；取消才当场拆，否则留一分钟
assert.match(fn, /inp\.addEventListener\("cancel", drop\);/);
assert.match(fn, /if \(!\(inp\.files && inp\.files\.length\)\) drop\(\); \}, 60000\)/);
