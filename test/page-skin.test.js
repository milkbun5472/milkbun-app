const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const fanfic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

// 真跑：把 pageSkin 那一段抠出来（不碰 React、不碰 DOM）
const S = (() => {
  const a = core.indexOf("function skinRGB(hex)");
  assert.ok(a > 0, "抠不出 pageSkin");
  return new Function(
    "const DEFAULT_THEME={bg:'#ece8e1',bg2:'#f6f4ef',ink:'#1b1a17',accent:'#c25a4a'};\n"
    + core.slice(a) + "\nreturn { pageSkin, skinIsDark, skinRGB, skinWordLayer, SKIN_PATS };")();
})();
const LIGHT = { bg: "#ece8e1", bg2: "#f6f4ef", ink: "#1b1a17", accent: "#c25a4a" };
const DARK = { bg: "#17171a", bg2: "#202024", ink: "#eae6df", accent: "#c98d5a" };
const KINDS = ["paper", "lined", "grid", "cloth", "wood", "night", "glass"];
// 顶层逗号才是分层：渐变里有括号、data URI 里有逗号和引号，正则数不对
function nlayer(css) {
  const s = String(css); let d = 0, q = "", n = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = ""; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === "(") d++;
    else if (c === ")") d--;
    else if (c === "," && d === 0) n++;
  }
  return n;
}

// 她 2026-08-30：「不要初始的米白或者单纯换色，要有设计感」
test("四条列表必须一样长——差一个 CSS 会静默地循环用，纹理全错位", () => {
  [LIGHT, DARK].forEach(t => KINDS.forEach(k => {
    [{ word: "FANFIC" }, {}, { corner: false }, { word: "BAG", wordLift: "60px" }].forEach(o => {
      const s = S.pageSkin(k, t, o);
      const n = nlayer(s.backgroundImage);
      assert.equal(nlayer(s.backgroundSize), n, k + " 的 size 层数对不上");
      assert.equal(nlayer(s.backgroundPosition), n, k + " 的 position 层数对不上");
      assert.equal(nlayer(s.backgroundRepeat), n, k + " 的 repeat 层数对不上");
    });
  }));
});

