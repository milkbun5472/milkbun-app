// 她 2026-11-18：「修了八百遍为啥状态卡的动描还是被算进去了」——单聊动描是单独一条 narration 消息，没有括号
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.resolve(__dirname, "..", "js/weekly.js"), "utf8");
test("动描那一行标成【动作】，数字版整条不算", () => {
  assert.match(src, /const line = actTag\(m\) \+ who \+ "：" \+ txt;/);
  assert.match(src, /"】" \+ actTag\(m\) \+ who \+ "：" \+ txt;/);
  const grab = name => { const i = src.indexOf("  function " + name + "("); let d = 0, j = src.indexOf("{", i); for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
  const stop = src.match(/const STOP2 = [^\n]+\n/)[0];
  const stats = new Function(stop + grab("saidOnly") + grab("vt") + grab("weeklyStats") + "\nreturn { weeklyStats, actTag: m => m && m.role === \"narration\" ? \"【动作】\" : \"\" };")();
  const rows = [];
  for (let k = 0; k < 6; k++) rows.push({ ts: 1, line: stats.actTag({ role: "narration" }) + "沈屿白：我坐在沙发上单手拿着手机" });
  rows.push({ ts: 2, line: "沈屿白：早点睡" });
  const r = stats.weeklyStats({ global: rows }, [], "Lisa");
  assert.equal(r.total, 1);
  assert.ok(!r.topWords.some(x => x.w === "坐在" || x.w === "手机"));
});
