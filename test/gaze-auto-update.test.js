const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const gaze = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-24：「Ta 眼里那几条，第一次我直接让他们写入他们会写，
// 不然都不会自动弄」。
// 病根在协议字段说明里那句「绝大多数轮次省略」——它把「很少」写成了「别写」；
// 加上「什么时候算真正改变了长期认知」没有可判定的标准，模型只能一直判「没有」。
// 但这张卡本来就该是长期的，改成每轮必填会让它天天翻脸。所以是折中：
// 平时照旧极少写，给出可判定的触发点，再加一只计数器——久没动过就点一句。

const G = (() => {
  const store = {};
  const sb = {
    React: { useState: () => [] }, ReactDOM: { createPortal: () => null }, h: () => null,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    F_BODY: "", F_DISPLAY: "", window: {}
  };
  new Function(...Object.keys(sb), gaze)(...Object.values(sb));
  return sb.window.Gaze;
})();

test("「绝大多数轮次省略」不许再留着——那不是「很少」，是「别写」", () => {
  const live = gaze.split("\n").filter(l => !/^\s*\/\//.test(l) && l.indexOf("绝大多数轮次省略") >= 0);
  assert.deepEqual(live, []);
  assert.match(gaze, /它把「很少」写成了「别写」/, "病因写在代码里");
});

test("给可判定的触发点，别让它自己去悟「什么算真正改变了长期认知」", () => {
  const s = G.spec("阿棠", "c1");
  assert.match(s, /满足其一就该写,不必等到惊天动地/);
  assert.match(s, /以前不知道/);
  assert.match(s, /推翻或修正/);
  assert.match(s, /具体节点/);
  // 但「一轮至多一块、小幅演进」这些护栏不许松
  assert.match(s, /一轮至多一块/);
  assert.match(s, /绝不因单日情绪整块翻转/);
});

// v56.94 起不再笼统催「有没有哪块该改」——那句自己留着「照旧省略」的出口，
// 模型每次都走它（她 8.16 到 8.27 一块没改过）。改成【点名问最老的那一块】，
// 并给一个诚实的第三条路：看过了确实不用改，也要说出来。
test("久没动过才点名，平时不啰嗦", () => {
  G.seed("c1", { me: { person: "她很怕麻烦别人" }, us: {} });
  assert.equal(G.staleTurns("c1"), 0);
  for (let i = 0; i < G.STALE_TURNS - 1; i++) G.tick("c1");
  assert.ok(G.spec("阿棠", "c1").indexOf("这一轮请复看这一块") < 0, "还没到阈值就别念");
  G.tick("c1");
  const s = G.spec("阿棠", "c1");
  assert.match(s, /【这一轮请复看这一块】/);
  // 三条路都要写清：改、说不用改、什么都不填＝跳过
  assert.match(s, /需要改 → impression 填【这一块】/);
  assert.match(s, /impressionChecked/);
  assert.match(s, /两个都不填=你把这一层整个跳过了/);
  // 不许再留那个万能出口
  assert.ok(!/照旧省略/.test(s), "「照旧省略」这条退路正是它一直走的那条");
});

test("写过一次就重新数", () => {
  assert.equal(G.applyParsed("c1", { side: "me", block: "recent", text: "她这阵子在赶一个东西" }), true);
  assert.equal(G.staleTurns("c1"), 0);
});

test("空卡不催——那是建卡的事，不是更新的事", () => {
  for (let i = 0; i < 40; i++) G.tick("empty");
  assert.equal(G.staleTurns("empty"), 0, "还没建卡就没有「久没更新」可言");
  assert.ok(G.spec("阿棠", "empty").indexOf("⚠️") < 0);
});

test("不传 charId 也不炸（群聊那份还在共用）", () => {
  assert.equal(typeof G.spec("阿棠"), "string");
  assert.ok(G.spec("阿棠").indexOf("⚠️") < 0);
});

test("接线：写了就清零，没写就计一轮", () => {
  assert.match(app, /window\.Gaze\.spec\("对方", charId\)/);
  assert.match(app, /_impWrote = window\.Gaze\.applyParsed\(char\.id, parsed\.impression\)/);
  assert.match(app, /if \(!_impWrote\) \{ try \{ window\.Gaze\.tick\(char\.id\); \}/);
  assert.match(app, /不数的话两者长得一模一样/, "分不清「真没变化」和「压根不写」，就只能干等");
  // 言秋那条专线不参与；侧房还要过写回闸（v57.18：看不见印象卡的房不许整块重写它）
  assert.match(app, /if \(_roomCanWrite\("gaze"\) && window\.Gaze && !_s\.engineerEyes\)/);
  // 线下那一路也要有同一套接线（v57.02），而且不受房间开关影响——线下不是房间
  assert.match(app, /if \(window\.Gaze && !settingsFor\(charId\)\.engineerEyes\) \{/);
  assert.match(app, /window\.Gaze\.tick\(charId\)/);
});
