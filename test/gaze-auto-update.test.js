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
  // ⚠️v59.79 起点名的间隔看【卡填到什么程度】：空卡每轮、没写满每 6 轮、写满 25 轮。
  // 这一条验的是【写满之后】那一档——平时不啰嗦。
  G.seed("c1", {
    me: { person: "她很怕麻烦别人", soft: "a", like: "b", recent: "c", unread: "d" },
    us: { what: "e", how: "f", marks: "g", elephant: "h", want: "i" }
  });
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

// ⚠️这一条原来写的是【空卡不催——那是建卡的事，不是更新的事】。那个假设是错的，
// 而且错得很硬：staleTurns 对空卡永远返回 0 → 点名永远不出现 → 模型只看得到那句
// 高门槛 → 一辈子不写 → 卡还是空的。**空 → 不催 → 还是空**，一个死锁。
// 结果就是：没手动按过「建卡」的人，这一层一辈子是空的
//（她 2026-09-01：「这个 Ta 眼里还是根本不填」）。撤掉就是删掉，换成反过来的那条。
test("空卡最该催：一块都没有时每一轮都点名", () => {
  assert.ok(G.spec("阿棠", "empty").indexOf("这一轮请复看这一块") > 0, "空卡第一轮就该点名");
  assert.match(G.spec("阿棠", "empty"), /这一块还是空的,你从来没写过/, "没说清这块是空的还是要保留原样");
  // 空块给的出口不是「看过了不用改」，那句话对一块从没写过的东西根本不成立
  assert.match(G.spec("阿棠", "empty"), /认识得还不够,真写不出来/, "空块的出口措辞不对");
  // 问法也要跟着变：空块问的是「够不够你写下这一块」，不是「让它需要改吗」
  assert.match(G.spec("阿棠", "empty"), /够不够你写下这一块/, "对着一块空的还在问「需要改吗」");
  // ⚠️staleTurns 不许再对空卡返回 0：那正是当初那个死锁的源头
  for (let i = 0; i < 3; i++) G.tick("empty2");
  assert.equal(G.staleTurns("empty2"), 3, "空卡的轮数又被抹成 0 了——死锁会从这儿长回来");
  // 诚实答一次「写不出来」→ 队列要真的转，下一轮点的是别的块
  const first = (G.spec("阿棠", "empty").match(/\((\w+\.\w+)\)/) || [])[1];
  assert.ok(first, "点名里没写块名");
  assert.ok(G.markChecked("empty", first));
  const second = (G.spec("阿棠", "empty").match(/\((\w+\.\w+)\)/) || [])[1];
  assert.notEqual(second, first, "答完还问同一块，队列没转");
});

test("写了一部分就每 6 轮点一次，别让剩下九块等两百多轮", () => {
  G.seed("part", { me: { person: "她比看上去能扛" }, us: {} });
  assert.ok(G.spec("阿棠", "part").indexOf("这一轮请复看这一块") < 0, "刚写完就又催");
  for (let i = 0; i < 6; i++) G.tick("part");
  assert.ok(G.spec("阿棠", "part").indexOf("这一轮请复看这一块") > 0, "没写满时还在按 25 轮等");
});

test("「看过了不用改」不许买走整整 25 轮的安静", () => {
  G.seed("full", {
    me: { person: "a", soft: "b", like: "c", recent: "d", unread: "e" },
    us: { what: "f", how: "g", marks: "h", elephant: "i", want: "j" }
  });
  for (let i = 0; i < G.STALE_TURNS; i++) G.tick("full");
  const k = (G.spec("阿棠", "full").match(/\((\w+\.\w+)\)/) || [])[1];
  G.markChecked("full", k);
  // 原来这一下把 turns 清成 0：一次白答买走 25 轮，十块轮一遍要 250 轮
  assert.ok(G.staleTurns("full") >= G.STALE_TURNS - 10, "答一次「不用改」就把计数清光了");
  for (let i = 0; i < 10; i++) G.tick("full");
  assert.ok(G.spec("阿棠", "full").indexOf("这一轮请复看这一块") > 0, "答完之后要再等 25 轮才轮到下一块");
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
