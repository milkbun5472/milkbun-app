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
  const code = tpl.split("\n").filter(l => !/^\s*(\/\/|'\/\*|\s*[⚠·])/.test(l.trim()) && !/^\s*\/\//.test(l)).join("\n");
  const comp = code.slice(code.indexOf('[data-wk="composer"] input'));
  assert.ok(comp.length > 200, "抠不出输入框那一段");
  assert.doesNotMatch(comp, /o\.headInk/, "输入框的字色又去借顶栏的 headInk 了");
  assert.match(comp, /color: ' \+ o\.inputInk/, "输入框没有自己的字色");
  assert.match(comp, /color: ' \+ o\.inputHint/, "占位字没有自己的色");
  // headInk 只许出现在顶栏那一块里
  const heads = [...code.matchAll(/o\.headInk/g)].length;
  assert.equal(heads, 1, "headInk 被用在了 " + heads + " 处——它只该给顶栏");
});

test("改了内置就得让她重新灌一次（预设是拷贝进编辑框的，不是引用）", () => {
  // 她 2026-09-03 撞过一次：挂点全补好了，她手上那份 CSS 还是旧的。
  assert.ok(st.SKIN_VER >= 4, "改了内置皮肤却没把 SKIN_VER 往上抬，她那份不会提示更新");
  for (const [, css] of SKINS) assert.match(css, new RegExp("内置 · .+ · v" + st.SKIN_VER));
});
