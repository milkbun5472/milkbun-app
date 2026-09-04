// 主屏组件里的图标一律走 SVG 那一套，不用 emoji（她 2026-09-04：
// 「备忘录和情侣空间这里还是用的 emoji，不统一 svg」）。
// 判据：同一屏里别的图标都是线条画的，混一个彩色 emoji 进去，它就不属于这套东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (a, b) => comp.slice(comp.indexOf(a), comp.indexOf(b));

test("备忘录那颗图钉是 IPin，不是 📌", () => {
  const seg = cut("function MemoWidget(", "// 命运转盘");
  assert.ok(!/📌/.test(seg), "还留着 emoji 图钉");
  assert.equal((seg.match(/h\(IPin, \{ size: 15, color: t\.accent \}\)/g) || []).length, 2, "两档（一行/多行）都要换");
});

test("情侣空间那几颗心是 IHeart，不是 💗", () => {
  const seg = cut("function UsWidget(", "function MusicWidget(");
  assert.ok(!/💗/.test(seg), "还留着 emoji 爱心");
  // 甜蜜值那一行、右下角那颗、还没有对象时圆圈里那颗
  assert.equal((seg.match(/h\(IHeart, \{ size: \d+, color: "#e78fa1", filled: true \}\)/g) || []).length, 3);
  assert.match(seg, /h\(IHeart, \{ size: 12, color: "#e78fa1", filled: true \}\),\n\s*h\("span", null, "甜蜜值 " \+ sv\)/,
    "甜蜜值那一行不能再拿字符串拼图标——拼出来的是 emoji");
});

test("这两个组件里没有别的 emoji 混进来", () => {
  ["function MemoWidget(", "function UsWidget("].forEach((fn, i) => {
    const seg = cut(fn, i ? "function MusicWidget(" : "// 命运转盘");
    const emo = seg.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
    assert.deepEqual(emo, [], fn + " 里还有 emoji：" + emo.join(""));
  });
});
