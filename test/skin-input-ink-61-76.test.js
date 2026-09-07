// 她 2026-09-04（截图）：「宝宝这个皮肤输入框的字是白色的」。
//
// 病因：输入框那一块的字色刷的是 headInk——【顶栏】的字色。LINE 那套顶栏是一块
// 深蓝灰，headInk 自然是白的；输入框的底却是浅灰 #f2f4f6。白字落在浅灰上＝看不见。
//
// 这是 tabs-not-plain-pills.md 里已经写过的那条坑（「深色主题里字色写 t.bg，
// 绝不许写死 #fff」）的另一种长法：不是写死，是【从别的那块底借了字色】。
// 所以这份测试不去钉「LINE 的输入框写没写 #1f1f1f」——那是冻长相。
// 它把五套皮肤整份 CSS 解出来，凡是【同一块里既定了底又定了字】的，一律验对比度。
// 以后再往里加一套、或者她自己改一套，白底白字都会在这儿被拦下来。
const test = require("node:test");
const assert = require("node:assert/strict");

function studio() {
  global.window = global;
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.document = { readyState: "complete", addEventListener() {}, head: { appendChild() {} },
    getElementById: () => null, createElement: () => ({ setAttribute() {}, style: {} }), documentElement: {} };
  delete require.cache[require.resolve("../js/theme-studio.js")];
  require("../js/theme-studio.js");
  return global.window.ThemeStudio;
}

// ---- 取色：认得 #rgb / #rrggbb / rgb() / rgba() / 渐变里那几个 hex ----
function colors(v) {
  if (!v || /^(none|transparent|inherit|currentcolor)$/i.test(v.trim())) return [];
  const out = [];
  for (const m of v.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    let x = m[1];
    if (x.length === 3) x = x.split("").map(c => c + c).join("");
    out.push([parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1]);
  }
  for (const m of v.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)/gi))
    out.push([+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]);
  return out;
}
const lum = ([r, g, b]) => {
  const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .0722 * f(b) + .7152 * f(g);
};
// 半透明的字压在底上先合成，否则 rgba(255,255,255,.85) 会被当成纯白
const over = (fg, bg) => fg[3] >= 1 ? fg : [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const ratio = (fg, bg) => {
  const a = lum(over(fg, bg)), b = lum(bg);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};

// ---- 把一份 CSS 拆成 { 选择器, 声明 } ----
function blocks(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => {
    const decl = {};
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decl[d.slice(0, i).trim()] = d.slice(i + 1).replace(/!important/, "").trim();
    }
    return { sel: m[1].trim().replace(/\s+/g, " "), decl };
  });
}

const st = studio();
// 挂在 thread（单聊）和 gthread（群聊）上，两处是同一份
const SKINS = (st.CSS_BUILTINS.thread || []).map(([nm, css]) => [nm, css]);

test("五套内置皮肤都在，而且都能解出规则块", () => {
  assert.ok(SKINS.length >= 5, "内置皮肤只剩 " + SKINS.length + " 套");
  for (const [nm, css] of SKINS) assert.ok(blocks(css).length > 8, nm + " 解不出规则块");
});

test("没有哪一处的色值漏成了 undefined", () => {
  // 新加一套皮肤时漏填一栏，模板会拼出 "color: undefined"——浏览器直接忽略这条，
  // 那一块悄悄退回默认色，而下面那条对比度检查解不出色、会把它整块跳过。
  // ⚠️所以这一条必须先站住，否则「漏填」会伪装成「通过」。
  for (const [nm, css] of SKINS)
    assert.doesNotMatch(css, /:\s*undefined/, nm + " 里有一栏没填，拼出了 undefined");
});

