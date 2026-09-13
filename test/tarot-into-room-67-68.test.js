// 她 2026-09-13 拍板的第三条（前一半）：「把发回聊天也放进房间里面」。
//
// 一卦算的是很私人的事。落进主聊天等于永久挂在你俩的正史上；落进房间就只在那儿算数
// ——跟同人文「只记一笔落回它发生的那间房」（v67.66）是同一条路，所以挑房间那一处
// 照那边的形状长（墨点＋名字），不另发明一种挑法。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
const seg = app.slice(app.indexOf("const forwardTarotToChat"), app.indexOf("// ───────── 擂台"));

test("落点由 roomId 定：主聊天照旧，挑了房就写进那间房的聊天键", () => {
  assert.match(seg, /const rid = String\(\(options && options\.roomId\) \|\| ""\)\.trim\(\);/);
  assert.match(seg, /const sideRoom = \(rid && rid !== "main" && K\) \? K\.get\(toChar\.id, rid\) : null;/);
  assert.match(seg, /const chatKey = sideRoom \? K\.chatKey\(toChar\.id, sideRoom\.id\) : toChar\.id;/);
  // 两条路都写这一个键——只改一条的话，另一条照旧往主聊天灌
  assert.match(seg, /pChat\(chatKey, p => \[\.\.\.p, cardMsg, intro, \.\.\.moved\]\)/);
  assert.match(seg, /pChat\(chatKey, p => \[\.\.\.p, \{ role: "user", kind: card0\.kind/);
  assert.ok(!/pChat\(toChar\.id,/.test(seg), "还有一处直接写主聊天，绕开了落点");
});

test("戳着的那间房已经删了：哪儿都不写，宁可少说", () => {
  assert.match(seg, /if \(rid && rid !== "main" && !\(sideRoom && !sideRoom\.main\)\) \{ toast\("那间房已经不在了，没处放"\); return; \}/);
  // 主聊天那一档（""／"main"）不许被这道闸误伤
  assert.ok(!/rid !== "main"[\s\S]{0,40}return; \}\n[\s\S]{0,40}toChar\.id;[\s\S]{0,20}toast/.test(seg));
});

test("落进房里的那一卦不在这儿代他开口", () => {
  // 房里那一枪有自己整套上下文（门规、这间房自己的往事、能不能读主线）；
  // 这一枪是按主聊天拼的，在这儿自动回一句就是绕过那一整层。
  assert.match(seg, /if \(sideRoom \|\| !active\) return;/);
  assert.match(seg, /房里那一枪有自己整套上下文/);
  // 主聊天那一路的自动反应一个字没动
  assert.match(seg, /"有人（用户）替你算了一卦塔罗/);
});

test("界面：挑房间那一小块在按钮【上面】，没有别的房间就不多问一句", () => {
  assert.match(tarot, /const \[roomId, setRoomId\] = useState\(""\);/);
  assert.match(tarot, /return KR\.list\(s\.charId\)\.filter\(function \(r\) \{ return r && !r\.main; \}\)/);
  assert.match(tarot, /if \(!myRooms\.length\) return null;/, "他没有别的房间时还摆一张单子出来");
  // 先挑后按：单子必须排在按钮前面
  const i = tarot.indexOf('followups.length && props.onForwardToChat && !tableForwarded ? roomPick() : null,');
  const j = tarot.indexOf("onClick: doForwardTable");
  assert.ok(i > 0 && j > i, "挑的东西摆在按钮下面，人是不会回头去看的");
  // 两颗按钮都把落点带过去，按钮上的字也跟着落点走
  assert.match(tarot, /await props\.onForwardToChat\(s, \{ roomId: roomId \}\);/);
  assert.match(tarot, /\{ table: true, roomId: roomId \}/);
  assert.match(tarot, /"把小桌对话带回" \+ whereWord\(\)/);
  assert.match(tarot, /"data-tarot-where": true/);
});
