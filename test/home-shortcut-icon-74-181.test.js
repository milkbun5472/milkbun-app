// 快捷入口（她 2026-09-28）：打开的就是选的；默认 1×1；默认一块空白，可当自定义 app 图标
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(src, /\{ id: "shortcut", glyph: "↗", name: "快捷入口牌", text: "", detail: "" \}/);
assert.match(src, /if \(it\.which === "shortcut"\) return \[1, 1\];/);
assert.match(src, /function shortcutTarget\(detail\) \{ var opts = shortcutOptions\(\); return opts\.indexOf\(detail\) >= 0 \? detail : \(opts\[0\] \|\| ""\); \}/);
assert.match(src, /h\("select", \{ value: shortcutTarget\(A\.detail\),/, "选单显示的就是会打开的那个");
assert.match(src, /var tk = shortcutTarget\(it\.decor\.detail\); if \(tk\) onOpenApp\(tk\);/, "点下去打开的也走同一个");
assert.ok(!/onOpenApp\(it\.decor\.detail \|\| "memo"\)/.test(src), "老的 memo 兜底不许留着");
assert.match(src, /A\.type === "shortcut" \? shortcutTarget\(/, "存的时候就把目标定死");
assert.match(src, /"data-home-shortcut": true/);
console.log("shortcut ok");
