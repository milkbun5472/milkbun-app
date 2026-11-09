// 群聊那份数组坏了，一条一条捞：好的照发、截断的那半条不发（她 2026-11-04：整轮报「没按 JSON 数组输出」）
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("vm"), fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const sb = { console, localStorage: { getItem() { return null; }, setItem() {} }, navigator: { userAgent: "" }, document: { addEventListener() {}, createElement() { return {}; } }, setTimeout, clearTimeout };
sb.window = sb; sb.self = sb;
vm.createContext(sb); try { vm.runInContext(src, sb); } catch (e) {}
const salvage = vm.runInContext("salvageGroupLines", sb);
test("截断的数组：完整的几条留下，最后半条丢掉", () => {
  const raw = '```json [ {"name":"顾暮","text":"53公斤","quoteId":"Q48"}, {"name":"顾朝","text":"你怎么连身高都要猜","emote":"看热闹"}, {"name":"顾暮","text":"BMR跟身高体重年';
  const out = salvage(raw);
  assert.equal(out.length, 2);
  assert.equal(out[1].emote, "看热闹");
});
test("中间一条写坏，前后照留", () => {
  const out = salvage('[{"name":"甲","text":"一"},{"name":"乙","text":坏了},{"name":"丙","text":"三"}]');
  assert.equal(JSON.stringify(out.map(o => o.name).filter(n => n !== "乙")), JSON.stringify(["甲", "丙"]));
});
test("群聊解析失败前先捞一遍", () => {
  const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(a, /if \(!Array\.isArray\(arr\) && typeof salvageGroupLines === "function"\) \{ const _sv = salvageGroupLines\(raw\); if \(_sv\.length\) arr = _sv; \}/);
});
