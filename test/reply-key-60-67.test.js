const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const _i = comp.indexOf("const REPLY_BUBBLE_D");
const key = comp.slice(_i, comp.indexOf("\n// 代付请求卡", _i));

// 「让 TA 回复」那个键。前两版都被她退回过：
// v60.63 之前是黑圆圈 + ✦（「之前也是参考的嘤」——那颗星每个 AI app 都有）；
// v60.65 换成了他的脸（「不要这个宝宝看着怪吓人的，就设计一个新的图案就好了」）。
// 这一版是自己画的：答话要落进来的那个气泡，现在还空着。

test("既不借那颗星，也不拿脸当图案", () => {
  assert.equal((comp.match(/ISpark/g) || []).length, 0, "✦ 还在");
  assert.equal((key.match(/Avatar/g) || []).length, 0, "键上不许再有脸");
  assert.equal((comp.match(/h\(ReplyKey, \{/g) || []).length, 4,
    "单聊线上 / 单人线下 / 群线下 / 群线上，四处都是同一个键");
});

test("图案是这个 app 自己的气泡，尾巴冲左——和旁边那只往右飞的纸飞机反过来", () => {
  assert.match(key, /const REPLY_BUBBLE_D = "M8\.2 4\.2h7\.6/, "气泡自己画，不引别处的图形");
  // 尾巴那一笔：从底边左端甩到左下角外面（L5 21.2），再收回描边
  assert.match(key, /L5 21\.2/, "尾巴要在左下角");
});

test("平时空着；生成中整个上墨，三个点跳在【气泡里头】", () => {
  assert.match(key, /fill: sending \? t\.ink : t\.bg/, "空/满是这个键的主要区别");
  // 点和气泡在同一个 g 里：群里那枚气泡被挪走缩小时，点得跟着走。
  // ⚠️这一条要数括号才作数——只在 key 里 indexOf 的话，点掉到 g 外面也照样"在后面"。
  const gi = key.indexOf('h("g", {');
  let d = 0, gEnd = -1;
  for (let i = gi; i < key.length; i++) {
    if (key[i] === "(") d++;
    else if (key[i] === ")") { d--; if (d === 0) { gEnd = i; break; } }
  }
  assert.ok(gEnd > gi, "找不到那个 g 的结尾");
  const g = key.slice(gi, gEnd);
  assert.ok(g.indexOf("REPLY_BUBBLE_D") >= 0, "气泡不在这个 g 里");
  assert.ok(g.indexOf('h("circle"') > g.indexOf("REPLY_BUBBLE_D"),
    "三个点必须和气泡装在同一层里，且画在气泡上面");
  assert.match(key, /\[0, 1, 2\]\.map/);
  assert.match(key, /animationDelay: i \* 0\.15 \+ "s"/);
});

test("群里是两枚气泡叠着，一眼看出不止一个人要说话", () => {
  assert.match(key, /const many = .*\.filter\(Boolean\)\.length > 1/);
  assert.match(key, /many \? h\("path", \{ d: REPLY_BUBBLE_D/, "后面那一枚只在群里画");
  assert.match(key, /transform: many \? "translate/, "前面那一枚要让开，否则把后面那枚整个盖住");
});

test("群线上那两档用【描边的虚实】分，不是只换个颜色", () => {
  // hold=true 只回一轮（有个头）；false 他们自己会接着聊（连着走）
  assert.match(key, /strokeDasharray: hold === true \?/);
  assert.match(comp, /hold: !!gHold/, "群线上要把这一档传进来");
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
