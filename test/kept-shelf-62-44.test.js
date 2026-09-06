// 她 2026-09-04：「我们说好的里面还是一条条很无聊，还有时光胶囊里面也是，
// 甚至还在用 emoji。然后这个收着的这些除了交换日记背景也都没做」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const scr = R("js/screens.js"), cap = R("js/capsule.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

// ── 时光胶囊：不许再有 emoji ────────────────────────────────
// 上一版每条左边挂一个 🔒 / ⏳ / 💌。emoji 在她机器上会渲成豆腐块——
// 情侣空间 v61.29 已经因为同一件事翻过一次（「有些有 emoji 有些还是一个方框」）。
test("时光胶囊里一个 emoji 都不许剩", () => {
  const bad = [...cap].filter(ch => {
    const c = ch.codePointAt(0);
    return (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x2190 && c <= 0x27BF) || c === 0xFE0F;
  });
  // 注释里的箭头和圈号是给人看的，不进界面；只判【字符串字面量里】的
  const inUI = (cap.match(/"[^"\n]*"/g) || []).join("").split("").filter(ch => {
    const c = ch.codePointAt(0);
    return (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x2600 && c <= 0x27BF) || c === 0xFE0F;
  });
  assert.deepEqual(inUI, [], "界面文案里还留着这些字符当图标：" + inUI.join(""));
  assert.ok(bad.length < 40, "注释里也塞太多符号了");
  // 顺带：英文标题也清掉（施工规则/no-english-titles.md）
  assert.doesNotMatch(cap, /en: "(Capsule|Seal)"/, "英文眉标还留着");
});

test("胶囊的三种状态是三种形状，不是三种颜色", () => {
  // 封＝印是整的；启＝印裂了一道；已拆＝印掰成两半。色弱和阳光下只剩形状可依
  //（施工规则/tabs-not-plain-pills.md 那两条不许牺牲的之一）。
  assert.match(cap, /const waxSeal = kind => kind === "done"/);
  assert.match(cap, /kind === "due" \? "启" : "封"/, "印上刻的字没了");
  assert.match(cap, /borderRadius: "15px 2px 2px 15px"|borderRadius: "13px 2px 2px 13px"/, "掰成两半那枚不见了");
  assert.match(cap, /transform: "rotate\(-16deg\)"/, "到期那道裂缝没了");
  // 信封正面那个封口：封着是实线，拆过只剩虚痕
  assert.match(cap, /strokeDasharray: kind === "done" \? "3 4" : "none"/);
  assert.match(cap, /minHeight: 44/, "可点区域没了");
});

test("「哪一天拆开」摆的是那一天本身，不是一排药丸", () => {
  const comp = cut(cap, "function CapsuleCompose(", "window.CapsuleApp = CapsuleApp;");
  // 上一版是五颗填色药丸，而且【看不出那天到底是哪天】
  assert.doesNotMatch(comp, /borderRadius: 999, background: on \?/, "又变回药丸了");
  assert.match(comp, /h\(CalPage, \{ w: 44, dim: !on/, "没用那张现成的挂历页（一处画、处处用）");
  assert.match(comp, /const dayOf = n => new Date\(Date\.now\(\) \+ n \* 86400000\)/, "算不出那一天是几号");
  // 选中：抬起 + 转一点 + 不压灰。形状/位置/明度三样都变了
  assert.match(comp, /transform: on \? "translateY\(-3px\) rotate\(-1\.6deg\)" : "none"/);
  assert.match(comp, /filter: on \? "none" : "grayscale\(\.55\)"/);
  // 「封存」那一下是把火漆压下去，不是一个填色长条
  assert.match(comp, /fontSize: 23, color: "rgba\(255,238,232,\.94\)" \} \}, "封"\)/);
});

