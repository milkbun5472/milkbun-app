const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");

// 群里 2026-10-03：「换了一起学页面的底色进去还是一片绿油油的」——这页的色是模块加载时写死的。
test("一起学的活页色每次读都现取主题台那几支色，没改的照旧是底稿", () => {
  const a = src.indexOf("const STUDY_SKIN_BASE = {"), b = src.indexOf("const STUDY_MODE_SKIN");
  const blk = src.slice(a, b);
  let tokens = {};
  const pagePalette = (page, base, aliases) => {
    assert.equal(page, "study");
    const out = { ...base };
    Object.keys(base).forEach(k => { const t = aliases[k] || k; if (tokens[t]) out[k] = tokens[t]; });
    return out;
  };
  const SKIN = new Function("pagePalette", blk + "\nreturn STUDY_SKIN;")(pagePalette);
  assert.match(SKIN.desk, /#e5e9e1/, "没改过就是原来的绿桌面");
  tokens = { bg: "#f6e9ef", bg2: "#ffffff", accent: "#c25a7a" };
  assert.equal(SKIN.desk, "#f6e9ef", "改了这一页的底色，桌面就得跟着变——而且不用重开 app");
  assert.equal(SKIN.paper, "#ffffff");
  assert.equal(SKIN.red, "#c25a7a");
  assert.equal(SKIN.ink, "#30352f", "没改的那几支不动");
});

test("三种模式的色、半透明那几层纸也跟主题台走；没改照旧各是各的", () => {
  const a = src.indexOf("function studyPaperA("), b = src.indexOf("function studyModeSkin(");
  let tokens = {};
  const window = { ThemeStudio: { tokensFor: () => tokens } };
  const paletteAlpha = (c, al) => c + al;
  const r = new Function("window", "paletteAlpha", src.slice(a, b) + "\nreturn { STUDY_MODE_SKIN, studyPaperA };")(window, paletteAlpha);
  assert.equal(r.STUDY_MODE_SKIN.costudy.accent, "#78698e");
  assert.equal(r.studyPaperA(.9), "rgba(251,248,239,0.9)");
  tokens = { tint: "#c25a7a", bg2: "#ffffff" };
  assert.equal(r.STUDY_MODE_SKIN.teach.accent, "#c25a7a");
  assert.equal(r.STUDY_MODE_SKIN.nv1.soft, "#c25a7a24");
  assert.equal(r.STUDY_MODE_SKIN.nv1.label, "三人课堂");
  assert.equal(r.studyPaperA(.9), "#ffffffe6");
  assert.ok(!/"rgba\(251,248,239,\.\d+\)"/.test(src), "写死的半透明纸色又回来了");
});
