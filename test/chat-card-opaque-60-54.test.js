const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-09-02：「记账卡是透明的，这让我怀疑其他是不是也是，你给他弄一下」。
// 她的怀疑方向是对的：把所有聊天卡片摆到一张花壁纸上跑了一遍，中了九处——
// 两处是卡片背景（染色没有底），七处是【直接写在背景上的字】。

test("记账/备忘录卡：染色底下要有实心", () => {
  const c = comp.slice(comp.indexOf("function RecordedCard"), comp.indexOf("function ShopAskCard"));
  // 原来只有一层 7% 的染色，没有底
  assert.ok(!/background: "rgba\(" \+ tone \+ ",0\.07\)"/.test(c), "又变回只有一层染色了");
  assert.match(c, /background: t\.bg2,/);
  assert.match(c, /backgroundImage: "linear-gradient\(rgba\(" \+ tone \+ ",0\.07\)/,
    "染色要留着（那是账本/备忘录的颜色），只是染在实心底上");
});

test("亲属卡的签名条：斜纹要画在实心底上", () => {
  const c = comp.slice(comp.indexOf("function KinshipCardFace"), comp.indexOf("function KinshipIssueCard"));
  // v60.45 我把 t.bg2 当成渐变的一半，另一半 rgba(0,0,0,.042) 几乎全透
  assert.ok(!/background: "repeating-linear-gradient\(114deg, " \+ t\.bg2/.test(c), "又把底色当成条纹的一半了");
  assert.match(c, /background: t\.bg2,\n\s*backgroundImage: "repeating-linear-gradient\(114deg, transparent/);
});

test("亲属卡底下那句说明也得有块底", () => {
  const c = comp.slice(comp.indexOf("function KinshipIssueCard"), comp.indexOf("function KinshipSpendCard"));
  assert.match(c, /background: t\.bg2, borderRadius: 7/);
});

test("单聊里那几行居中的字：设了壁纸就垫一层磨砂", () => {
  const i = comp.indexOf("const plate = (pad) => dsp.chatBg ?");
  assert.ok(i > 0, "共用的那层没了");
  // 没设壁纸时必须【一个像素都不变】
  assert.match(comp.slice(i, i + 400), /: \{\};/, "没壁纸时要返回空对象");
  // ⚠️逐个渲染分支各切一小段来问：recalled/silence 排在 transfer 【后面】，
  //   拿 transfer 当切片终点会把它俩漏在外头（第一版就这么假红了一次）。
  const near = (anchor, span) => {
    const k = comp.indexOf(anchor, i);
    assert.ok(k > 0, "找不到这一支：" + anchor);
    return comp.slice(k, k + (span || 700));
  };
  [['if (m.kind === "pat")', "拍一拍"],
   ['if (m.kind === "narration" || m.role === "narration")', "旁白"],
   ['if (m.kind === "recalled")', "撤回"],
   ['if (m.kind === "silence")', "沉默"],
   ['if (m.kind === "system")', "系统行"]].forEach(([a, name]) =>
    assert.match(near(a), /\.\.\.plate\(/, "这一支还是裸字：" + name));
  assert.equal((comp.match(/\.\.\.plate\(/g) || []).length, 5,
    "单聊里该垫的正好五处（拍一拍/旁白/撤回/沉默/系统行）");
});

test("通话小结那一行：CallEndPill 拿不到 dsp，得把「有没有壁纸」传进去", () => {
  assert.match(comp, /function CallEndPill\(\{ m, chars, onBg \}\)/);
  const c = comp.slice(comp.indexOf("function CallEndPill"), comp.indexOf("function CallShotThumb"));
  assert.match(c, /onBg \? \{ background: "rgba\(255,255,255,0\.62\)"/);
  // 单聊和群聊两处调用都要传，不然又是「一层写在两处，第二处没跟上」
  assert.match(comp, /h\(CallEndPill, \{ key: i, m, chars: \[character\], onBg: !!dsp\.chatBg \}\)/);
  assert.match(comp, /h\(CallEndPill, \{ key: i, m, chars: characters, onBg: !!gChatBg \}\)/);
});

test("群聊也有背景图，旁白同样要垫", () => {
  const g = comp.slice(comp.indexOf("const gChatBg = settings && settings.chatBg"));
  const narr = g.slice(g.indexOf('m.role === "narration" || m.kind === "narration"'));
  assert.match(narr.slice(0, 700), /gChatBg \? \{ background: "rgba\(255,255,255,0\.62\)"/);
  // 群里的系统行本来就有底，别重复垫
  assert.match(g, /background: t\.bg2,\n\s*padding: "3px 12px",\n\s*borderRadius: 999/);
});
