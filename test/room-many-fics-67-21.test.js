// 她 2026-09-12：「放吧宝宝，但是如果讨论了 a 然后发 b 把 a 上下文冲掉了再想聊 a 咋算」
//
// 她问的那一句就是这件事的全部难点。答案要分两半：
//   · 【a 的设定和前情】没被冲掉，也冲不掉——那一份是每一轮从 a 自己身上现拼的
//     （地基／设定卡／伏笔盒／每章锚点／最后一章结尾），换回 a 就原样长回来。
//   · 【你们商量过的走向】才是真会串的那一半：roomTalkOf 原来取「最近 14 条」不分书，
//     聊完 b 再让他写 a，他手上那份「我们说好的」会是 b 的。
// 所以这一层把每一条消息判给它当时那本书，只交出【当前这本】名下的那几段。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const K = require("../js/chat-rooms.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), C = strip(comp);

// 她那天的实际操作：放进 a，聊了两句，放进 b，聊了一句
const ROOM = [
  { ts: 10, ficId: "a", ficTitle: "长篇如果" },
  { ts: 11, role: "user", content: "我想让他这一章去找她" },
  { ts: 12, role: "assistant", content: "行，那就让他先在门口站一会儿" },
  { ts: 20, ficId: "b", ficTitle: "大晏趣闻" },
  { ts: 21, role: "user", content: "这一篇写得轻松点" }
];

test("没挑过的时候，当前就是最近放进来的那一本", () => {
  assert.equal(K.currentFicId(ROOM, null), "b");
  assert.equal(K.currentFicId([], null), "", "一本都没有就是空的，别硬认");
  assert.equal(K.currentFicId(null, null), "");
});

test("换书单子：这间房放过哪几本，最近动过的在前", () => {
  assert.deepEqual(K.roomFicList(ROOM, null).map(x => x.id), ["b", "a"]);
  assert.deepEqual(K.roomFicList(ROOM, null).map(x => x.title), ["大晏趣闻", "长篇如果"]);
  // 同一本放了好几次只算一本
  const twice = ROOM.concat([{ ts: 30, ficId: "a", ficTitle: "长篇如果" }]);
  assert.deepEqual(K.roomFicList(twice, null).map(x => x.id), ["a", "b"]);
});

// ⭐她问的就是这一段
test("换回 a 之后：a 名下的话还在，b 的一句都不串过来", () => {
  const pick = { id: "a", title: "长篇如果", ts: 40 };
  const later = ROOM.concat([{ ts: 41, role: "user", content: "回来接着聊他" }]);
  assert.equal(K.currentFicId(later, pick), "a", "换回去了还认 b＝换书是假的");
  const track = K.ficTrack(later, pick);
  assert.equal(track.join(","), "a,a,a,b,b,a");
  // 换书【之前】那两句聊 a 的话照样归 a——聊过的不会因为中间插了一本 b 就丢掉
  assert.equal(track[1], "a");
  assert.equal(track[2], "a");
  // 中间那句聊 b 的，一句都不许算到 a 头上
  assert.equal(track[4], "b");
});

test("卡本身也归它自己那一本，不归上一本", () => {
  const t = K.ficTrack(ROOM, null);
  assert.equal(t[0], "a", "放 a 的那张卡就是 a 的");
  assert.equal(t[3], "b", "放 b 的那张卡不许还算在 a 头上");
});

test("放第一本之前说过的话，不归任何一本", () => {
  const pre = [{ ts: 1, role: "user", content: "在吗" }].concat(ROOM);
  assert.equal(K.ficTrack(pre, null)[0], "", "那会儿还没有书，别硬塞给谁");
});

test("同一毫秒里，她刚挑的那本要压过卡", () => {
  // 点「换书」和别的事撞在同一毫秒时，不能出现「点了没反应」
  const pick = { id: "a", ts: 20 };
  assert.equal(K.currentFicId(ROOM, pick), "a");
});