// 这几套是【照着真 app 的样子配的】，而真 app 本来就有一堆低对比：
// 微信绿底白箭头 2.38、LINE 绿气泡白字 2.26——照 WCAG 全都不及格，
// 但那正是它们认脸的地方，也是她要的样子。所以这里不按 WCAG 收，
// 只拦【真的看不见】那一档：白底白字大约 1.05，品牌那种低对比最低也有 2.2 出头。
// 1.8 这条线把两者分得干干净净。
const INVISIBLE = 1.8;
test("没有哪一块是字和底一个色（看不见那一档）", () => {
  const bad = [];
  for (const [nm, css] of SKINS) {
    for (const b of blocks(css)) {
      const bgv = b.decl.background || b.decl["background-color"];
      const fgv = b.decl.color;
      if (!bgv || !fgv) continue;
      const bgs = colors(bgv), fgs = colors(fgv);
      if (!bgs.length || !fgs.length) continue;
      // 渐变有好几个色：每个都得撑得住，不然字滑到某一头就没了
      for (const bg of bgs) for (const fg of fgs) {
        const r = ratio(fg, bg);
        if (r < INVISIBLE) bad.push(nm + " 「" + b.sel + "」 " + fgv + " 压在 " + bgv + " 上，对比度只有 " + r.toFixed(2));
      }
    }
  }
  assert.deepEqual(bad, [], "这几处字看不见：\n  " + bad.join("\n  "));
});

