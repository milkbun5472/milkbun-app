// 群友 2026-10-20：「许愿一个可以改单句语音回复的功能」——语音长按也有「编辑」
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const fn = src.slice(src.indexOf("function menuItemsForKind"), src.indexOf("\n}\n", src.indexOf("function menuItemsForKind")) + 2);
const menu = new Function(fn + "; return menuItemsForKind;")();
const v = menu({ kind: "voice", role: "assistant", content: "嗯" }, true).flat();
assert.ok(v.includes("edit"), "语音没有编辑");
assert.ok(v.includes("copy") && v.includes("del"));
// 合成读的就是 m.content：改了字再点就照新字念，不用另外清缓存
assert.match(src, /await ttsSpeak\(vText, speaker\.voiceId/);
console.log("ok");
