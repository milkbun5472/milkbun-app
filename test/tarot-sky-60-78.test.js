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
  assert.match(src, /lineHeight: 1\.7, marginBottom: 20 \} \}, m\.blurb/, "入口页得留着那一句说明");
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
  assert.match(src, /borderBottom: "1px solid " \+ N.line, cursor: "pointer"/, "一条就是一行，靠发丝线分开");
  assert.equal(codeOnly.indexOf('background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 14px"'), -1, "旧的框还在");
});

test("类型筛选不是一排药丸：形状、明暗、底下那道线一起变", () => {
  const chip = src.slice(src.indexOf("const chip = (k, label, cnt)"), src.indexOf("return h(\"div\", null,\n            // 搜索框"));
  assert.equal(chip.indexOf("borderRadius: 999"), -1, "又摆回药丸了（tabs-not-plain-pills）");
  assert.match(chip, /borderBottom: "1\.5px solid " \+ \(on \? N.tint : "transparent"\)/, "选中要有一道金线");
  assert.match(chip, /on \? h\("path", \{ d: sparkle\(6, 6, 5\.6\), fill: N.tint \}\)\n\s*: h\("circle"/, "选中是一颗亮星，没选是一个暗点——形状要不一样");
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
  // ⚠️这里原来写的是「整个塔罗都不该用公共 Head，因为它是 30px 大标题」——
  //   那是 v61.27 之前的 Head。它早就是紧凑栏了，理由过期，所以删掉重写
  //（施工规则/no-yes-unless.md）。v65.14 起 NightHead 就是【包了一层夜色参数的 Head】：
  //   长相照旧写在天上，但顶栏那几个挂点跟着白得，主题 CSS 抓得住这一页了。
  assert.match(landing, /h\(NightHead, \{ title: "塔罗", onBack: props\.onBack \}\)/, "落地页要用那条共用的紧凑标题栏");
  assert.match(src, /const NightHead = \(\{ title, onBack, right \}\) => \{ const N = nightNow\(\); return h\(Head, \{/, "NightHead 又自己手写了一条");
  // 三处（落地/入座/结果）共用同一条，别一层写在三处
  assert.equal((src.match(/h\(Head, \{/g) || []).length, 1, "Head 只该在 NightHead 那一处出现");
  assert.ok((src.match(/h\(NightHead, \{/g) || []).length >= 5, "落地/入座/选牌/生成中/结果，每一页都得走这一条");
  // 安全区归 Head 自己吃了（组件里那一处 safeTop(8)），塔罗这边不再另写一份；
  // 这一页要的是【夜色那档字色 + 透明底 + 不画分隔线】，那三样得传进去
  assert.match(src, /ink: N.ink, bg: "transparent", noLine: true/, "夜色那几样没传给顶栏");
  // 返回键的箭头也归 Head 画（它按 ink 上色），所以夜色那一档由上面那个 ink 一起管
  // 可点区和「右边留等宽操作位」也都归 Head 那一处管（46 宽 / 34 高、右侧 minWidth: SIDE）。
  // ⚠️所以这两条钉到共用组件上去——钉在塔罗自己身上的话，改了 Head 这儿也不会红。
  const comp = fs.readFileSync("js/components.js", "utf8");
  const head = comp.slice(comp.indexOf("function Head({"), comp.indexOf("function AvatarPicker("));
  assert.match(head, /const SIDE = 46;/, "共用顶栏的可点区变了，塔罗跟着变");
  assert.match(head, /style: \{ width: SIDE, height: 34 \}/, "返回键的可点区域不许缩水");
  assert.match(head, /style: \{ minWidth: SIDE, paddingRight: 8 \}/, "右边要留等宽操作位，标题才真的居中");
  // v60.78 起整个塔罗都在夜里，入座页与结果页也走同一条（见上一条断言）
});

test("整页都是这片天：往下滚，碎星跟着一起走", () => {
  assert.match(landing, /className: "h-full flex flex-col", style: nightPage/, "整页底色是夜色");
  assert.match(landing, /className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8", style: nightBody/, "正文那一层要 min-h-0（在 flex 里才滚得动），并且贴着碎星");
  assert.match(src, /nightBody\.backgroundImage = SKY_TILE;/, "碎星贴在【会滚的那一层】上，才会跟着内容走");
  assert.match(src, /const nightBody = \{ backgroundImage: null, backgroundSize: "360px 420px", backgroundRepeat: "repeat" \}/);
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
  assert.match(landing, /color: N.ink/);
  assert.match(landing, /color: N.sub/);
  assert.match(landing, /borderBottom: "1px solid " \+ N.line/);
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

// 她 2026-09-03 再补三件：「里面的背景还是白的」；店主那句要不要留；
// 「每张牌的解释放在牌后面点开可以看到，每次可以显示超过一张的背面」。

test("入座页和结果页也在夜里——纸上那套颜色一处都不剩", () => {
  const inside = (() => {
    const i = src.indexOf("  function Setup(props) {"), j = src.indexOf("  window.Tarot = Tarot;");
    assert.ok(i > 0 && j > i);
    return src.slice(i, j);
  })();
  assert.deepEqual([...new Set(inside.match(/\bt\.[a-zA-Z0-9]+/g) || [])], [],
    "入座页/选牌页/结果页里还留着纸上那套颜色");
  // 拿不到主题就别声明它：留一个没人读的 const t 是下一个人踩的坑
  assert.equal((inside.match(/const t = useTheme\(\);/g) || []).length, 0);
  assert.ok((inside.match(/style: nightPage/g) || []).length >= 4, "每一页的外壳都要是夜色");
  assert.ok((inside.match(/style: nightBody/g) || []).length >= 4, "会滚的那一层都要贴着碎星");
});

test("牌义搬到牌背上：翻开之后再点一下就翻过去，而且能同时翻好几张", () => {
  assert.match(src, /const \[flipped, setFlipped\] = useState\(\[\]\)/, "翻着的是【一组】牌，不是一次只能一张");
  assert.match(src, /const tapCard = i => revealed\.indexOf\(i\) < 0 \? revealCard\(i\)\n\s*: setFlipped\(p => p\.indexOf\(i\) >= 0 \? p\.filter\(x => x !== i\) : p\.concat\(i\)\)/,
    "第一下翻开、第二下翻到牌义、再一下翻回来");
  // 牌义那一面画在牌里，不是牌阵底下另起一列小卡
  assert.match(src, /faceUp !== false && meaning \? h\("div"/);
  assert.equal(src.indexOf('key: "ref" + i'), -1, "牌阵底下那一列牌义小卡该整个删掉");
  // 牌背上写的是【这一张真正的分析】（她 2026-09-03 更正：「我其实想要实际分析放背面」）。
  // 没有分析（还没解完 / 旧存档）才退回本地那段正逆牌意。
  assert.equal(src.indexOf("short: c.rev"), -1, "中途那版缩写该删干净");
  assert.match(src, /cardReference\(c\)\.keywords\)/, "关键词（每张都不同）要在");
  assert.match(src, /meaning === true \? cardReference\(c\)\.text : meaning\)/, "背面第一顺位是真正的分析");
  assert.match(src, /flipped\.indexOf\(i\) < 0 \? false : \(\(\(s\.reads \|\| \[\]\)\[i\] \|\| \{\}\)\.text \|\| true\)\)/, "把这一张的分析传进去");
  // 摊开的那一张占满一行：110px 宽塞 80~180 字，一行只有八个字
  assert.match(src, /\? \{ flex: "1 1 100%", width: "100%", maxWidth: "100%" \}/);
  assert.match(src, /aspectRatio: \(meaning && faceUp !== false\) \? "auto" : "2\/3\.4"/, "摊开那面不锁长宽比，长多少长多高");
  // 同一段话不许读两遍：下面那份逐张解读只剩名头和补牌
  assert.equal(src.indexOf('fontSize: 14, lineHeight: 1.8, color: N.ink, whiteSpace: "pre-wrap" } }, r.text)'), -1,
    "下面那份又把分析重复了一遍");
  assert.match(src, /点一张牌翻过去，背面写的就是这一张的分析 · 可以同时翻好几张/);
});

test("店里那句动静改成每次跟着这一卦生成，本地那五句只当兜底", () => {
  assert.match(src, /· moment（16~34 字）/, "解牌时顺便要这一句");
  assert.match(src, /\\"moment\\":\\"落桌那一刻的一句动静\\"/, "schema 里没这一栏，模型不会给");
  assert.match(src, /moment: String\(p\.moment \|\| ""\)\.trim\(\)\.slice\(0, 40\)/);
  assert.match(src, /shopMoment: out\.moment \|\| shopMoment/, "模型没给才回落到本地那五句");
  assert.match(src, /const SHOP_MOMENTS = \[/, "兜底那几句不许删——模型不给就没得写了");
});

test("牌阵分组不是一排药丸：每一组用它自己的摊牌形状当图标", () => {
  // 她 2026-09-03 那条 tab 规矩：一排药丸换个 app 照样成立；
  // 这几个点是牌真的摆在桌上的样子，换个 app 就不成立了
  assert.match(src, /const SPREAD_GLYPH = \{/);
  const glyph = src.slice(src.indexOf("const SPREAD_GLYPH = {"), src.indexOf("const DEFAULT_SPREAD"));
  ["basic", "relation", "inner", "custom"].forEach(g =>
    assert.ok(glyph.indexOf(g + ": [[") >= 0, g + " 这一组没有自己的形状"));
  const row = src.slice(src.indexOf("Object.keys(SPREAD_GROUPS)"), src.indexOf("!m.daily ? h(\"div\", { style: { display: \"grid\""));
  assert.equal(row.indexOf("borderRadius: 999"), -1, "又摆回药丸了");
  assert.match(row, /borderBottom: "1\.5px solid " \+ \(on \? N.tint : "transparent"\)/, "选中要有一道金线");
  assert.match(row, /r: on \? 1\.5 : 1\.05/, "选中那几点要变大——不能只靠颜色");
  assert.match(row, /fill: on \? N.tint : N.fog/);
});