// ── 说好的：一张字据 ────────────────────────────────────────
test("说好的每条是一张字据，日子挂在旁边", () => {
  const c = cut(scr, "function CouplePacts({", "function CoupleWishes({");
  // 「挑哪一天」是这一页真正的动作，原来被藏成一个小灰字链
  assert.match(c, /h\(CalPage, \{ w: 44, dim: !d \|\| passed,/, "日子不是挂在旁边那张挂历页上");
  assert.match(c, /head: dd \? undefined : "　", body: dd \? undefined : "？"/, "没挑日子时那一页不是空白的");
  assert.match(c, /const creaseAt = \(right, bottom\) =>/, "字据的骑缝没了");
  // 做到了＝盖一枚朱印，不是一个文字链
  assert.match(c, /fontFamily: F_DISPLAY, fontSize: 17 \} \}, "践"\)/, "那枚朱印没了");
  assert.match(c, /transform: "rotate\(-7deg\)"/, "印是正的——盖章不会盖得那么正");
  // 底纹铺外壳、顶栏透上来（施工规则/mobile-ui-layout.md §3.5）
  assert.match(c, /h\("div", \{ className: "h-full flex flex-col", style: \{ background: t\.bg,/);
  assert.match(c, /repeating-linear-gradient\(90deg,rgba\(140,115,70,\.05\)/, "契纸的竖格没了");
  assert.match(c, /h\(Head, \{ zh: "我们说好的", en: partner\.name, onBack: onBack, bg: "transparent" \}\)/);
  assert.match(c, /className: "flex-1 min-h-0 overflow-y-auto/);
});

// ── 收着的那几本：底纹各有各的 ──────────────────────────────
test("收着的每一本都有自己的底，而且都铺在外壳上、顶栏透上来", () => {
  const pages = [
    // v64.24：情书那圈斜条抽成了 letterSkin，【我们的情书】和【情书设置】共用一处
    //（原来只有前一页有底，设置页是纯米白）。所以这一行钉的从"内联的那串渐变"
    // 换成"用的是那处共用皮"，渐变本身另有一条单独钉着（见文件末尾）。
    ["情书", cut(scr, "  // 底纹铺在【外壳】上（v62.44", "// 情侣空间·合照墙"), "style: letterSkin(t)"],
    ["交换日记", cut(scr, "function CoupleExDiary({", "\nconst COUPLE_MOODS"), "repeating-linear-gradient(135deg"],
    ["问答小本", cut(scr, "  // 这一本躺在【点阵纸】上", "// 情侣空间·情书"), "radial-gradient(circle,rgba(120,110,80,.14)"],
    ["他记得的", cut(scr, "  // 底纹（v62.44）：这一页摊的是", "// 情侣空间·我们说好的"), "linear-gradient(90deg,rgba(0,0,0,0) calc(50% - 6px)"],
    ["说好的", cut(scr, "function CouplePacts({", "function CoupleWishes({"), "repeating-linear-gradient(90deg,rgba(140,115,70,.05)"],
    ["时光胶囊", cap, "const STRATA ="]
  ];
  pages.forEach(([zh, blk, mark]) => {
    assert.ok(blk.length > 300, zh + " 那一段没切到");
    assert.ok(blk.indexOf(mark) >= 0, zh + " 没有自己的底纹");
    // ⚠️底纹必须铺在【最外那个 h-full 外壳】上，不是铺在滚动区上——
    //   铺在滚动区上，顶栏那一条还是平色，顶上横着一道没盖住的带子。
    assert.match(blk, /className: "h-full flex flex-col", style: (\{ background: t\.bg|letterSkin\(t\))/, zh + " 的底纹没铺在外壳上");
    assert.ok(/bg: "transparent"/.test(blk) || zh === "情书", zh + " 的顶栏没透上来");
  });
  // 底不跟着滚：内容在动，底不该动
  assert.doesNotMatch(scr, /backgroundAttachment: "local"/);
});

test("那两块纯黑药丸换成了各自这一页的材质", () => {
  // 「翻开看过往」原来压在布面书下面，是一块纯黑药丸——它是这本本子的一部分，
  // 就该长成本子上那条书签带（燕尾缺口）。
  assert.match(scr, /clipPath: "polygon\(0 0, 100% 0, 100% 100%, 50% calc\(100% - 11px\), 0 100%\)"/, "书签带的燕尾没了");
  assert.doesNotMatch(scr, /background: t\.ink, color: t\.bg2, fontFamily: F_DISPLAY, fontSize: 15, padding: "12px 0", borderRadius: 14/,
    "那块纯黑药丸还在");
  // 「挑一件事，问问他记得的」换成一条纸带
  assert.match(scr, /busy \? "他在想…" : "挑一件事，问问他记得的"/);
  assert.match(scr, /border: "1px dashed rgba\(140,115,70,\.45\)"/, "那一颗还是纯黑药丸");
});

// ── v64.24：情书那张皮现在两页共用，单独钉一条 ──────────────
test("情书那圈斜条只有一处，两页都从它拿", () => {
  const scr2 = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(scr2, /const letterSkin = t => \(\{ background: t\.bg,\n\s*backgroundImage: "repeating-linear-gradient\(45deg,rgba\(176,141,82,\.055\)/,
    "那圈斜条不在 letterSkin 里了");
  assert.equal((scr2.match(/repeating-linear-gradient\(45deg,rgba\(176,141,82/g) || []).length, 1,
    "又抄成两份了——改一处另一处就落单");
  assert.equal((scr2.match(/style: letterSkin\(t\)/g) || []).length, 2,
    "我们的情书 + 情书设置，两页都得从这一处拿");
  // 设置页原来是纯米白，还自己手写了一条顶栏
  assert.match(scr2, /h\(Head, \{ zh: "情书设置"[^\n]*bg: "transparent"/, "情书设置的顶栏没换成 Head");
});
