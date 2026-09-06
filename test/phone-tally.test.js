// 账本：他心里给这段关系记的那本账。
// 跟钱包不是一回事——钱包记钱，这儿记没结清的东西（欠着的、兜过的底、
// 放过的狠话、舍不得的、拿不准的）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, FIXTURES } = require("./helpers/phone-render.js");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P0 = new Function(SRC + "; return { PHONE_APPS, PHONE_ANGLE, PHONE_GROW, PHONE_DIGEST_PICK, PHONE_LIVE_KEYS, PHONE_MONEY_KEYS, phoneProbeSpec, phoneRoundDigest, TALLY_TABS, TALLY_DIR };")();
const char = { name: "某人" };
const props = { d: FIXTURES.tally, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };

test("账本挂在桌面上，自己画整屏，走生成管线", () => {
  assert.ok(P0.PHONE_APPS.some(a => a.key === "tally" && a.zh === "账本"));
  assert.ok(P0.PHONE_LIVE_KEYS.indexOf("tally") < 0, "账本是要推演的，不是读真数据");
  assert.ok(P0.PHONE_ANGLE.tally, "没有取材层");
  assert.ok(P0.PHONE_DIGEST_PICK.tally, "没进跨 app 避重抽取表");
  assert.notEqual(P0.phoneProbeSpec("tally", char, [], "", []).schemaHint, "{}", "没有自己的推演任务");
});

test("五栏都会累积——欠着的没还、放过的话没收回，本来就该一直挂着", () => {
  const conf = P0.PHONE_GROW.tally;
  assert.ok(conf, "账本没登记累积");
  ["debts", "policies", "statements", "treasures", "appraisals"].forEach(k =>
    assert.ok(conf[k] > 0, k + " 没登记累积，刷一次就换一批欠账，这个 app 就废了"));
});

test("五栏各自的字段都在推演任务和 schema 里", () => {
  const spec = P0.phoneProbeSpec("tally", char, [], "", []);
  ["debts", "policies", "statements", "treasures", "appraisals"].forEach(k => {
    assert.ok(spec.instruction.indexOf(k) > 0, k + " 没写进推演任务");
    assert.ok(spec.schemaHint.indexOf(k) > 0, k + " 没写进 schemaHint");
  });
  // 界面靠这五个 tab 读数据，key 必须对得上
  assert.deepEqual(P0.TALLY_TABS.map(x => x.k), ["debts", "policies", "statements", "treasures", "appraisals"]);
});

test("「对方欠」那一栏不许写成讨债", () => {
  // 它让角色对用户记账，一不小心就写成指责。判据：主语是他的在意，不是对方的亏欠。
  const ins = P0.phoneProbeSpec("tally", char, [], "", []).instruction;
  assert.match(ins, /不是他在讨债/);
  assert.match(ins, /主语是他的在意/);
  assert.match(ins, /三种都要有/, "没要求三个方向都有，会一边倒");
  assert.deepEqual(Object.keys(P0.TALLY_DIR).sort(), ["mine", "open", "theirs"]);
});

test("账本不记钱——钱包简报不发给它", () => {
  assert.ok(P0.PHONE_MONEY_KEYS.indexOf("tally") < 0, "账本收到了钱包简报，两本账会混");
  assert.match(P0.PHONE_ANGLE.tally, /不记钱/);
  // 界面上那句「这本账不记钱…」v59.65 撤了：她 2026-09-01「这段话删了吧有点挡住了」。
  // 现在每一栏自己的抬头（「N 句盖过章的话」这种）已经说清楚这一栏记的是什么，
  // 不会再被当成第二个钱包。取材层那一句仍然钉着，模型那边不许写钱。
});

test("提示词里没有可照抄的内容示范，只有判据和维度", () => {
  // 施工规则/prompt-no-content-samples.md：写得越好的例子被抄得越狠
  const spec = P0.phoneProbeSpec("tally", char, [], "", []);
  ["秒撤回", "情侣空间", "炙羊肉", "酥酪", "御膳房", "台阶", "选秀", "王府", "无可估量", "连城之璧"]
    .forEach(b => {
      assert.ok(spec.instruction.indexOf(b) < 0, "推演任务里留着可照抄的内容示范：" + b);
      assert.ok(spec.schemaHint.indexOf(b) < 0, "schemaHint 里留着可照抄的内容示范：" + b);
    });
  // 判据在
  // v59.12：账本不再是「他和用户」那一本，判据也从「一对角色」改成「一个角色」
  assert.match(spec.instruction, /换成任何一个角色都照样成立的条目就是写坏了/);
});

test("五栏都渲染得出来，脏数据不炸", () => {
  const idx = P0.TALLY_TABS.map(x => x.k);
  idx.forEach((k, i) => {
    // useState 第 0 个是 tab
    assert.doesNotThrow(() => loadPhone({ 0: k }).TallyView(props), k + " 那一栏炸了");
  });
  [null, undefined, {}, [], "字符串", { debts: "不是数组" }, { debts: [null, 3, {}] },
   { policies: [{ name: null }] }, { statements: [{}] }, { treasures: [{ title: 1 }] }, { appraisals: [{ q: {} }] }]
    .forEach((d, i) => idx.forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).TallyView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 栏炸了")));
});

test("走 renderPhoneModule 挂到 TallyView 上，不是渲染成一个列表", () => {
  const node = loadPhone().renderPhoneModule("tally", FIXTURES.tally, {
    t: {}, char, setSheet: () => {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {}
  });
  assert.ok(node, "renderPhoneModule 没接账本");
  // 渲染桩里 h() 把组件函数记成它的名字字符串（跟 phone-render-smoke 一个约定）
  assert.equal(node.type, "TallyView");
});

test("每条都能单独摆到他面前，走 hidden 档", () => {
  // 账本记的是他没说出口的账，被翻到就是被撞破——不是「她随口提起」那一档
  assert.match(SRC, /onPeek\(\{ tier: "hidden", label: "账本 · "/);
  // 而且必须是【按了按钮才发】，不许点开就发（她 2026-08-29 被吓过一次）
  assert.ok(SRC.indexOf('onClick: () => onPeek && onPeek(') < 0);
});

test("跨 app 避重抽得出账本的内容", () => {
  const lines = loadPhone().phoneRoundDigest({ tally: FIXTURES.tally }, "notes").join("\n");
  assert.match(lines, /账本：/);
});
