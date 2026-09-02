// 群里那一摞规矩的【真跑】把手（v60.39）。
// 三处群（线上/线下/通话）共用 engine.js 的 groupBans()，所以测它该测【它吐出哪几层】，
// 而不是去 grep「这个常量拼在那一行的哪个位置」——后者正是这一整轮反复误报的那类断言：
// 一改拼法就红，可行为一个字没变。
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const NAMES = ["ANTI_CLICHE", "INTIMATE_ANTI_CLICHE", "NARRATIVE_ANTI_CLICHE", "WORLDBOOK_RULE",
  "CHARCARD_RULE", "GROUP_IN_CHARACTER", "GROUP_USER_IS_PRESENT", "CONDESCENDING_TONE_BAN",
  "REGISTER_FOLLOWS_SCENE", "PERSONA_REGISTER_ANCHOR", "MOOD_TURN_RULE", "STOCK_REPLY_BAN", "ECHO_QUESTION_BAN"];
const i = eng.indexOf("function groupBans(opts) {");
const body = eng.slice(i, eng.indexOf("\n}", i) + 2);
const fn = new Function(...NAMES, "ContentBoundaries", "ReplyPacing", body + "\nreturn groupBans;")(
  ...NAMES.map(n => "<" + n + ">"), { prompt: "<CB>" }, { reading: () => "<RP>" });
// 三处群各自的调用参数，跟真代码保持一致
const ONLINE = { echo: false };
const CALL = { echo: true };
const OFFLINE = { narrative: true, mood: true, echo: true, worldbook: true };
const layers = o => fn(o).split("\n\n");
const has = (o, name) => layers(o).indexOf("<" + name + ">") >= 0;
// 三处群都吃得到某一层
const allGroupsHave = name => has(ONLINE, name) && has(CALL, name) && has(OFFLINE, name);
module.exports = { layers, has, allGroupsHave, ONLINE, CALL, OFFLINE };
