// 「最近聊过」当功能性装饰（她 2026-09-28）：能从桌面移走、安全网不再硬塞回来、做装饰那一页能放回
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(src, /function hideWidget\(key\)/); assert.match(src, /function showWidget\(key\)/);
assert.match(src, /saveJSON\("x_homeHiddenWidgets", hid\)/);
assert.match(src, /if \(hiddenW\.indexOf\(key\) >= 0\) return false;/, "移走的不许再被排进页面");
assert.match(src, /hiddenW\.indexOf\(key\) < 0 && !reach\[key\]\) \{/, "安全网不再把它塞回来");
assert.match(src, /styleKey === "w_recent" \? h\("button", \{ onClick: function \(\) \{ hideWidget\("w_recent"\); \}/);
assert.match(src, /hiddenWidgets\.indexOf\("w_recent"\) >= 0 \? h\("button", \{ key: "__recent"[^\n]*showWidget\("w_recent"\)/);
console.log("recent removable ok");
