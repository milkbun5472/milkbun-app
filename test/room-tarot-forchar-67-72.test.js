// 她 2026-09-13 点头加的那一档：房里那张邀请卡多一种——**他开口请她替他抽**。
//
// 前三档都是他给她抽（reading/relation/daily）。forchar 反过来：牌抽的是他自己，
// 所以两件事要跟着换——
//   ① 问法的默认值：这一档天然是【他的】问题，落成「她的事」会把整卦拧过来
//      （解牌那头靠 questionOwner 决定问题里的第一人称指谁）。
//   ② 别再回头问他一次「你愿意让我替你算吗」：他刚在房里开口要的，
//      多问这一次既拧巴（他可能当场拒掉自己提的事），又白花一枪。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");

test("那一格里多了这一档，而且说清楚牌抽的是谁", () => {
  const seg = app.slice(app.indexOf('const roomTarotOn = roomActionOn("tarot");'), app.indexOf("// ⚠️这一条必须挂在【Protocol v2】上"));
  assert.match(seg, /mode:\\"reading\|relation\|daily\|forchar\\"/);
  assert.match(seg, /forchar＝你请她替你抽一张（牌抽的是你：你的近况、你心里那个结）/);
  assert.match(seg, /forchar 那一档默认就是 me/);
});

test("问法的默认值跟着档位走：他请她替他抽＝他的问题", () => {
  const seg = app.slice(app.indexOf("if (roomTarotOn && parsed.tarotInvite"), app.indexOf("if (roomGamesOn && parsed.gameInvite"));
  assert.match(seg, /\["reading", "relation", "daily", "forchar"\]\.indexOf\(String\(tv\.mode \|\| ""\)\) >= 0/);
  assert.match(seg, /forchar: "请你替他抽"/);
  // 他明说了就听他的；没说才按档位给默认
  assert.match(seg, /String\(tv\.asker \|\| ""\) === "me" \? "me" : \(String\(tv\.asker \|\| ""\) === "you" \? "you" : \(mode === "forchar" \? "me" : "you"\)\)/);
  // 塔罗那头把 me 接成 questionOwner=character（问题里的第一人称指他）
  assert.match(tarot, /owner: e\.asker === "me" \? "character" : ""/);
});

test("他自己开口要的那一卦，不再回头问他愿不愿意", () => {
  assert.match(tarot, /const heAsked = !!props\.proposed && props\.modeKey === "forchar" && !!finalQuestion;/);
  assert.match(tarot, /if \(!heAsked && \(props\.modeKey === "forchar" \|\| \(props\.modeKey === "reading" && questionOwner === "character"\)\)\) \{/);
  // 那一戳要带着「这是他开口要的」，不然这一条永远不成立
  assert.match(tarot, /setSeed\(\{ charId: e\.charId \|\| "", q: e\.ask \|\| "", proposed: true,/);
  assert.match(tarot, /proposed: !!\(seed && seed\.proposed\),/);
  // 她自己从架上挑「给角色算一卦」时那一问照旧在（那一问是这一档的灵魂）
  assert.match(tarot, /先问问 " \+ c\.name \+ " 愿不愿意…/);
  assert.match(tarot, /if \(props\.modeKey === "forchar" && intent\.decision === "refuse"\)/);
});

test("他没给问题就还是照旧走那一问：空问题不能当成「他说过了」", () => {
  // heAsked 的第三个条件就是这件事——ask 留空时 finalQuestion 是空串，
  // 这时候还是得让他自己挑一个要问的（不然解牌那头拿到的是一句空问题）
  const i = tarot.indexOf("const heAsked =");
  assert.ok(i > 0);
  assert.match(tarot.slice(i, i + 120), /&& !!finalQuestion;/);
});
