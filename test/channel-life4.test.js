// 接龙接上普通群、角色自己起头；每周称号多几样、自定义称号（她 2026-11-20）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const grab = name => { const i = en.indexOf("function " + name + "("); return en.slice(i, en.indexOf("\n}\n", i) + 3); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext("const WEEK_TITLE_CAP=6;" + grab("chainStartOk") + grab("spaceWeekTitles") + grab("spaceWeekDigest") + ";this.o={chainStartOk,spaceWeekTitles,spaceWeekDigest};", ctx);
const o = ctx.o;
test("角色起接龙：群里还有没收的接龙、或今天已经起过，就不起", () => {
  assert.equal(o.chainStartOk([], "", "d1"), true);
  assert.equal(o.chainStartOk([], "d1", "d1"), false);
  assert.equal(o.chainStartOk([{ kind: "spacebot", bot: "chain" }], "", "d1"), false);
  assert.equal(o.chainStartOk([{ kind: "spacebot", bot: "chain", closed: true }], "", "d1"), true);
});
test("新称号照真记录算，够门槛才发，她不算", () => {
  const H = 3600000, now = 100 * 24 * H, chs = [{ id: "a" }];
  const ms = [];
  for (let i = 0; i < 4; i++) ms.push({ role: "assistant", senderId: "x", ts: now - 30 * H + i * 60000, content: "嗯" });   // 夜里 x
  ms.push({ role: "assistant", senderId: "y", ts: now - 20 * H, content: "@阿屿 看这个", kind: "photo" });
  ms.push({ role: "assistant", senderId: "y", ts: now - 19 * H, content: "@阿屿 还有这个", kind: "photo" });
  ms.push({ role: "user", ts: now - 18 * H, content: "@阿屿" });
  const hourOf = ts => (ts === now - 30 * H || (ts > now - 31 * H && ts < now - 29 * H)) ? 2 : 14;
  const t = o.spaceWeekTitles(chs, () => ms, ["x", "y", "z"], now, 7, { nameOf: id => ({ x: "阿屿", y: "顾朝", z: "顾暮" })[id], hourOf });
  assert.match(t.x, /最晚睡/);
  assert.match(t.x, /被@最多/);
  assert.match(t.y, /最爱发图/);
  assert.ok(!("me" in t));
  const n = Object.values(t).join("、").split("、").length;
  assert.ok(n <= 6);
});
test("自定义称号的摘要只收角色说的话", () => {
  const d = o.spaceWeekDigest([{ id: "a", chName: "综合" }], () => [{ role: "user", content: "她说的", ts: 5 }, { role: "assistant", senderId: "x", content: "他说的", ts: 5 }], id => "阿屿", 6, 7, 6000);
  assert.match(d, /阿屿：他说的/); assert.doesNotMatch(d, /她说的/);
});
test("接线：普通群也有接龙、角色起头写进群、自定义称号走一次调用、旁观里不给", () => {
  assert.match(cs, /\.\.\.\(!_gSpect \? \[\["chain", "接龙"/);
  assert.match(ap, /const gChainStartHint = group && !groupSpectating\(group\) && !_subRoot && chainStartOk\(/);
  assert.match(ap, /item\.chainStart && typeof item\.chainStart === "object"/);
  assert.match(ap, /spaceWeekDigest\(chs\.filter\(g => !groupSpectating\(g\) && !channelNoMem\(g\.id\)\)/);
  assert.match(ap, /sp\.aiTitles !== false/);
  assert.match(cs, /function SpaceEditPage\(\{[^}]*onSuggestTitles/);
});
