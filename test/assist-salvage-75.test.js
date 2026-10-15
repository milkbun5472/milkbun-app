// 她 2026-10-14：秋秋说「点应用」但卡没出来——多半是 CSS 里的双引号没转义，整段 JSON 坏了。一张张抠回来
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "assistant.js"), "utf8");
const seg = src.slice(src.indexOf("  const PATCH_KEYS = "), src.indexOf("  // ---- 代码/框架那道门"));
const { salvagePatches, salvageField } = new Function(seg + "; return { salvagePatches, salvageField };")();
const broken = '{"reply":"改好了，点应用就可以。","patches":[{"target":"chatcss","id":"c1","title":"顶栏","text":"[data-wk="chathead"] {\n  padding-top: calc(var(--app-safe-top) + 5px) !important;\n}","why":"刘海"},{"target":"memedit","id":"m2","drop":true,"text":""}]}';
assert.throws(() => JSON.parse(broken));
const got = salvagePatches(broken);
assert.equal(got.length, 2);
assert.equal(got[0].target, "chatcss");
assert.match(got[0].text, /\[data-wk="chathead"\] \{\n  padding-top/);
assert.equal(got[0].why, "刘海");
assert.equal(got[1].drop, true);
assert.equal(salvageField(broken, "reply"), "改好了，点应用就可以。");
// 截断在半路的最后一张也尽量拿回来
const cut = '{"reply":"好","patches":[{"target":"persona","id":"c1","text":"他说"你好"然后';
assert.equal(salvagePatches(cut)[0].text, '他说"你好"然后');
assert.match(src, /自动再问它一次，只要改动稿/);
console.log("ok");
