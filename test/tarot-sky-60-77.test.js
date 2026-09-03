const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "tarot.js"), "utf8");
const codeOnly = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

// 她 2026-09-03：「把塔罗那页也装修一下吧。我觉得可以不用一个一个框，
// 可以做个星空主题，每一颗星都是不同的占卜方向」。
// 原来落地页是四个并排的框：色块图标 + 名字 + 一行说明——那个形状换个 app 照样成立。

test("四种问法都在天上有一颗星，一颗都不能少", () => {
  const modes = [...new Set((src.match(/^\s{4}(reading|relation|daily|forchar): \{/gm) || []).map(x => x.trim().split(":")[0]))];
  assert.deepEqual(modes.sort(), ["daily", "forchar", "reading", "relation"]);
  const at = src.match(/const STAR_AT = \{([^}]*\][^}]*)\}/);
  assert.ok(at, "四颗星的位置没有一处登记");
  modes.forEach(k => assert.ok(at[1].indexOf(k + ":") >= 0, k + " 在天上没有位置"));
  // 连成星座的那条线也要认全这四颗，不然会连出一条断线
  const chain = src.match(/const SKY_CHAIN = \[([^\]]*)\]/);
  assert.deepEqual(chain[1].split(",").map(x => x.trim().replace(/"/g, "")).sort(), modes.sort());
});

test("旧的那四个框整个删掉了，不是留在那儿说它是错的", () => {
  assert.equal(codeOnly.indexOf('borderRadius: 14, padding: "14px 16px"'), -1, "旧的模式框还在");
  assert.equal((codeOnly.match(/MODES\[k\]\.icon/g) || []).length, 0, "那几个 emoji 图标还挂在界面上");
  // 说明文字搬去了各自的入口页（那儿本来就写着一遍），天上只留名字
  assert.match(src, /fontSize: 12, color: t\.fog, lineHeight: 1\.7, marginBottom: 20 \} \}, m\.blurb/, "入口页得留着那一句说明");
});

test("谁亮谁暗照她自己的存档来——这一层换个 app 就不成立了", () => {
  assert.match(src, /const magOf = n => 1 \+ Math\.min\(1\.15, \(n \|\| 0\) \* 0\.17\)/);
  assert.match(src, /n = \(byMode\[k\] \|\| \[\]\)\.length, mag = magOf\(n\)/, "星等要读她这一种算过几次");
  assert.match(src, /const R = 6\.6 \* mag/, "星芒的大小跟着星等走");
  assert.match(src, /r: 13 \+ R \* 1\.9/, "光晕也跟着星等走");
  assert.match(src, /"算过 " \+ n \+ " 次"/, "亮成这样是为什么，得写出来");
  assert.match(src, /点一颗星 · 你问得越多，那颗星越亮/, "这条规则要在屏上说清楚");
});

