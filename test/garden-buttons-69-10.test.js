// 她 2026-09-16：「目前那些按键的 ui 好拥挤，你能不能调一下让它整体好看点」——指的是庭院这一页。
// 病根是这几个按钮从来没装修过：没字体、没圆角、字挤在一条边上。
// ⚠️这份钉的是「形状只有一份」：三处药丸取同一个 pill()，别又回到各写各的行内样式。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const garden = fs.readFileSync(path.join(__dirname, '../js/fairy-garden.js'), 'utf8');
const view = garden.slice(garden.indexOf('const G = { ink:'));

test('一份色板一份形状，不再各写各的', () => {
  assert.match(view, /const G = \{ ink: "#344936", soft: "#6e8060", line: "#d1dac2", paper: "#fffef5", deep: "#55704f" \}/);
  assert.match(view, /const pill = \(small\) =>/);
  // 顶栏「说话」、面板「换同行者」、「重试」三处都取同一个形状
  assert.ok((view.match(/\.\.\.pill\(\)|pill\(true\)|\.\.\.pill\(true\)/g) || []).length >= 3, '还有按钮没接上公共那一份');
  // 原来那几处光秃秃的行内样式不许再有
  assert.doesNotMatch(view, /style: \{ fontSize: 12, padding: 8 \}/);
  assert.doesNotMatch(view, /style: \{ fontSize: 11, padding: 5 \}/);
});

test('按键有字体、有圆角、有该留的白', () => {
  // 发送键：实心药丸，不是一段裸文字
  assert.match(view, /borderRadius: 999, padding: "11px 17px", background: G\.deep/);
  // 输入框也跟着圆起来，两个凑一起才不挤
  assert.match(view, /borderRadius: 999, padding: "11px 15px", fontFamily: F_BODY/);
  // 这一页每个可点的地方都得有字体（全 app 一套字）
  const naked = view.match(/fontSize: \d[\d.]*[,}]/g) || [];
  assert.ok(naked.length > 0);
  assert.doesNotMatch(view, /h\("button", \{ onClick: changePartner, disabled: busy \}, "换同行者"\)/, '换同行者还是裸的');
});

test('底部安全区照旧只吃那一份，不许再垫一层', () => {
  // 移动端铁律：输入栏的底 padding 用公共 COMPOSER_PAD_BOTTOM
  assert.match(view, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  assert.doesNotMatch(view, /safe-area-inset-bottom\) \+/);
});

test('面板能一眼看出是能收起来的，消息不再挤成一坨', () => {
  assert.match(view, /width: 34, height: 4, borderRadius: 999/, '少了那条抓手');
  assert.match(view, /maxHeight: "34vh"/, '消息区还是钉死的 180px');
  // 说话人单独一行，不再是 <small>名字：</small> 贴着正文
  assert.doesNotMatch(view, /h\("small", null, m\.role === "user"/);
});
