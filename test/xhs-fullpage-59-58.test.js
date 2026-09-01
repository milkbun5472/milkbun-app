const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function PlazaView("), ph.indexOf("\n// =====", ph.indexOf("function PlazaView(")));

// 她 2026-09-01：「小红书现在是半屏，帮我弄成点开是全屏样式吧」。
// 见 .claude/rules/no-half-sheet.md：默认不要半窗。判据是「这一层的内容，
// 需要同时看见它下面那一层吗？」——一条笔记不需要。
test("点开一条笔记是整页，不是从底下掀起来的半窗", () => {
  assert.ok(view.indexOf('flex flex-col justify-end') < 0, "半窗还在（从底下掀起来的那种）");
  assert.ok(view.indexOf('maxHeight: "84%"') < 0, "还扣着一半屏幕");
  assert.ok(view.indexOf('rgba(20,18,20,.44)') < 0, "上面那层压暗的糊底还在");
  assert.match(view, /const detailPage = open \? h\("div", \{ className: "h-full min-h-0 flex flex-col"/, "不是整页");
  // 照移动端铁律：顶栏 shrink-0、正文 flex-1 min-h-0 overflow-y-auto
  const i = view.indexOf("const detailPage = open ?");
  const seg = view.slice(i, view.indexOf("const followPage", i));
  assert.match(seg, /className: "shrink-0 flex items-center px-3 pb-2"/, "顶栏没按铁律写");
  assert.match(seg, /paddingTop: safeTop\(10\)/, "顶栏没吃安全区");
  assert.match(seg, /className: "flex-1 min-h-0 overflow-y-auto"/, "正文不是唯一的主滚动容器");
  assert.match(seg, /aria-label": "返回"/, "没有返回键");
  // ⚠️整页要顶掉列表，不是浮在它上面；而且必须排在所有 hook 后面
  assert.match(view, /if \(detailPage\) return detailPage;/, "整页没顶掉列表");
  const hookAfter = view.slice(view.indexOf("if (detailPage) return detailPage;"));
  assert.ok(!/useState\(|useEffect\(|useRef\(/.test(hookAfter), "提前 return 后面还有 hook——会抛 #310 整页白");
});