test("平涂之外真的叠了东西：光、纹理、角上那一笔、页底那个词", () => {
  const s = S.pageSkin("paper", LIGHT, { word: "FANFIC" });
  assert.match(s.backgroundImage, /radial-gradient/, "没有光");
  assert.match(s.backgroundImage, /repeating-linear-gradient/, "没有纹理");
  assert.match(s.backgroundImage, /url\('data:image\/svg\+xml/, "没有页底那个词");
  assert.ok(nlayer(s.backgroundImage) >= 7, "层数太少，还是在换色：" + nlayer(s.backgroundImage));
  assert.equal(s.backgroundColor, LIGHT.bg);
  // corner:false 要真的少两层
  assert.equal(nlayer(S.pageSkin("paper", LIGHT, { word: "FANFIC", corner: false }).backgroundImage),
    nlayer(s.backgroundImage) - 2);
});

test("颜色一律从主题算，不许写死黑——她能把 bg 调成任何颜色", () => {
  KINDS.forEach(k => {
    const s = S.pageSkin(k, DARK, { word: "DREAM" });
    assert.doesNotMatch(s.backgroundImage, /rgba\(0,\s*0,\s*0/, k + " 里写死了黑");
    assert.doesNotMatch(s.backgroundImage, /#[0-9a-fA-F]{6}/, k + " 里写死了 hex");
  });
  // 深底：纹理改用白，不再拿 ink 去压
  assert.ok(S.skinIsDark("#17171a") && !S.skinIsDark("#ece8e1"));
  const d = S.pageSkin("cloth", DARK, {});
  assert.match(d.backgroundImage, /rgba\(255,255,255/, "深底上没换成白");
  // 主题换了 accent，角上那一笔跟着换——不会有一页还挂着上一套颜色
  assert.match(S.pageSkin("paper", DARK, {}).backgroundImage, /rgba\(201,141,90/);
});

test("页底那个词永远铺满页宽，短词长词都是", () => {
  ["BAG", "FANFIC", "WARDROBE", "SETTINGS"].forEach(w => {
    const L = S.skinWordLayer(w, "27,26,23", .045);
    const svg = decodeURIComponent(L[0]);
    assert.match(svg, /width="1000"/, w + " 的图不是 1000 宽");
    assert.match(svg, /textLength="1000"/, w + " 没有兜住尾差");
    assert.match(svg, /lengthAdjust="spacing"/, "只许调字距，调字形会把字母压扁");
    assert.equal(L[1], "104% auto", w + " 不是按页宽缩放——窄屏上会只剩半个词");
  });
  // 太短的不画；非法字符剔掉（引号进去会把 SVG 撑破）
  assert.equal(S.skinWordLayer("A", "0,0,0", .05), null);
  assert.equal(S.skinWordLayer("", "0,0,0", .05), null);
  assert.match(decodeURIComponent(S.skinWordLayer('BA"G<x>', "0,0,0", .05)[0]), />BAGX</);
  // url() 用单引号包：双引号一进 style="" 就把属性提前闭合，整条 background 作废
  assert.match(S.skinWordLayer("BAG", "0,0,0", .05)[0], /^url\('data:/);
  assert.doesNotMatch(S.skinWordLayer("BAG", "0,0,0", .05)[0].slice(5, -2), /"/);
});

test("压着 tab bar 的页面要把那个词抬起来，否则整个躲在栏后面", () => {
  assert.match(S.pageSkin("paper", LIGHT, { word: "FANFIC", wordLift: "60px" }).backgroundPosition,
    /^-2% calc\(100% - 60px\)/);
  assert.match(S.pageSkin("paper", LIGHT, { word: "FANFIC" }).backgroundPosition, /^-2% 100%/);
});

test("同一支机制也给卡片用（base），不另写一个 cardSkin", () => {
  const c = S.pageSkin("paper", LIGHT, { base: LIGHT.bg2, corner: false, strength: .4 });
  assert.equal(c.backgroundColor, LIGHT.bg2);
  // strength 真的把力度压下去了
  const full = S.pageSkin("paper", LIGHT, { base: LIGHT.bg2, corner: false });
  assert.notEqual(c.backgroundImage, full.backgroundImage);
  assert.equal(S.pageSkin("paper", LIGHT, { strength: 0 }).backgroundImage.indexOf("0.0000") > 0, true);
});

test("皮铺在【最外层】容器，不是滚动容器（顶部白带那条）", () => {
  // 顶栏在滚动容器外面：只给滚动容器上色，顶上就留一条没上色的米白带
  assert.match(screens, /style: pageSkin\(sec\.closet \|\| sec\.zip \|\| sectionKey === "pocket" \? "cloth" : "paper", t,/);
  assert.match(screens, /\{ tint: CARRY_TINT\[sectionKey\], word: sec\.en \}\)\n  \},/);
  assert.doesNotMatch(screens, /backgroundImage: "linear-gradient\(180deg," \+ carryTint\(sectionKey, \.10\)/,
    "旧的那条渐变还在——撤东西要删掉，不是留着");
  // 同人文：列表/书架/发布/我的/跑团 共用的最外层 + 阅读页
  // ⚠️v58.12 起同人文那几页【不带页底大字】了（她点名去掉）——认的是「皮还在」，
  // 不是「那句 word 还在」。带不带 word 由 fanfic-paper-58-12 那份守着。
  assert.match(fanfic, /style: pageSkin\("paper", t, \{ corner: true \}\)/);
  assert.match(fanfic, /style: pageSkin\("paper", t, \{ strength: \.6 \}\)/);
  // ⚠️同人文的卡片皮 v61.11 撤了：feed 改成目录页，条目不上皮（皮是页面的事）。
  // base/strength 这一支本身还在 core 里，上面那条用例照跑。
  assert.doesNotMatch(fanfic, /pageSkin\("paper", t, \{ base: t\.bg2/, "条目又自己上了一层纸皮");
});
