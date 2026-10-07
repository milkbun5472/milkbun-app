// 小剧场能复制（群里 2026-10-07）：长按角色那一拍，菜单里有「复制这一拍」「复制这一幕全文」，走公共 copyText
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/theater.js", "utf8");
const i = src.indexOf("const msgSheet = msgMenu &&"), seg = src.slice(i, i + 2500);
assert.match(seg, /\["复制这一拍", async \(\) => \{[^]*?copyText\(m\.content\)/);
assert.match(seg, /\["复制这一幕全文", async \(\) => \{[^]*?copyText\(txt\)/);
assert.match(seg, /\["⑂ 从这里分支", \(\) => branchFrom\(msgMenu\)\]/);
// 字数早就有：编辑设定里走公共 WordFloorSection，并发进提示词
assert.match(src, /h\(window\.WordFloorSection, \{ value: edit\.minWords \|\| 0/);
assert.match(src, /window\.StylePresets\.wordRule\(window\.StylePresets\.clampWordFloor\(line\.minWords\)\)/);
console.log("theater-copy ok");
