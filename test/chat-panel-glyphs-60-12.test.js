const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-09-02 截图：+面板里「发语音」和「视频通话」两个格子是空的。
// 病根不是漏画了两个图标，是这排格子借的是【查手机那套 app 图标】(PGlyph)：
// 它压根没有 recordings / video / redpacket 这几个 key，引用了也不报错——
// PGlyph 里是 `kids[k] || []`，认不出就画个空 svg，**静悄悄地空着**。
// 所以真正的修是给这排自己的一套，并且在这里钉死「引用的 key 必须真的存在」。

const cgKeys = (() => {
  const i = comp.indexOf("function CGlyph(");
  assert.ok(i > 0, "CGlyph 得在 components.js 里");
  const body = comp.slice(comp.indexOf("const kids = {", i), comp.indexOf("return h(Svg,", i));
  return new Set((body.match(/^\s{4}([a-z]+):/gm) || []).map(x => x.trim().replace(":", "")));
})();

const panels = (() => {
  const out = [];
  const re = /const PANEL = \[(\[.+?\])\]/g;
  let m;
  while ((m = re.exec(comp))) out.push((m[1].match(/"[^"]+"\]/g) || []).map(x => x.slice(1, -2)));
  return out;
})();

test("聊天 +面板有两排（单聊 / 群聊），都读得出来", () => {
  assert.equal(panels.length, 2);
  panels.forEach(p => assert.ok(p.length >= 10, "一排至少十个格子，读到的是 " + p.length));
});

test("每个格子的图标都真的存在——认不出来只会画一个空 svg，不会报错", () => {
  panels.forEach((p, i) => p.forEach(k => {
    assert.ok(cgKeys.has(k), "第 " + (i + 1) + " 排引用了 CGlyph 里没有的图标：" + k);
  }));
});

test("同一排里没有两个格子共用一个图标", () => {
  panels.forEach((p, i) => {
    const dup = p.filter((k, j) => p.indexOf(k) !== j);
    assert.deepEqual(dup, [], "第 " + (i + 1) + " 排有撞车的图标：" + dup.join("/"));
  });
});

test("这排不许再回去借查手机那套 app 图标", () => {
  const seg = comp.slice(comp.indexOf("PANEL.map("));
  assert.ok(!/PANEL\.map\(\(\[k, zh, glyph\]\)[\s\S]{0,900}?PGlyph/.test(comp),
    "+面板渲染里不该再出现 PGlyph");
});

// ── 位置：那行经纬度是 Math.random() 掷出来的，整页都在围着一个假读数转 ──
test("随机经纬度整条链都要拆干净", () => {
  assert.ok(!/makeCoords/.test(app), "app.js 里不该再有 makeCoords");
  assert.ok(!/makeCoords/.test(comp.replace(/^\s*\/\/.*$/gm, "")), "components.js 的活代码里不该再有 makeCoords");
  const seg = comp.slice(comp.indexOf("function GeoStampSheet("), comp.indexOf("function menuItemsForKind"));
  assert.ok(!/coords/.test(seg), "发位置这一页不该再带坐标");
  const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/GEO-STAMP|SET YOUR LOCATION|CONFIRM & SEND/.test(live), "借来的那套英文标头要删掉");
});

test("模型回的 location 只认地名——coords 那个口子也一起封上", () => {
  assert.match(app, /if \(parsed\.location && parsed\.location\.name\)/);
});

test("位置卡还是照实说了它是谁、什么时候发的", () => {
  const seg = comp.slice(comp.indexOf("function GeoCard("), comp.indexOf("// 发位置:"));
  assert.ok(/m\.name \|\|/.test(seg), "卡面正中是地名");
  // 底下那一行必须【同时】说出是谁、和什么时候——两样任缺一样这行就没意义了
  assert.match(seg, /isU \?[\s\S]{0,120}who[\s\S]{0,60}\+ clock/, "谁在那儿 · 什么时候，得真拼进渲染里");
  assert.match(seg, /new Date\(m\.ts[\s\S]{0,200}const clock = [\s\S]{0,80}getHours/, "时刻取自这条消息自己的时间戳");
});

// ── 她 2026-09-02：「你本来就爱操心这句会把所有人都变成这个样吧」 ──
test("禁模板那条里不许再给「允许写什么」的具体样子", () => {
  const i = engine.indexOf("const STOCK_REPLY_BAN");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.ok(!/爱操心|爱做饭|爱指挥/.test(rule),
    "整段都在禁模板，唯一那处「允许写什么」的例子会成为里面唯一可复制的东西");
  assert.match(rule, /还是只有你会说的那一句/, "换成维度和判据");
});