test("背景碎星是钉死的种子，不许每次渲染自己跳一次", () => {
  assert.match(src, /let seed = 20260903 >>> 0;/);
  assert.match(src, /const SKY_DUST = \(function \(\)/, "碎星要在模块加载时算一次，不是每次渲染现掷");
  assert.equal((src.match(/SKY_DUST\.map/g) || []).length, 1);
  assert.ok(!/SKY_DUST[\s\S]{0,400}Math\.random/.test(src), "碎星里混进了 Math.random，星图会自己跳");
  // 死循环护栏：near() 把星位周围让开，运气差时可能一直撞上
  assert.match(src, /guard\+\+ < 4000/);
});

test("点得着：星芒才十几像素，热区得是一整片天", () => {
  assert.match(src, /h\("circle", \{ cx: at\[0\], cy: at\[1\], r: 24, fill: "transparent" \}\)/,
    "40px 那条手感线（viewBox 360 宽 ≈ 屏宽，r24 就是直径 48）");
  // 热区画在最后＝盖在最上面，别被文字挡掉
  const g = src.slice(src.indexOf('Object.keys(MODES).map(k => {'));
  assert.ok(g.indexOf('r: 24, fill: "transparent"') > g.indexOf('textAnchor: "middle"'), "热区要画在文字后面（也就是盖在上面）");
});

test("历史那一截也不再一条一个框", () => {
  assert.match(src, /borderBottom: "1px solid " \+ SKY_LINE, cursor: "pointer"/, "一条就是一行，靠发丝线分开");
  assert.equal(codeOnly.indexOf('background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 14px"'), -1, "旧的框还在");
});

test("类型筛选不是一排药丸：形状、明暗、底下那道线一起变", () => {
  const chip = src.slice(src.indexOf("const chip = (k, label, cnt)"), src.indexOf("return h(\"div\", null,\n            // 搜索框"));
  assert.equal(chip.indexOf("borderRadius: 999"), -1, "又摆回药丸了（tabs-not-plain-pills）");
  assert.match(chip, /borderBottom: "1\.5px solid " \+ \(on \? GOLD : "transparent"\)/, "选中要有一道金线");
  assert.match(chip, /on \? h\("path", \{ d: sparkle\(6, 6, 5\.6\), fill: GOLD \}\)\n\s*: h\("circle"/, "选中是一颗亮星，没选是一个暗点——形状要不一样");
  assert.match(chip, /width: on \? 12 : 8/, "大小也要不一样，不能只靠颜色");
});

// 她 2026-09-03 追加两句：「那一大块塔罗标题你没弄」「历史记录的收纳这一块
// 能不能也有星空背景全屏，因为下面现在也很空」。

const landing = (() => {
  // 从 histLine 起——历史那一行也画在天上，它的颜色同样归这一条管
  const i = src.indexOf("    const histLine = s => {"), j = src.indexOf("      confirmNode);", i);
  assert.ok(i > 0 && j > i, "落地页那一整段抠不出来了");
  return src.slice(i, j);
})();

test("落地页不再顶着那一大块标题：紧凑标题栏，返回键压在星星上", () => {
  // 公共 Head 是 30px 大标题 + 一整块留白（mobile-ui-layout 第 1 条明说子页面不许这样）
  assert.equal(landing.indexOf('h(Head, { zh: "塔罗"'), -1, "又把那一大块标题装回去了");
  assert.match(landing, /paddingTop: safeTop\(6\)/, "顶栏自己吃安全区，不另垫一条状态栏空带");
  assert.match(landing, /h\(IArrow, \{ size: 19, color: SKY_INK \}\)/, "返回键得是天上的浅色，不是墨色");
  assert.match(landing, /width: 44, height: 44/, "返回键的可点区域不许缩水");
  assert.match(landing, /fontSize: 16\.5, color: SKY_INK \} \}, "塔罗"\)/, "标题是居中小标题");
  assert.match(landing, /h\("div", \{ style: \{ width: 44, flexShrink: 0 \} \}\)/, "右边要留等宽操作位，标题才真的居中");
  // 别的页面照旧用 Head——这一版只动落地页
  assert.ok((src.match(/h\(Head, \{ zh: m\.zh/g) || []).length >= 2, "入口页和结果页的 Head 不该被顺手删掉");
});

test("整页都是这片天：往下滚，碎星跟着一起走", () => {
  assert.match(landing, /className: "h-full flex flex-col", style: \{ background: NIGHT \}/, "整页底色是夜色");
  assert.match(landing, /className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8"/, "正文那一层要 min-h-0，否则在 flex 里滚不动");
  assert.match(landing, /backgroundImage: SKY_TILE, backgroundSize: "360px 420px", backgroundRepeat: "repeat"/,
    "底下那一截的碎星贴在【会滚的那一层】上，才会跟着内容走");
  // 贴图是画出来的背景图，不是再铺一屏 SVG——历史可以很长，节点数不能跟着长
  assert.match(src, /const SKY_TILE = \(function \(\)/);
  assert.match(src, /radial-gradient\(circle " \+ r \+ "px at "/);
  // ⚠只挡 Math.random 不够：换成 Date.now 一样会每次都不同，所以直接钉那颗种子
  assert.match(src, /let seed = 907120260903 % 4294967291 >>> 0;/, "贴图的种子必须是写死的常数");
  assert.ok(!/SKY_TILE[\s\S]{0,600}(Math\.random|Date\.now)/.test(src), "贴图里混进了现掷的随机数，每次打开星位都会变");
});

test("天上的字是天上的颜色——纸上那套一个都不许漏进来", () => {
  // 漏一个 t.ink 就是深色底上写深色字（tabs-not-plain-pills 第 2 条那个坑）
  assert.deepEqual([...new Set(landing.match(/\bt\.[a-zA-Z0-9]+/g) || [])], [],
    "落地页里还留着纸上那套颜色变量");
  assert.match(landing, /color: SKY_INK/);
  assert.match(landing, /color: SKY_DIM/);
  assert.match(landing, /borderBottom: "1px solid " \+ SKY_LINE/);
});

test("一卦都没算过时，底下不留一屏空白", () => {
  assert.match(landing, /"这片天还是空的"/);
  assert.match(landing, /点上面一颗星摊开第一卦。算过的都留在这儿，按问法各归各的星座。/);
  // tailwind 把 svg 设成了 display:block，不写死 inline-block 这颗星会贴到左边去
  assert.match(landing, /opacity: \.5, display: "inline-block"/);
});

test("那一行「点一颗星」不压在星图上", () => {
  // 最底下那颗星的名字＋英文＋「算过 N 次」已经排到 285，绝对定位一压就撞上
  const cap = landing.slice(landing.indexOf("点一颗星 · 你问得越多") - 400, landing.indexOf("点一颗星 · 你问得越多"));
  assert.equal(cap.indexOf("position: \"absolute\""), -1, "又压回星图上了，会和最底下那颗星的字撞在一起");
});
