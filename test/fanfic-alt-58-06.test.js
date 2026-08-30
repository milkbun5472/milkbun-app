const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
// ficTone / ficTagStyle 真跑（skinRGB 从 core 借过来）
const F = (() => {
  const a = fic.indexOf("  function ficTagStyle(kind, t, onDark) {");
  const b = fic.indexOf("  function FicTag(props) {");
  assert.ok(a > 0 && b > a, "抠不出 ficTone/ficTagStyle");
  // ⚠️ficTone 现在还用 skinIsDark（core）和 skinShade（本文件）——
  // 抠的时候依赖要一起带上，少一个就是 "xxx is not defined"，红得跟真 bug 一样
  const rgb = core.slice(core.indexOf("function skinRGB(hex)"), core.indexOf("// 纹理表"));
  const shade = fic.slice(fic.indexOf("  function skinShade(hex, k) {"), fic.indexOf("\n  }", fic.indexOf("  function skinShade(hex, k) {")) + 4);
  return new Function(rgb + shade + fic.slice(a, b) + "\nreturn { ficTone, ficTagStyle, hexA };")();
})();
const T = { bg: "#ece8e1", bg2: "#f6f4ef", ink: "#1b1a17", sub: "#4b493f", fog: "#96938a", line: "#ddd8cd", accent: "#c25a4a" };

// 她 2026-08-30：「做 relative position…把它上面深色的删了它顶上就变成深色，目录数字也会变」
test("深浅和序号【由此刻排第几算出来】，不存在文章上", () => {
  const i = fic.indexOf("    const idx = Number(props.index) || 0;");
  assert.ok(i > 0, "FicCard 没接位置");
  const seg = fic.slice(i, i + 340);
  assert.match(seg, /const isLead = idx === 0 && !props\.noLead;/);
  assert.match(seg, /const dark = isLead \|\| idx % 2 === 0;/, "交替不是按位置算的");
  assert.match(seg, /const no = String\(idx \+ 1\)\.padStart\(2, "0"\);/, "序号不是按位置算的");
  // ⚠️绝不许把颜色/序号写进 fic 存起来——存了就不会随删除、筛选重排
  assert.doesNotMatch(fic, /f\.(dark|isDark|cardTone|seq|no)\s*=/, "把深浅或序号存到文章上了");
  // 传进去的必须是【当前这一屏】的下标
  assert.match(fic, /list\.length \? list\.map\(function \(f, i\) \{/);
  assert.match(fic, /index: i, leadLabel: view === "shelf" \? "ON THE SHELF" : "TOP OF THE FEED"/);
  // 「我发布的」那页每篇都是她自己写的，挑一篇当头条没意义
  assert.match(fic, /h\(FicCard, \{ key: f\.id, fic: f, index: i, noLead: true,/);
});

test("深浅两套 token 都从主题算，不写死黑白", () => {
  const d = F.ficTone(true, T), l = F.ficTone(false, T);
  assert.equal(d.bg, T.ink, "深卡＝t.ink 底");
  assert.equal(l.bg, T.bg2, "浅卡＝t.bg2 底");
  assert.equal(d.ink, T.bg2, "深卡上的字得是 bg2，不是写死的白");
  assert.ok(d.onDark && !l.onDark);
  // 深色主题／深色书页下：高对比那一块【仍然得是暗的】。
  // v58.06 时它拿 t.ink 当底（浅色主题下 ink 是深的，成立）；
  // v58.12 上了深夜书页才发现，深底下 ink 是【浅】的，照那么做就是一大块亮米色
  // 怼在脸上，关灯读正好晃眼。所以这条改成认【结果是暗的】，不认它等于哪个字段。
  const DK = { bg: "#17171a", bg2: "#202024", ink: "#eae6df", sub: "#bbb", fog: "#888", line: "#333", accent: "#c98d5a" };
  const dk = F.ficTone(true, DK);
  const lum = c => { const m = String(c).match(/\d+/g); return m ? (+m[0] * 299 + +m[1] * 587 + +m[2] * 114) / 1000 : 255; };
  assert.ok(lum(dk.bg) < 60, "深底上的高对比卡还是亮的，深夜模式就废了：" + dk.bg);
  assert.ok(!/^#(fff|eae|f6f)/i.test(String(dk.bg)), "别拿浅色的 ink 当底");
  assert.equal(dk.ink, DK.ink, "深底上字还是用 ink，别反过来");
  [d, l, F.ficTone(true, DK)].forEach(x => Object.keys(x).forEach(k => {
    if (k === "onDark") return;
    assert.doesNotMatch(String(x[k]), /^#(fff|000)/i, k + " 写死了黑白");
  }));
});

test("深卡上的标签得提亮——#a4342c 压在墨底上读不出来", () => {
  const w = F.ficTagStyle("warn", T, true), wl = F.ficTagStyle("warn", T, false);
  assert.equal(wl.color, "#a4342c");
  assert.equal(w.color, "#e8907e", "深卡上还是那个深红");
  assert.notEqual(F.ficTagStyle("sweet", T, true).color, F.ficTagStyle("sweet", T, false).color);
  assert.notEqual(F.ficTagStyle("form", T, true).color, F.ficTagStyle("form", T, false).color);
  // 认不出档的那一档在深卡上也得换
  assert.match(F.ficTagStyle("plain", T, true).color, /255,255,255/);
  assert.equal(F.ficTagStyle("plain", T, false).color, T.fog);
  // 卡片得把深浅传给标签，不然标签自己不知道压在什么底上
  assert.match(fic, /h\(FicTag, \{ key: i, tag: tag, onDark: c\.onDark, onClick: props\.onTag \}\)/);
  assert.match(fic, /ficTagStyle\(ficTagKind\(props\.tag\), t, !!props\.onDark\)/);
});

test("头条那块深色是给整屏找落点的，不是装饰", () => {
  const i = fic.indexOf("    if (isLead) return h(\"button\", {");
  assert.ok(i > 0, "没有头条这一支");
  const seg = fic.slice(i, i + 1500);
  assert.match(seg, /background: c\.bg, borderRadius: 16/);
  assert.match(seg, /fontSize: 25, lineHeight: 1\.15/, "头条标题要比别的大一截，尺度对比");
  assert.match(seg, /props\.leadLabel \|\| "TOP OF THE FEED"/);
  // 书架那页不该写「TOP OF THE FEED」
  assert.match(fic, /"ON THE SHELF"/);
});

test("子节点用数组传，不能拿 + 拼元素", () => {
  // 拼出来是 [object Object]，真机上 CP 那一行直接烂掉（这次踩到）
  assert.doesNotMatch(fic, /\+ "　·　" \+ h\(/);
  assert.doesNotMatch(fic, /h_cp/, "撤掉的东西要删干净");
  assert.match(fic, /"by " \+ author \+ "　·　",\n\s*h\("span", \{ style: \{ color: c\.cp \} \}, cpLabel\(f\.cp, characters, props\.userName\)\)\)\),/);
});
