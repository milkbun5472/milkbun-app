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
  assert.match(src, /borderBottom: "1px solid " \+ t\.line, cursor: "pointer"/, "一条就是一行，靠发丝线分开");
  assert.equal(codeOnly.indexOf('background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 14px"'), -1, "旧的框还在");
});

test("类型筛选不是一排药丸：形状、明暗、底下那道线一起变", () => {
  const chip = src.slice(src.indexOf("const chip = (k, label, cnt)"), src.indexOf("return h(\"div\", null,\n            // 搜索框"));
  assert.equal(chip.indexOf("borderRadius: 999"), -1, "又摆回药丸了（tabs-not-plain-pills）");
  assert.match(chip, /borderBottom: "1\.5px solid " \+ \(on \? GOLD : "transparent"\)/, "选中要有一道金线");
  assert.match(chip, /on \? h\("path", \{ d: sparkle\(6, 6, 5\.6\), fill: GOLD \}\)\n\s*: h\("circle"/, "选中是一颗亮星，没选是一个暗点——形状要不一样");
  assert.match(chip, /width: on \? 12 : 8/, "大小也要不一样，不能只靠颜色");
});
