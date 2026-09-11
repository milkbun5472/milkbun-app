// 她 2026-09-11 报的：「房间本房限定设定每轮都会喂给他会不会容易把他困在一个 state
// 出不来，比如我试了『出轨被他捉奸在床』就感觉一直人机八股得要死」。
//
// 是真的，而且病根是【一栏当了两样东西用】：
//   `scenario` 本来是给「另一段年龄、处境或关系」用的——**持续成立的背景**，每轮发是对的。
//   可「被捉奸在床」不是背景，是**一个瞬间**。瞬间被当成常驻设定每轮重发、
//   压在最后、标着最高优先、还跟一句「本轮回复前先按这段设定校准自己」——
//   等于每一轮在他开口之前把他按回门被推开的那一刻。**戏永远走不出第一拍。**
//
// 治法不是加禁令，是把那一栏拆成【底子】和【开场】，判据一句：
//   **这句话三天之后还成立吗？**
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bag = new Map();
global.localStorage = { getItem: k => bag.has(k) ? bag.get(k) : null, setItem: (k, v) => bag.set(k, String(v)), removeItem: k => bag.delete(k) };
const Rooms = require("../js/chat-rooms.js");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), rooms = R("js/chat-rooms.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
test.beforeEach(() => { bag.clear(); delete global.window; });
const mk = () => {
  const r = Rooms.create("p1", "那天下午", "alternate");
  return Rooms.save("p1", { ...r, scenario: "在这条线里他是你的上司，你们偷偷来往了半年。", opening: "门被推开的那一刻，他手还搭在你腰上。" });
};

test("开场只在第一轮当指令发", () => {
  const room = mk();
  const first = Rooms.prompt(room, [], { turns: 0 });
  assert.match(first, /【这一房的开场｜就是此刻正在发生的事】\n门被推开的那一刻/);
  assert.match(first, /从这个场面开始写你的第一反应/);
  assert.ok(first.indexOf("【这间房是从这儿开始的") < 0, "第一轮就把开场说成往事了");
  // 压在最后：它就是此刻正在发生的事
  assert.ok(first.trim().endsWith("它不是一个要反复回到的定格。"), "开场没压在最后");
});

test("第二轮起它就是往事，而且明说时间会往前走", () => {
  const room = mk();
  const later = Rooms.prompt(room, [], { turns: 4 });
  assert.match(later, /【这间房是从这儿开始的｜已经发生过的事，不是这一轮的指令】\n门被推开的那一刻/);
  assert.match(later, /\*\*它已经过去了。时间会往前走\*\*/, "不说这句，它会一直站在门口");
  assert.match(later, /可以是吵起来、可以是谁都不说话、可以是他转身走了/, "不给往下走的方向，它只会重演");
  assert.match(later, /别把场面按回那一刻反复重演/);
  assert.ok(later.indexOf("【这一房的开场") < 0, "第二轮还在当指令发＝等于没拆");
  // 往事那一档要跟「这间房前面发生过的」挨着，不是压在最后跟底子抢位置
  assert.ok(later.indexOf("【这间房是从这儿开始的") < later.indexOf("【本房的底子"));
});

test("底子照旧每轮发——三天之后还成立的那些本来就该每轮提醒", () => {
  const room = mk();
  [0, 1, 9].forEach(n => {
    const p = Rooms.prompt(room, [], { turns: n });
    assert.match(p, /【本房的底子｜本房内优先级最高】\n在这条线里他是你的上司/, "第 " + n + " 轮底子没发");
  });
});

test("那句「每轮先按设定校准自己」改掉了——每轮校准一次就是每轮回到原点", () => {
  const p = Rooms.prompt(mk(), [], { turns: 3 });
  assert.ok(p.indexOf("本轮回复前先按这段设定校准自己") < 0, "那句又回来了");
  assert.match(p, /这段底子说的是【你是谁、这里什么规矩】，不是【这一轮你该说什么】/);
  assert.match(p, /这一轮你该有什么反应，看这一轮真正发生了什么/);
  assert.match(p, /别每轮都回到这段字上重新校准一遍/);
});

test("旧存档不用迁移：老的 scenario 一律当底子", () => {
  const r = Rooms.create("p1", "十七岁", "alternate");
  const old = Rooms.save("p1", { ...r, scenario: "他现在 17 岁" });   // 没有 opening
  assert.equal(Rooms.get("p1", old.id).opening, "", "opening 该默认空字符串");
  const p = Rooms.prompt(old, [], { turns: 5 });
  assert.match(p, /【本房的底子｜本房内优先级最高】\n他现在 17 岁/);
  assert.ok(p.indexOf("这间房是从这儿开始的") < 0 && p.indexOf("这一房的开场") < 0, "没写开场却发了一段空的");
});

test("turns 是调用点数出来的，而且两处走同一份", () => {
  assert.match(app, /const roomTurnsOf = \(charId, room\) => \{/);
  assert.match(app, /!m\.forkSeed && m\.kind !== "system"/, "把开场种子和系统卡也数成对话，第一轮就被当成第二轮");
  assert.equal((app.match(/roomTurnsOf\(charId, /g) || []).length, 2, "两个调用点要走同一份计数");
  assert.match(app, /\{ turns: roomTurnsOf\(charId, sideRoom\) \}/);
  assert.match(app, /\{ turns: roomTurnsOf\(charId, room\) \}/);
  // 数的是这间房自己的，不是主聊天的
  assert.match(app, /const key = window\.ChatRooms\.chatKey\(charId, room\.id\);/);
});

test("界面上把判据说出来了——不说的话她照样把瞬间写进底子那一栏", () => {
  assert.match(comp, /这间房的底子/);
  assert.match(comp, /开场那一刻/);
  // 两个入口都得说：只在一处说的话，从另一处建房的她永远看不到这条判据
  assert.equal((comp.match(/三天之后还成立吗/g) || []).length, 2, "判据只写在一个入口上");
  assert.match(comp, /把一个瞬间写进上面那一栏，他会被每轮按回那一刻，怎么聊都走不出去/);
  assert.match(comp, /patch\(\{ opening: e\.target\.value \}\)/);
  // 建房那一屏和改房那一页都得有，不然从建房那边进来的永远只有一栏
  assert.equal((comp.match(/patch\(\{ opening: e\.target\.value \}\)/g) || []).length, 2, "两个入口要都有开场那一栏");
  assert.match(rooms, /opening: String\(src\.opening \|\| ""\)\.trim\(\)\.slice\(0, 1500\)/);
});
