// v62.66 审美审计（2026-09-04）数出五处药丸 tab。这一版先改两处，
// 而且都【照库里现成的合格范例抄形状】，不另发明第六套（tabs-not-plain-pills）：
//   · 备忘录 → 账本 TallyView 那种【索引页签】
//   · Ta 眼里 → 解梦馆那种【布书签】
//
// 判据：这一组 tab 原样搬到另一个 app 里还成立吗？成立就是写坏了。
// 填色药丸搬到哪儿都成立；索引页签只在本子上成立，布书签只在手记上成立。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const memo = fs.readFileSync("js/memo.js", "utf8");
const gaze = fs.readFileSync("js/gaze.js", "utf8");
const nocom = x => x.split("\n").map(l => l.split("//")[0]).join("\n");
const M = nocom(memo), G = nocom(gaze);

test("备忘录：两栏是本子边上的索引页签", () => {
  assert.match(M, /borderRadius: "9px 9px 0 0"/);
  // 选中那张满高、纸色，直接长进底下那一页；没选中的往下缩一截
  assert.match(M, /marginTop: tab === k \? 0 : 6/);
  assert.match(M, /background: tab === k \? t\.bg2 : "rgba\(127,127,127,\.10\)"/);
  // 页边那道线：选中那张用纸色盖住自己那一段，线断在哪儿就说明翻开的是哪一页
  assert.match(M, /background: "linear-gradient\(to top," \+ t\.line \+ " 0 2px,transparent 2px\)"/);
  // 填色药丸不许再回来
  assert.doesNotMatch(M, /background: tab === k \? ACCENT : "transparent"/);
});

test("Ta 眼里：两栏是挂在页头的布书签", () => {
  assert.match(G, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% " \+ \(on \? "72%" : "78%"\) \+ ",0 100%\)"/);
  assert.match(G, /WebkitClipPath: "polygon/, "Safari 那边没配前缀，尖口会整个失效");
  assert.doesNotMatch(G, /borderRadius: 999, border: "1px solid " \+ \(side === k \? GOLD/);
});

test("选中态不许只靠色差（无障碍那一条）", () => {
  // 备忘录：高度、位置、底色三样一起变
  assert.match(M, /padding: tab === k \? "11px 18px 10px" : "9px 16px 8px"/);
  // Ta 眼里：长度、颜色、尖口三样一起变
  assert.match(G, /padding: on \? "9px 0 17px" : "7px 0 13px"/);
  // 两处的可点区都不低于 40px
  assert.match(G, /minHeight: 40/);
});

test("备忘录整个 app 里没有 emoji 当图标", () => {
  // ⚠️展开必须用 [...str]：.split("") 会把四字节字符拆成两半代理，
  //   两半都不在判定区间里，这条断言就成了永远抓不到 emoji 的空转。
  assert.ok(![...M].some(ch => ch.codePointAt(0) > 0x1F000), "备忘录里还有 emoji");
  // ⏰📝 换成纯中文（tab 的形状已经把「这是哪一栏」说清楚了）；
  // 📌 和 🗓️ 换成画出来的图钉和小日历
  assert.match(M, /tabBtn\("reminders", "提醒"\), tabBtn\("notes", "备忘"\)/);
  assert.match(M, /d: "M4 1h3l-\.5 3\.4/);
});

test("备忘录的底是本子的纸，不是一块平色", () => {
  assert.match(M, /pageSkin\("paper", t, \{ strength: \.65 \}\)/);
  assert.match(M, /h\(Head, \{ zh: "备忘录", onBack: backOut, bg: "transparent"/);
});
