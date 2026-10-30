const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), eng = R("engine.js");
test("日期锚一律照那只虚拟钟：聊天、小房间、群、线下、群线下、群成员私聊摘录", () => {
  assert.match(eng, /function vAnchor\(text, ts, id\)/);
  assert.equal((app.match(/window\.TemporalAnchor\.anchor\(/g) || []).length, 0, "app.js 里还有直接按现实日期打日期锚的");
  assert.equal((eng.match(/window\.TemporalAnchor\.anchor\(/g) || []).length, 2, "engine.js 只该剩记忆那一处（已换算）和 vAnchor 本身");
  assert.match(app, /generateOfflineGroup\(offlineActive, \{ \.\.\.gCtx, clockId: "g:" \+ groupId \}/);
});
test("TA 那边的日子照钟：每轮的日期感知、群里谁过生日、片刻、直播、时刻那年今日、月度印象、照影", () => {
  assert.match(app, /const today = new Date\(typeof vclockMap === "function" \? vclockMap\(Date\.now\(\), char\.id\)/);
  assert.match(app, /vclockMap\(Date\.now\(\), "g:" \+ groupId\) : Date\.now\(\)\);   \/\/ 这个群认的那只虚拟钟/);
  assert.match(R("shua-core.js"), /const DATE_FACT = nowTs =>/);
  assert.match(R("shua.js"), /vclockMap\(Date\.now\(\), c\.id\)/);
  assert.match(R("live.js"), /new Date\(vt\(slot\.start, slot\.charId\)\)/);
  assert.match(R("shike-core.js"), /new Date\(vtOf\(m\.ts, c\.id\)\)/);
  assert.match(R("impression-core.js"), /vclockMap\(seg\[0\]\.ts, charId\)/);
  assert.match(R("zhaoying-core.js"), /const dateZh = \(ts, id\) =>/);
});
