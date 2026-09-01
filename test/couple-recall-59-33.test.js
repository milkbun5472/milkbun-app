const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const bare = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 她 2026-09-01：「这个他记得的一直是空的，点进去刷新也没有提示有没有在刷，
// 要等他自己出来」。三处各自坏了一点，凑成了「一直是空的」。

// ① 书脊上那一行读的字段，得是这条记录真有的字段。
// 写进去的是 {id,characterId,memId,mine,his,note,ts,unread}——原来读的
// title/topic/text 一个都不存在，所以永远是空串；红点又亮着，看着就像坏了。
test("书脊上摆的是这条记录真有的字段，不是猜的字段名", () => {
  const i = screens.indexOf('spine("recall"');
  assert.ok(i > 0, "找不到「他记得的」那一格");
  const row = bare(screens.slice(i, screens.indexOf('spine("pacts"', i)));
  assert.match(row, /bRecallLast\.his/, "没摆出他记得的那一版");
  ["title", "topic", "text"].forEach(k => {
    assert.ok(row.indexOf("bRecallLast." + k) < 0, "还在读这条记录没有的字段 " + k);
  });
  // 写入端是唯一的权威：这几个字段名必须真的被写进去过
  const w = app.slice(app.indexOf('id: "rc_" + Date.now()'), app.indexOf('id: "rc_" + Date.now()') + 300);
  ["mine", "his"].forEach(k => assert.match(w, new RegExp(k + ":"), "写入端根本不写 " + k));
});

// ② 每一格都得有【自己那一个】busy。这一格原来去读 gen.coupleRecall，
// 可传进来的 gen 是悄悄话那个布尔，不是整个 gen 对象——永远 undefined。
test("他记得的有自己那一个转圈标志，不是去别人的对象里捞", () => {
  const i = screens.indexOf("h(CoupleRecall, {");
  assert.ok(i > 0, "找不到 CoupleRecall 的挂载处");
  const call = bare(screens.slice(i, screens.indexOf("});", i) + 3));
  assert.match(call, /busy: recallGen/, "没有自己那一个 busy");
  assert.ok(call.indexOf("gen.coupleRecall") < 0, "还在别人的对象里捞");
  assert.match(screens, /onDelRecall, recallGen,/, "Us 没有接这个道具");
  assert.match(app, /recallGen: gen\.coupleRecall/, "app 侧没把真的那一位传下去");
  // ⚠️那个会骗人的 gen 道具必须删掉：留着它，下一个人还会以为它是整个 gen 对象
  const us = app.slice(app.indexOf("React.createElement(Us, {"), app.indexOf("React.createElement(Us, {") + 4000);
  assert.ok(us.indexOf("gen: gen.whisper") < 0, "那个会骗人的 gen 道具还留着");
  assert.ok(screens.indexOf("onSetCoupleImg, gen, coupleQA") < 0, "Us 还收着那个没人读的 gen");
});

// ③ 挑事的判据要跟全 App 一套。memShareChar 认得「charIds 为空＝旧全局记忆」，
// 直接 .includes 会把她所有旧记忆挡在门外，库里有东西也挑不出事。
test("挑哪件事用的是全 App 同一条判据", () => {
  const i = app.indexOf("const genCoupleRecall");
  assert.ok(i > 0, "找不到 genCoupleRecall");
  const fn = bare(app.slice(i, app.indexOf("const readCoupleRecall", i)));
  assert.match(fn, /memShareChar\(\[char\.id\], m\.charIds\)/, "没用全 App 那条判据");
  assert.ok(!/\(m\.charIds \|\| \[\]\)\.includes\(char\.id\)/.test(fn), "还在用会漏掉旧记忆的那一版");
  // 挑过的不再挑：这一页的意思是一件一件问，不是反复问同一件
  assert.match(fn, /!told\.has\(m\.id\)/, "会重复问同一件事");
});
