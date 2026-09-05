// v62.70 审美审计（2026-09-04）：秋秋这一页是「整页 t.bg 平色，**自写顶栏、
// 返回键是字符「←」（padding 只有 4px）、不走 Head**」。
//
// 分寸：「一个助手在跟你说话」本来就长得像任何一个聊天框，
// 所以别去改气泡（改了只会变难用），改她【坐在哪儿】——
// 秋秋是这个 app 的维修工，给她一张纸面的值班台和一块台签。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/assistant.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");
const APP = NOC.slice(NOC.indexOf("const QUICK = ["), NOC.indexOf("window.AssistantApp"));

test("顶栏走公共 Head，那个「←」字符没了", () => {
  assert.match(APP, /h\(Head, \{\s*\n?\s*zh: cfg\.name, sub: "这个 app 哪儿不对劲，问她", onBack: props\.onBack, bg: "transparent"/);
  // mobile-ui-layout §1：别再自己写一条；那条自写栏的可点区只有几个像素
  assert.doesNotMatch(APP, /color: t\.ink, fontSize: 19, padding: "2px 4px" \} \}, "←"\)/);
  assert.doesNotMatch(APP, /borderBottom: "1px solid " \+ t\.line, flexShrink: 0 \} \},\n\s*h\("button", \{ onClick: props\.onBack/);
});

test("底是纸，不是一块平色", () => {
  assert.match(APP, /pageSkin\("paper", t, \{ strength: \.5 \}\)/);
  assert.match(APP, /Object\.assign\(\{ position: "relative", height: "100%", display: "flex", flexDirection: "column" \}, deskPaper\)/);
});

test("台签：这张桌子今天谁在", () => {
  // 她的脸原来挤在顶栏里当 28px 小图标；摆到台签上才是「谁在值班」
  assert.match(APP, /h\(QiuFace, \{ cfg: cfg, size: 30, radius: 9 \}\)/);
  assert.match(APP, /C\.busy \? "在想…" : "在，说吧"/);
  // 值班灯：一个点，不是一句话；忙和闲要看得出来
  assert.match(APP, /background: C\.busy \? t\.tint : "#7fa87f"/);
  assert.match(APP, /borderRadius: "2px 2px 7px 7px"/);
});

test("快捷问句是递到台上的便签条，不是虚线药丸", () => {
  assert.doesNotMatch(APP, /borderRadius: 999, border: "1px dashed " \+ t\.line/);
  assert.match(APP, /borderRadius: 2, transform: "rotate\(" \+ \(\(qi % 3\) - 1\) \* 0\.6 \+ "deg\)"/);
});
