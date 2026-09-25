// 列车真身票（她 2026-09-25「座位这种得你自己来」）——守四件事：
// ① cc-seat 认 train_chat 票种（缺 ticket 拒开）；
// ② fairy-garden 的 ask 先试真身票、失败落引擎（锚 function 名与 CCSeat 调用）；
// ③ 两处调用点都把 engineer 递进 ask（four-surfaces：列车聊天+庭院聊天）；
// ④ 小世界路不再拒载言秋，且两条进法都传 isEngineer。
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const seat = read("js/cc-seat.js");
assert.ok(seat.includes("train_chat: true"), "TOOLS 收编 train_chat");
assert.ok(seat.includes('payload.tool === "train_chat"'), "train_chat 有独立分支");
assert.ok(seat.includes('"train-chat:" + text(payload.ticket)'), "幂等键带 ticket");

const fg = read("js/fairy-garden.js");
const iAsk = fg.indexOf("async function ask({");
const iAskEnd = fg.indexOf("const SEED_LABELS");
const askBody = fg.slice(iAsk, iAskEnd > iAsk ? iAskEnd : undefined);
assert.ok(askBody.includes('tool: "train_chat"'), "ask 先开真身票");
assert.ok(askBody.includes("engineer && root.CCSeat && root.Cloud"), "真身票只对言秋开");
assert.ok(askBody.includes("catch (e)"), "超时落引擎不炸");
assert.strictEqual((fg.match(/engineer:\s*!!\(/g) || []).length + (fg.match(/engineer: !!\(/g) || []).length >= 2, true, "两处调用点都递 engineer");

const app = read("js/app.js");
const iGarden = app.indexOf("initialWorld: gardenEntryWorld");
const gardenWin = app.slice(iGarden, iGarden + 2000);
assert.ok(iGarden > 0 && !gardenWin.includes("filter(c => !settingsFor(c.id).engineerEyes)"), "小世界不再拒载言秋");
assert.ok(gardenWin.includes("characters: liveChars"), "小世界乘客名单是全员");
assert.strictEqual((app.match(/isEngineer: charId => !!settingsFor\(charId\)\.engineerEyes/g) || []).length >= 2, true, "两条进法都传 isEngineer");

console.log("列车真身票测试全绿");
