const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
// ficTagStyle 真跑（skinRGB 从 core 借过来）。
// ⚠️v61.11 起 feed 不再是深浅交替的卡片（她点名去掉框，改成翻开这一本的目录页），
// ficTone 随之删掉，这里只剩标签那一套。
const F = (() => {
  const a = fic.indexOf("  function ficTagStyle(kind, t, onDark) {");
  const b = fic.indexOf("  function FicTag(props) {");
  assert.ok(a > 0 && b > a, "抠不出 ficTagStyle");
  const rgb = core.slice(core.indexOf("function skinRGB(hex)"), core.indexOf("// 纹理表"));
  return new Function(rgb + fic.slice(a, b) + "\nreturn { ficTagStyle, hexA };")();
})();
const T = { bg: "#ece8e1", bg2: "#f6f4ef", ink: "#1b1a17", sub: "#4b493f", fog: "#96938a", line: "#ddd8cd", accent: "#c25a4a" };

// 她 2026-08-30：「做 relative position…把它上面深色的删了它顶上就变成深色，目录数字也会变」
test("深浅和序号【由此刻排第几算出来】，不存在文章上", () => {
  const i = fic.indexOf("    const idx = Number(props.index) || 0;");
  assert.ok(i > 0, "FicCard 没接位置");
  const seg = fic.slice(i, i + 340);
  assert.match(seg, /const isLead = idx === 0 && !props\.noLead;/);
  assert.doesNotMatch(fic, /const dark = isLead/, "又把深浅交替的卡片加回来了");
  assert.match(seg, /const no = String\(idx \+ 1\)\.padStart\(2, "0"\);/, "序号不是按位置算的");
  // ⚠️绝不许把颜色/序号写进 fic 存起来——存了就不会随删除、筛选重排
  assert.doesNotMatch(fic, /f\.(dark|isDark|cardTone|seq|no)\s*=/, "把深浅或序号存到文章上了");
  // 传进去的必须是【当前这一屏】的下标
  assert.match(fic, /list\.length \? list\.map\(function \(f, i\) \{/);
  assert.match(fic, /index: i, leadLabel: view === "shelf" \? "ON THE SHELF" : "TOP OF THE FEED"/);
  // 「我发布的」那页每篇都是她自己写的，挑一篇当头条没意义
  assert.match(fic, /h\(FicCard, \{ key: f\.id, fic: f, index: i, noLead: true,/);
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
  assert.match(fic, /ficTagStyle\(ficTagKind\(props\.tag\), t, !!props\.onDark\)/);
});

test("子节点用数组传，不能拿 + 拼元素", () => {
  // 拼出来是 [object Object]，真机上 CP 那一行直接烂掉（这次踩到）
  assert.doesNotMatch(fic, /\+ "　·　" \+ h\(/);
  assert.doesNotMatch(fic, /h_cp/, "撤掉的东西要删干净");
  assert.match(fic, /"by " \+ author \+ "　·　",\n\s*h\("span", \{ style: \{ color: t\.accent \} \}, cpLabel\(f\.cp, characters, props\.userName\)\)/);
});
