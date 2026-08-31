const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const grab = (a, b, cap) => {
  const i = comp.indexOf(a), j = comp.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return comp.slice(i, j);
};
// 那几个是纯函数，抠出来真跑——别拿字符串比对代替测量
const skinSrc = grab("const offDark = t =>", "function OffCard({");
const K = new Function("skinIsDark", skinSrc + "\nreturn { offDark, offA, offSceneBg, offCardSkin };")(
  hex => { const v = String(hex).replace("#", ""); const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 < 128; });
const LIGHT = { bg: "#ece8e1", bg2: "#f6f4ef", ink: "#1b1a17", sub: "#4b493f", fog: "#96938a", line: "#ddd8cd", accent: "#c25a4a", tint: "#3f6d8c" };
const DARK = { ...LIGHT, bg: "#191713", bg2: "#232019", line: "#3a352c", accent: "#d98a6a", tint: "#6f9ab5" };
const card = grab("  if (isNarr) {", "\n}\n// ---- 群聊线下模式");

// 她 2026-08-31：「线下卡片样式太单调了，纯色框配纯色背景」。
// 单调的根子不在框素不素，在【旁白、角色、我】被画成了同一个盒子——
// 一屏下来十几个一模一样的方块，再给每个盒子加花纹还是十几个一样的东西。
test("三种东西画得不一样：旁白根本不给框", () => {
  const narr = card.slice(0, card.indexOf("  return h(\"div\", { className: \"my-2.5\" },"));
  assert.ok(!/background: t\.bg2|offCardSkin/.test(narr), "旁白还是一个盒子");
  assert.match(narr, /const nShort = nText\.length <= 34;/, "长短旁白没分开");
  // 短的居中当场次标题，长的靠左走一道竖线——居中的长段落最难读，那是原来最扎眼的地方
  assert.match(narr, /nShort\n *\? h\("div", \{ className: "flex items-center gap-3" \}, rule\(\)/, "短旁白不是居中场次标题");
  assert.match(narr, /borderLeft: "2px solid " \+ offA\(t\.tint,/, "长旁白没有那道竖线");
  assert.match(narr, /whiteSpace: "pre-wrap"/, "长旁白把换行吃掉了");
});

test("角色和我：左边那道是各自的颜色", () => {
  assert.match(card, /offCardSkin\(t, isUser \? \(t\.accent \|\| meChar\.color\) : \(\(spk && spk\.color\) \|\| t\.tint\)\)/, "左边那道颜色没按说话人分");
  const a = K.offCardSkin(LIGHT, "#8a5a4a"), b = K.offCardSkin(LIGHT, "#c25a4a");
  assert.notEqual(a.borderLeft, b.borderLeft, "换个说话人左边那道颜色没变");
  assert.match(a.borderLeft, /^3px solid rgba\(138,90,74,/, "颜色没解析对");
  assert.ok(a.boxShadow.indexOf("inset 0 1px 0") >= 0, "没有顶光,纸就是平的");
  assert.ok(a.backgroundImage.indexOf("linear-gradient") === 0, "纸面没有渐变");
  // 自拍那张卡也得跟着走，不然它就是全屏唯一一个纯色框
  assert.match(comp, /h\("div", \{ style: offCardSkin\(t, \(spk && spk\.color\) \|\| t\.tint\) \}/, "自拍卡还是纯色框");
});

test("深浅两套皮肤真的分叉，不是同一份值", () => {
  assert.equal(K.offDark(DARK), true);
  assert.equal(K.offDark(LIGHT), false);
  const l = K.offCardSkin(LIGHT, "#8a5a4a"), d = K.offCardSkin(DARK, "#8a5a4a");
  assert.notEqual(l.backgroundImage, d.backgroundImage, "深色下还往纸上刷 85% 的白");
  assert.notEqual(l.boxShadow, d.boxShadow, "深浅用同一份阴影");
  assert.notEqual(K.offSceneBg(LIGHT).backgroundImage, K.offSceneBg(DARK).backgroundImage);
});

test("颜色从主题里长出来——她换皮肤，这一层跟着走", () => {
  const one = K.offSceneBg(LIGHT).backgroundImage;
  const two = K.offSceneBg({ ...LIGHT, tint: "#2e7d5a", accent: "#7b4f9e" }).backgroundImage;
  assert.notEqual(one, two, "场景底没跟着主题色走——写死了");
  assert.ok(two.indexOf("46,125,90") > 0, "新的 tint 没进去");
  assert.ok(two.indexOf("123,79,158") > 0, "新的 accent 没进去");
  // 底衬不许喧宾夺主：每一层都得是很淡的一层
  const alphas = (two.match(/rgba\([^)]*?,([01]?\.\d+)\)/g) || []).map(x => Number(x.match(/,([01]?\.\d+)\)$/)[1]));
  assert.ok(alphas.every(a => a <= 0.85), "底衬里有一层太重了");
});

test("坏颜色不许把整页画崩", () => {
  assert.match(K.offA("", 0.5), /^rgba\(/);
  assert.match(K.offA(null, 0.5), /^rgba\(/);
  assert.match(K.offA("#abc", 0.5), /^rgba\(/, "三位十六进制没兜住");
  assert.equal(K.offA("#8a5a4a", 0.5), "rgba(138,90,74,0.5)");
});

test("她自己选的背景图那一路不动——不该被我压一层东西上去", () => {
  const shells = (comp.match(/style: os\.bg \? \{ backgroundImage: "url/g) || []);
  assert.equal(shells.length, 2, "单人线下和群线下两个外壳没都改到");
  assert.equal((comp.match(/: offSceneBg\(t\) \}/g) || []).length, 2, "有一个外壳还是纯色底");
  assert.equal((comp.match(/backgroundRepeat: "no-repeat" \} : offSceneBg\(t\)/g) || []).length, 2,
    "底衬没挂在「没有背景图」那一支上——有图时会被压一层");
});