test("挑的那本最后会被新卡盖过去——放进来什么就聊什么", () => {
  const pick = { id: "a", ts: 40 };
  const newer = ROOM.concat([{ ts: 50, ficId: "b", ficTitle: "大晏趣闻" }]);
  assert.equal(K.currentFicId(newer, pick), "b", "她又放了一张 b 进来，那就是在聊 b 了");
});

test("单子有上限，不许越堆越长", () => {
  assert.equal(typeof K.ROOM_FIC_CAP, "number");
  const many = [];
  for (let i = 0; i < K.ROOM_FIC_CAP + 5; i++) many.push({ ts: i + 1, ficId: "f" + i, ficTitle: "第" + i });
  assert.equal(K.roomFicList(many, null).length, K.ROOM_FIC_CAP);
  assert.equal(K.roomFicList(many, null)[0].id, "f" + (K.ROOM_FIC_CAP + 4), "最近那本得在头一个");
});

// ── 接上去了没有 ────────────────────────────────────────────────
test("商量的那几句按书分账", () => {
  assert.match(A, /const roomTalkOf = \(chatKey, charName, uName, n, ficId\) => \{/, "得收「哪一本」");
  assert.match(A, /const track = \(ficId && K && K\.ficTrack\) \? K\.ficTrack\(all, roomFicPick\(chatKey\)\) : null;/);
  assert.match(A, /if \(track && track\[i\] !== ficId\) return false;/, "不是这一本的话一句都不许喂过去");
  assert.match(A, /roomTalk: roomTalkOf\(key, activeChar\.remark \|\| activeChar\.name, uName, 14, f\.id\)/, "调用点没把书带上");
});

test("判哪一本只有一份算法，在 ChatRooms 里", () => {
  assert.equal((A.match(/K\.currentFicId\(/g) || []).length, 1, "app 那头不许自己再判一遍");
  ["ficMarks", "currentFicId", "roomFicList", "ficTrack"].forEach(k =>
    assert.equal(typeof K[k], "function", k + " 没导出来"));
  // 老那版「从后往前找第一个 ficId」要撤掉（撤就是删）
  assert.ok(A.indexOf("const id = msgs[i] && String(msgs[i].ficId || \"\");") < 0, "老那版还留着");
});

test("她挑的那本存得下来，换了设备/重开还在", () => {
  assert.match(A, /const K_ROOM_FIC_PICK = "x_roomFicPick";/);
  assert.match(A, /const roomFicPick = chatKey => \(loadJSON\(K_ROOM_FIC_PICK, \{\}\) \|\| \{\}\)\[chatKey\] \|\| null;/);
  assert.match(A, /saveJSON\(K_ROOM_FIC_PICK, all\);/);
  assert.match(A, /ts: Date\.now\(\)/, "换书那一下要记时间，不然判不出先后");
});

test("界面上那条带子：只放了一本就不摆「换书」", () => {
  assert.match(C, /roomFics,\s*\n\s*roomFicId,\s*\n\s*onPickRoomFic,/, "三个 prop 没接上");
  const i = C.indexOf("const more = roomFics.length > 1;");
  assert.ok(i > 0, "那条带子没了");
  const blk = C.slice(i - 400, i + 1600);
  assert.match(blk, /"在写"/, "得看得见现在在写哪一本");
  assert.match(blk, /more \? h\("span"[\s\S]{0,200}?"换书 ›"\) : null/, "只有一本时不该摆换书");
  assert.match(blk, /onClick: more \? function \(\)/, "只有一本还能点开＝点开一张只有一行的单子");
  assert.match(blk, /if \(!on && onPickRoomFic\) onPickRoomFic\(f\.id, f\.title\)/, "点了不换书");
  assert.match(blk, /display: "block", minHeight: 34/, "指头点得到——贴着自己这一行断言，全文里这个数还有别处在用");
});

test("换完要真的重画（那一格存在 localStorage 里）", () => {
  assert.match(A, /setRoomFicTick\(v => v \+ 1\);/, "换完不重画＝点了看不出变化");
  assert.equal((A.match(/\}\)\(roomFicTick\),/g) || []).length, 2,
    "tick 得真是【那两格】的依赖：少接一格，那一格换完书就不重画，而且下次会被当死变量删掉");
});
