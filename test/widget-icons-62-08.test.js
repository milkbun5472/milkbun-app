// 主屏组件里的图标一律走 SVG 那一套，不用 emoji（她 2026-09-04：
// 「备忘录和情侣空间这里还是用的 emoji，不统一 svg」）。
// 判据：同一屏里别的图标都是线条画的，混一个彩色 emoji 进去，它就不属于这套东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// ⚠️只扫【会画到屏幕上】的那些字符串：注释里的 ⚠ 不算（它是写给人看的）
const noComments = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const cut = (a, b) => noComments(comp.slice(comp.indexOf(a), comp.indexOf(b)));

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

// v62.09 她：「一起换了吧，还有记账那个看起来也是 emoji 吧？」
test("天气：天象和空态都走 SVG，不再用 emoji", () => {
  const seg = cut("function WeatherWidget(", "// 记账小组件");
  const emo = seg.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  assert.deepEqual(emo, [], "天气里还有 emoji：" + emo.join(""));
  assert.match(seg, /h\(GWx, \{ kind: wmoKind\(w\.code\), size: 22, color: t\.ink \}\)/, "有数据时那颗天象还是 emoji");
  assert.match(seg, /h\(GWx, \{ kind: "partly", size: 15, color: t\.fog \}\)/, "空态那颗还是 emoji");
  assert.ok(!/wmoEmoji\(/.test(seg), "还在调 wmoEmoji");
});

test("记账空态的本子换成钱包图标", () => {
  const seg = cut("function LedgerWidget(", "// 备忘录小组件");
  const emo = seg.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  assert.deepEqual(emo, [], "记账里还有 emoji：" + emo.join(""));
  assert.match(seg, /h\(GWallet, \{ size: 15, color: t\.fog \}\)/);
});

test("那套天象图标和别的图标同一套画法，映射也和 wmoEmoji 对得上", () => {
  const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(core, /const GWx = p => \{/);
  assert.match(core, /function wmoKind\(c\) \{/);
  // 两边的分档必须一致：改了一边忘了另一边，天气图标就会和文字对不上
  const kinds = core.slice(core.indexOf("function wmoKind(c) {"), core.indexOf("// =====", core.indexOf("function wmoKind(c) {")));
  [["c === 0 || c === 1", '"sun"'], ["c === 2", '"partly"'], ["c === 3", '"cloud"'],
   ["c === 45 || c === 48", '"fog"'], ["c >= 95", '"storm"'], ["c >= 51", '"rain"']].forEach(([cond, out]) => {
    assert.ok(kinds.includes(cond) && kinds.includes(out), "少了这一档：" + cond + " → " + out);
    assert.ok(eng.includes(cond), "engine 的 wmoEmoji 没有这一档了，两边对不上：" + cond);
  });
});