test("占位字单独给了色，也压得住输入框的底", () => {
  // ::placeholder 那一块只定字色不定底——它的底是输入框那一块的，上面那条查不到它。
  // 不显式给它一个色，浏览器会拿 color 淡一层：白字淡一层还是白的。
  const bad = [];
  for (const [nm, css] of SKINS) {
    const bs = blocks(css);
    const box = bs.find(b => /composer"\] input/.test(b.sel) && !/placeholder/.test(b.sel));
    const ph = bs.find(b => /placeholder/.test(b.sel));
    assert.ok(box, nm + " 没有输入框那一块");
    assert.ok(ph, nm + " 的占位字没单独给色——会跟着正文一起看不见");
    const bg = colors(box.decl.background)[0], fg = colors(ph.decl.color)[0];
    assert.ok(bg && fg, nm + " 输入框的底或占位色解不出来");
    const r = ratio(fg, bg);
    if (r < INVISIBLE) bad.push(nm + " 占位字对比度只有 " + r.toFixed(2));
  }
  assert.deepEqual(bad, [], "\n  " + bad.join("\n  "));
});

test("字色必须配自己那块底，不许从别处借", () => {
  // 这一条是病因本身，钉在模板上而不是钉在算出来的色值上：
  // headInk 和 inputInk 在几套皮肤里【碰巧相等】（顶栏和输入框都是白底），
  // 按色值查根本分不出「配对了」和「借错了」——只有看模板才知道。
  const src = require("node:fs").readFileSync("js/theme-studio.js", "utf8");
  const tpl = src.slice(src.indexOf("const chatSkinCSS = o =>"), src.indexOf("// 各家最认脸的"));
  const comp = tpl.slice(tpl.indexOf('[data-wk="composer"] input'));
  assert.ok(comp.length > 200, "抠不出输入框那一段");
  assert.doesNotMatch(comp, /o\.headInk/, "输入框的字色又去借顶栏的 headInk 了");
  assert.match(comp, /color: ' \+ o\.inputInk/, "输入框没有自己的字色");
  assert.match(comp, /color: ' \+ o\.inputHint/, "占位字没有自己的色");

  // headInk 只许出现在【底也是 o.head 的那几块】里。用白名单而不是数个数：
  // 数个数拦不住「借错了但总数没变」，白名单逼着新增的那一处写清楚凭什么。
  const WHERE_HEADINK_IS_OK = {
    'chathead': "顶栏自己",
    'headink': "顶上那一片里的正字（名字、返回键、更多、此刻在做什么）——它们铺的就是 o.head"
  };
  // 选择器和 color 那一行常常不在同一行，所以顺着往下走、记住最近一个挂点
  const used = [];
  let cur = "";
  for (const l of tpl.split("\n")) {
    const m = l.match(/data-wk="([a-z]+)"/);
    if (m) cur = m[1];
    if (l.includes("o.headInk")) used.push(cur || l.trim());
  }
  const stray = used.filter(k => !(k in WHERE_HEADINK_IS_OK));
  assert.deepEqual(stray, [], "这几处借了顶栏的字色，却不是铺在顶栏那块底上：" + stray.join(" / "));
  assert.deepEqual([...new Set(used)].sort(), Object.keys(WHERE_HEADINK_IS_OK).sort(),
    "白名单和实际用到的地方对不上——少了的那一处是不是被删了？");
  // 此刻日程条敢用 headink 那一档，前提是它那条底真的刷成了 o.head
  assert.match(tpl, /\[data-wk="now"\]\[data-dev="0"\] \{ background: ' \+ o\.head/,
    "此刻日程条没吃顶栏那块底，那它就不该用顶栏那档字色");
});

test("顶上那一片每一格都单独挂了点（行内色压不过去）", () => {
  // 那些 color 写在行内样式上：皮肤只给外层刷一个 color 是继承不下去的
  // （行内赢过普通规则）。所以每一格都得有自己的挂点，规则还得带 !important。
  // 图标走 stroke（属性，不是行内样式），所以图标那条能一起压住。
  const comp = require("node:fs").readFileSync("js/components.js", "utf8");
  const core = require("node:fs").readFileSync("js/core.js", "utf8");
  // 挂点得能透到 DOM 上：Svg 和 Marquee 原来都不收这个参数
  assert.match(core, /function Svg\(\{[\s\S]{0,200}?\n  wk\n\}\)/, "Svg 收不了挂点，图标一个都挂不上");
  assert.match(core, /"data-wk": wk \|\| undefined,/, "Svg 没把挂点放到 DOM 上");
  assert.match(comp, /function Marquee\(\{ children, style, className, wk \}\)/, "Marquee 收不了挂点");
  assert.match(comp, /"data-wk": wk \|\| undefined/, "Marquee 没把挂点放到 DOM 上");

  const i = comp.indexOf('"data-wk": "now", "data-dev"');
  assert.ok(i > 0, "此刻日程条没挂 now / data-dev");
  const strip = comp.slice(i, i + 1400);
  assert.ok(strip.includes('"data-wk": "nowdot"'), "此刻日程条里少了 nowdot");
  // NOW 和时刻是同一档淡字，两格都得挂
  assert.equal((strip.match(/"data-wk": "headdim"/g) || []).length, 2, "NOW 和时刻要各挂一个 headdim");
  assert.ok(strip.includes('wk: "headink"'), "那条正文没把 headink 传给 Marquee");
  assert.match(strip, /IChevR, \{ size: 13, color: t\.fog, wk: "headdim"/, "那个小箭头没挂点");

  // 两个顶栏（单聊 / 群聊）都得挂上——一处挂了一处没挂，正是「一层写在两处」那个病
  // ⚠️v65.14 起线下那两条顶栏也挂了 chathead（它们压在聊天页上，皮肤要抓得住），
  //   所以一共四处；这一条测的是【单聊和群聊那两条】，按后面跟着的内容认出来。
  const heads = [...comp.matchAll(/"data-wk": "chathead"/g)].map(m => comp.slice(m.index, m.index + 2600))
    .filter(x => x.indexOf("safeTop(20)") >= 0);   // 单聊/群聊那两条是 safeTop(20)，线下那两条是 (12)
  assert.equal(heads.length, 2, "顶栏应该正好两处（单聊、群聊），现在是 " + heads.length + " 处");
  heads.forEach((hd, n) => {
    const who = n === 0 ? "单聊顶栏" : "群聊顶栏";
    // ⚠️别只查「这一片里出现过 headink」——右上角那颗齿轮挂上了就永远查得到，
    //   左上角返回键漏了也发现不了。逐个图标查。
    assert.match(hd, /IArrow, \{\s*\n?\s*size: 19,\s*\n?\s*color: t\.ink,\s*\n?\s*wk: "headink"/, who + "的返回键没挂 headink");
    assert.match(hd, /(IDots|GConfig), \{\s*\n?\s*size: 20,\s*\n?\s*color: t\.ink,\s*\n?\s*wk: "headink"/, who + "右上角那颗没挂 headink");
    assert.ok(hd.includes('"data-wk": "headink"'), who + "的名字没挂 headink");
    assert.match(hd, /IChevD, \{\s*\n?\s*size: 1[34],\s*\n?\s*color: t\.fog,\s*\n?\s*wk: "headdim"/, who + "那个小箭头没挂 headdim");
    assert.ok(/"data-wk": chatMode === [^\n]*"headdim"/.test(hd), who + "的副标题没挂 headdim");
  });

  // 线下那一条【故意】不挂：线下整块压根不吃聊天皮肤（那儿一个 data-wk 都没有），
  // 它的底还是主题色，t.fog 在那儿是对的。挂上反而会只有这一条变色。
  const off = comp.slice(comp.indexOf('OFFLINE · 线下 · 轻触切换'));
  const offStrip = off.slice(0, off.indexOf("IChevR"));
  assert.ok(!/data-wk/.test(offStrip), "线下那一条也挂上了挂点——那儿不吃聊天皮肤，只会变得跟四周不搭");
});

test("顶上那两档字压在顶栏那块底上也看得清", () => {
  // 这两档只定了 color，底在 chathead / now 那两条规则里——通用那条检查看不到它们。
  const bad = [];
  for (const [nm, css] of SKINS) {
    const bs = blocks(css);
    const hd = bs.find(b => b.sel === '[data-wk="chathead"]');
    const bar = bs.find(b => /data-wk="now"\]\[data-dev="0"/.test(b.sel));
    assert.ok(hd && bar, nm + " 少了顶栏或此刻日程条的底色");
    // 这两块是同一片，底必须是同一个色——不然「顶栏那档字色」在下面那条上就不成立了
    assert.equal(bar.decl.background, hd.decl.background, nm + " 此刻日程条的底跟顶栏不是同一块");
    const bg = colors(hd.decl.background)[0];
    assert.ok(bg, nm + " 顶栏底色解不出来");
    for (const wk of ["headink", "headdim"]) {
      // 文字那条刷 color，图标那条刷 stroke——两条都得在，少一条就有半边不跟着走
      const txt = bs.find(x => x.sel === '[data-wk="' + wk + '"]');
      const icon = bs.find(x => x.sel === 'svg[data-wk="' + wk + '"]');
      assert.ok(txt, nm + " 少了 [data-wk=\"" + wk + "\"]（文字那条）");
      assert.ok(icon && icon.decl.stroke, nm + " 少了 svg[data-wk=\"" + wk + "\"]（图标那条）——图标不会跟着换色");
      assert.equal(icon.decl.stroke, txt.decl.color, nm + " 的 " + wk + " 图标和文字不是同一个色");
      const r = ratio(colors(txt.decl.color)[0], bg);
      if (r < INVISIBLE) bad.push(nm + " " + wk + " 对比度只有 " + r.toFixed(2));
    }
  }
  assert.deepEqual(bad, [], "\n  " + bad.join("\n  "));
});

test("改了内置就得让她重新灌一次（预设是拷贝进编辑框的，不是引用）", () => {
  // 她 2026-09-03 撞过一次：挂点全补好了，她手上那份 CSS 还是旧的。
  assert.ok(st.SKIN_VER >= 4, "改了内置皮肤却没把 SKIN_VER 往上抬，她那份不会提示更新");
  for (const [, css] of SKINS) assert.match(css, new RegExp("内置 · .+ · v" + st.SKIN_VER));
});
