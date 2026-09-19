// 她 2026-09-19（截图）：「不要emoji宝宝，还有被截断了 还有为什么我发红包头像是在
//   另一边没有我的头像。整体红包样式改改」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js");

const card = () => {
  const i = comp.indexOf("function RedPacketCard({ rp, onClick }) {"), j = comp.indexOf("// 发起投票（群聊 +面板 → 投票）", i);
  assert.ok(i > 0 && j > i, "抠不出 RedPacketCard");
  return comp.slice(i, j);
};

// ⚠️这条是那三样里唯一真坏了的：群里那一行判的是 m.role === "user"，
//   而 sendRedPacket 压根没写 role → undefined，于是她发的红包被当成别人发的。
test("我发的红包要认得出是我发的", () => {
  const i = app.indexOf("  const sendRedPacket = (groupId, total, count, message, toId) => {");
  const j = app.indexOf("  const postClaimLine", i);
  assert.ok(i > 0 && j > i, "抠不出 sendRedPacket");
  assert.match(app.slice(i, j), /role: "user",\n\s*kind: "redpacket"/, "我发的红包没写 role——会靠左排、还套别人的头像");
  const k = app.indexOf("  const postRedPacket = (groupId, char, total, count, message, toId) => {");
  const l = app.indexOf("  // 我领红包", k);
  assert.ok(k > 0 && l > k, "抠不出 postRedPacket");
  const seg = app.slice(k, l);
  assert.match(seg, /role: "assistant",\n\s*kind: "redpacket"/, "角色那条也别靠默认值蒙对");
  assert.match(seg, /senderName: char\.name,/, "没名字的话上面那行标题是空的");
});

test("一个 emoji 都不许留", () => {
  // ⚠️注释里的 ⚠️ 不算：这个仓库满篇都是它。只看真代码。
  const live = x => x.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const seg = card();
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(live(seg)), "卡面上还有 emoji");
  const i = comp.indexOf("function RedPacketOpenSheet({"), j = comp.indexOf("function GroupSettingsSheet(", i);
  const sheet = comp.slice(i, j);
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(live(sheet)), "打开那一屏还有 emoji");
  // 换上来的是画出来的那枚金印（双环＋中心点），不是又借一个符号
  assert.ok(/border: "1\.5px solid " \+ GOLD/.test(seg) && /background: GOLD/.test(seg), "卡面上那枚金印没画");
  assert.ok(!/「福」|"福"/.test(live(seg)), "写「福」字又是借来的符号");
});

// ⚠️「【只给 Lisa】」原来挤在祝福语前面，把本来就只有一行的地方吃掉一半
test("祝福语不再一行就断，只给谁单做一枚标签", () => {
  const seg = card();
  assert.ok(/WebkitLineClamp: 2/.test(seg), "祝福语还是一行");
  assert.ok(!/whiteSpace: "nowrap"/.test(seg), "又写死 nowrap 了");
  assert.ok(/"只给 " \+ only/.test(seg), "只给谁没单拎出来");
  assert.ok(seg.indexOf('"只给 " + only') < seg.indexOf("rp.message"), "标签要排在祝福语上面，不然又跟它抢宽度");
  assert.ok(!/"【只给 " \+ only \+ "】"/.test(comp), "又把它塞回祝福语里了");
});

// tabs-not-plain-pills 那把尺子：它得长在「红包是什么」上
test("画的是一个红封，不是一条橙色提示杠", () => {
  const seg = card();
  assert.ok(!/f5a623/.test(comp), "橙色还在——那是提示条的颜色，不是红包");
  assert.ok(/linear-gradient\(160deg," \+ RED \+ "," \+ RED_D/.test(seg), "封身没了");
  assert.ok(seg.includes("封口"), "封口那道没画——那是红包最认得出的记号");
  assert.ok(/borderLeft: "14px solid transparent", borderBottom: "14px solid/.test(seg), "右下角那个折角没了");
});

test("已领完／不是给你的，整张要暗下去", () => {
  const seg = card();
  assert.ok(/const dim = done \|\| locked;/.test(seg), "两种情况没走同一档灰");
  assert.ok(/RED = dim \?/.test(seg) && /GOLD = dim \?/.test(seg), "暗下去只暗了一半");
  assert.ok(seg.includes("不是给你的"), "专属那一档的底注丢了");
});
