const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const _i = comp.indexOf("function ReplyKey(");
const key = comp.slice(_i, comp.indexOf("\nfunction ", _i + 10));

// 她 2026-09-02：「聊天回复键的样式也改改吧，之前也是参考的嘤」。
// 原来是黑圆圈 + ✦——那颗星每个 AI app 都有，原样搬到别处照样成立。
// 这个键真正在做的事是【把话头递给谁】，而这个 app 里那个「谁」是有脸的。

test("那颗通用的星整个删掉，四处都换成脸", () => {
  assert.equal((comp.match(/ISpark/g) || []).length, 0, "✦ 还在");
  assert.equal((comp.match(/h\(ReplyKey, \{/g) || []).length, 4,
    "单聊线上 / 单人线下 / 群线下 / 群线上，四处都要换");
});

test("键就是他的脸：平时压暗，戳一下叫他", () => {
  assert.match(key, /h\(Avatar, \{ character: few\[0\] \|\| \{\}, size: 40, radius: 999 \}\)/);
  assert.match(key, /filter: sending \? "none" : "grayscale\(0\.6\) brightness\(0\.94\)"/,
    "没在说话时该是压暗去色的");
});

test("生成中：这个键自己变成「他正在说」", () => {
  // 原来是黑圆圈里三个点；现在是他的脸亮起来、盖一层暗、点浮在他脸上
  assert.match(key, /sending \? h\("div", \{ style: \{ position: "absolute", inset: 0, background: "rgba\(20,18,15,0\.55\)"/);
  assert.match(key, /\[0, 1, 2\]\.map/);
  assert.match(key, /animationDelay: i \* 0\.15 \+ "s"/);
});

test("群里是几张脸叠着，一眼看得出这一下会叫醒谁", () => {
  assert.match(key, /\.slice\(0, 3\)/, "最多三张，再多挤不下");
  assert.match(key, /few\.length === 2 \? 11 : 9/, "两人和三人错开的距离不一样");
  assert.match(key, /zIndex: few\.length - i/, "前面的压在后面的上头");
});

test("群线上那两档用【圈的虚实】分，不是只换个颜色", () => {
  // hold=true 只回一轮（有个头）；false 他们自己会接着聊（连着走）
  assert.match(key, /"1\.5px " \+ \(hold === true \? "dashed" : "solid"\)/);
  assert.match(comp, /hold: !!gHold/, "群线上要把这一档传进来");
  // 单聊没有这一档：hold 不传，圈按「普通」画
  assert.match(key, /hold != null \? t\.ink : t\.fog/);
});

test("四处各自传对了人", () => {
  assert.match(comp, /h\(ReplyKey, \{\n?\s*chars: character, sending: sending, disabled: sending \|\| bk\.theyBlocked/, "单聊线上：他");
  assert.match(comp, /h\(ReplyKey, \{ chars: char, .*"让 Ta 演绎"/, "单人线下：他");
  assert.match(comp, /h\(ReplyKey, \{ chars: members, .*"让他们演绎"/, "群线下：在场的人");
  assert.match(comp, /chars: characters, sending: sending, disabled: sending,/, "群线上：群成员");
});

test("被拉黑仍然戳不动，且说得清为什么", () => {
  assert.match(comp, /disabled: sending \|\| bk\.theyBlocked/);
  assert.match(comp, /bk\.theyBlocked \? "TA 拉黑了你，无法回复" : "让 TA 回复"/);
  assert.match(key, /disabled: disabled/);
});

test("点得着：还是 40px（mobile-ui-layout 那条手感线）", () => {
  assert.match(key, /width: 40, height: 40, borderRadius: 999/);
});
