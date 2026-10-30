// v63.38 小游戏审计批 11：终局「把这局收进记忆」。
// 小游戏是沙盒（读主线、不写主线——four-surfaces 第 5 条）。这颗按钮是唯一例外，
// 而例外必须是【她亲手点的】：默认一个字不写、点一次只写一条、写的对象只有
// 上场的真实角色（NPC 没有主线，言秋的记忆走 CC 不走 app 记忆库）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const games = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("app 侧那扇门：只收真实角色、打小游戏标签、knownBy 跟 charIds 一致", () => {
  const seg = cut(app, "keepGameMemory: (charIds, text, room) => {", "},");
  assert.match(seg, /filter\(id => characters\.some\(c => c\.id === id\)\)/, "没过滤到真实角色，NPC 的 key 会写进记忆库");
  assert.match(seg, /tags: \["小游戏"\], source: "manual"/, "写入的形状不对");
  assert.match(seg, /if \(!t0 \|\| !ids\.length\) return false;/, "空局也写了");
  // ⚠️v67.55：落点不再写死记忆库——这一局在哪间房打的就落在哪儿（她 2026-09-12）。
  //   knownBy 跟 charIds 一致那条搬进了公共那一份。
  const kw = cut(app, "const keepWhereItHappened = (opts) => {", "\n  };");
  assert.match(kw, /knownBy: charIds\.slice\(\)/, "写入的形状不对");
  assert.match(kw, /window\.ChatRooms\.memAdd\(pid, room\.id, \[\{ text,/, "侧房那一路没落进这间房自己的记忆");
  assert.ok(kw.indexOf("addMemEntry") > kw.indexOf("return \"room\";"), "落进房里之后又往记忆库写了一遍");
});

test("按钮是唯一入口：九桌各一颗，点一次只写一条，全 NPC 局给说法", () => {
  // v76.772 起国际象棋、中国象棋、斗兽棋共用一张 EngineBoardPage：三桌一颗按钮、一份战果，所以是十八处
  assert.equal((games.match(/h\(KeepMemBtn,\s*\{/g) || []).length, 19, "十九个终局屏该各有一颗（围棋/走子棋那一张（国际象棋·中国象棋·斗兽棋）/卧底/狼人/阿瓦隆/猜谜/真心话/大富翁/UNO/五子棋/你画我猜/骗子骰/故事接龙/俄罗斯方块/德州/抽鬼牌/21 点/斗地主/心有灵犀）");
  assert.match(cut(games, "function EngineBoardPage(props)", "\n  function "), /h\(KeepMemBtn,\s*\{/, "走子棋那张公共页没挂按钮");
  // v75.328 起七桌各交一份战果 rep（同一份管收进记忆、战报、战绩），写记忆只剩按钮里那一处
  assert.equal((games.match(/rep:\s*function\s*\(\)\s*\{/g) || []).length, 19, "有的桌没交战果");
  assert.ok((games.match(/ids:\s*realCharIds\(/g) || []).length >= 11, "有的桌没走 realCharIds——NPC 或言秋会被写进去");
  const btn = cut(games, "function KeepMemBtn(props)", "\n  }");
  assert.match(btn, /if \(kept\) return;/, "能连点连写");
  // v76.387 起勾了「连过程一起」会把战果包一层（out），所以不钉变量名，钉「走那扇门、交的是那份战果的 text」
  assert.match(btn, /host\.keepGameMemory\(ids, \w+\.text\)/, "按钮没走那扇门");
  assert.match(btn, /这局上场的都是 NPC/, "全 NPC 局没有说法");
  const rc = cut(games, "function realCharIds(players)", "\n  }");
  assert.match(rc, /!p\.isNpc && !p\.isUser && !p\.engineer/, "realCharIds 的过滤不对（言秋的记忆走 CC，不走 app 记忆库）");
});

test("默认不写：games.js 里没有任何自动调用 keepGameMemory 的地方", () => {
  // 只剩 engineProps 那一截（一个兜底判断 + 一个转交）；真正写只在按钮的 onClick 里（host.keepGameMemory 一处）
  assert.equal((games.match(/props\.keepGameMemory/g) || []).length, 2, "出现次数对不上——多出来的那处八成是自动写");
  assert.equal((games.match(/host\.keepGameMemory\(/g) || []).length, 1, "按钮以外还有地方在写");
});

// ⚠️这一条是这份测试当年缺的那一条，缺了整整四个版本：
//   games.js 那七颗按钮在、app.js 那扇门也在，**中间 engineProps 那一截从来没接过**，
//   于是每一局终局点「把这一局收进记忆」都是空按，还会弹一句「这局上场的都是 NPC」。
//   上面那几条全是绿的——因为它们只各自钉了两头，没有一条问过「它到底通不通」。
test("中间那一截：七个游戏引擎真的拿得到 keepGameMemory", () => {
  const ep = cut(games, "const engineProps = {", "\n      if (session.game.key ===");
  assert.match(ep, /\n\s*keepGameMemory: keepMem,/, "engineProps 里没有它＝七桌那颗键全是空按");
  // 那一份是带房间的（约会那盒和其余几桌共用它；约会原来直接递 props.keepGameMemory，房间那截丢了）
  assert.match(games, /const keepMem = function \(ids, text\) \{\n\s*const room = [^\n]*\n\s*return props\.keepGameMemory \? props\.keepGameMemory\(ids, text, room\) : false;/);
  assert.match(games, /h\(window\.DateGame, \{\n\s*keepGameMemory: keepMem,/, "约会那盒没走带房间的那一份");
  // 每个引擎拿到的都是这一份（要么直接给 engineProps，要么在它上面 Object.assign）
  ["SpyGame", "WolfGame", "GuessGame", "TruthDareGame", "AvalonGame", "MonopolyGame", "UnoGame"].forEach(g => {
    const line = games.split("\n").find(l => l.indexOf("h(" + g + ",") >= 0);
    assert.ok(line && line.indexOf("engineProps") >= 0, g + " 没吃到 engineProps");
  });
});
