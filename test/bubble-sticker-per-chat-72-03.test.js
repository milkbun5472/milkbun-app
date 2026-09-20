// 「只给 TA 换气泡」里贴的那张贴纸，在聊天里一次都没出现过（2026-09-20 她报「调了气泡但是显示不出来」）
//
// 两条病：
//   ① bubbleSticker 只认全局 BUBBLE_SKIN——这个聊天窗自己那层（CHAT_LOOK.bubble）
//      管得了底色/圆角（那几样走 CSS），管不了贴纸（那是画在 React 里的 <img>）。
//   ② 贴纸地址没过 resolveImg：秋秋改气泡那一路（engine.js BUBBLE_AI_STICKER_KEYS）
//      明说了只许填图片保险箱的 iv_ 门牌，不换成真实地址就是一张裂图。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 真跑那两段：锚只钉函数名/变量声明（施工规则/anchor-on-code.md）
const load = () => {
  const a = comp.indexOf("let CHAT_LOOK = {};");
  const b = comp.indexOf("const bubbleDecls = ", a);
  const c = comp.indexOf("function bubbleSticker(");
  const d = comp.indexOf("function avatarSrcOf(", c);
  assert.ok(a > 0 && b > a, "抠不出 bubbleSkinNow 那一段");
  assert.ok(c > 0 && d > c, "抠不出 bubbleSticker 那一段");
  const src = comp.slice(a, b) + "\n" + comp.slice(c, d)
    + "\nreturn { bubbleSticker, bubbleSkinNow, setLook: L => { CHAT_LOOK = L; } };";
  // h 只记下它被叫去画什么；resolveImg 照 engine.js 那一份的形状（iv_ 才换）
  const drawn = [];
  const h = (tag, props) => { drawn.push({ tag, props }); return { tag, props }; };
  const api = new Function("h", "BUBBLE_SKIN", "resolveImg", src)(
    h,
    { mySticker: "", charSticker: "", stickerSize: 52 },
    v => (String(v).indexOf("iv_") === 0 ? "blob:real/" + v : v));
  return Object.assign(api, { drawn });
};

test("这个聊天窗自己那层的贴纸也要画出来（原来只认全局）", () => {
  const api = load();
  api.setLook({ scope: 'html[data-lisa-char="c1"]', bubble: { mySticker: "assets/a.png", charSticker: "assets/b.png", stickerSize: 60 } });
  assert.equal(api.bubbleSticker(true).props.src, "assets/a.png");
  assert.equal(api.bubbleSticker(false).props.src, "assets/b.png");
  assert.equal(api.bubbleSticker(true).props.style.width, 60, "大小也归这一层管");
});

test("不在这个人的窗口里就只认全局那一份", () => {
  const api = load();
  // scope 空＝群聊/通话/设置页：别把上一个人的贴纸带过去
  api.setLook({ scope: "", bubble: { mySticker: "assets/a.png" } });
  assert.equal(api.bubbleSticker(true), null);
});

test("iv_ 门牌要换成真实地址，不然是一张裂图", () => {
  const api = load();
  api.setLook({ scope: 'html[data-lisa-char="c1"]', bubble: { charSticker: "iv_abc" } });
  assert.equal(api.bubbleSticker(false).props.src, "blob:real/iv_abc");
});

test("试衣镜和聊天里那只气泡共用同一支 stickerSrc", () => {
  // 一处换地址、另一处不换的话，她会以为是自己填错了（施工规则/one-public-mechanism.md）
  assert.match(comp, /src: stickerSrc\(mine \? s\.mySticker : s\.charSticker\)/);
  assert.equal((comp.match(/function stickerSrc\(/g) || []).length, 1, "stickerSrc 只许有一份");
});
