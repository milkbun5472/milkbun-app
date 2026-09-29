// 她 2026-09-29 转读者：「戳了好多下，但只说了一句话，看使用日志多了三次消耗」
// ＋「能不能把陪伴消耗移动到后台 API 便宜一点」＋「生成好了或者失败都要有 toast 提醒」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("companion.js"), engine = R("engine.js"), app = R("app.js");

test("戳一下说一句：最多一枪（不因解析失败再补打），节流全局一份", () => {
  assert.match(comp, /const POKE_GATE = \{ busy: false, last: 0 \};/);
  assert.match(comp, /if \(!info \|\| POKE_GATE\.busy \|\| !char \|\| Date\.now\(\) - POKE_GATE\.last < 15000\) return;/);
  assert.match(comp, /tag: "陪伴", once: true,/);
  assert.match(engine, /if \(!parsed && !probe\.once\) \{/);
});
test("走后台线路；陪伴页和悬浮那只都拿到了后台线路和 toast", () => {
  assert.match(comp, /const p = props\.bgActive \|\| \(props\.apiFor \? props\.apiFor\(char\.id\) : null\)/);
  assert.match(app, /h\(window\.CompanionFloat, \{ characters: liveChars, moods: moods, apiFor: apiFor, bgActive: bgActive, toast: toast,/);
  const page = app.slice(app.indexOf('screen === "companion") body = h(Companion, {'), app.indexOf('screen === "pomodoro") body'));
  assert.match(page, /bgActive: bgActive,/);
  assert.match(page, /toast: toast,/);
});
test("没说出来要告诉她，不再静默吞掉", () => {
  const fire = comp.slice(comp.indexOf("const fire = async () => {"), comp.indexOf("const onPoke = info =>"));
  assert.match(fire, /props\.toast && props\.toast\("他这一句没说出来：/);
  assert.doesNotMatch(fire, /说不出来就只做动作，不打扰她/);
});
test("生成失败兜底网：runProbe 失败时广播，app 接住弹提示；调用方自己弹过就不重复，同一类一分钟一次", () => {
  assert.match(engine, /async function runProbe\(p, ctx, probe\) \{\n  try \{ return await runProbeInner\(p, ctx, probe\); \}/);
  assert.match(engine, /new CustomEvent\("gen-failed"/);
  assert.match(app, /window\.addEventListener\("gen-failed", on\);/);
  assert.match(app, /if \(lastToastAtRef\.current >= at\) return;/);
  assert.match(app, /if \(at - \(genFailSeenRef\.current\[key\] \|\| 0\) < 60000\) return;/);
});
test("戳一下的捡救：没按 JSON 交回来也捡得回那一句，捡不像就不硬用", () => {
  const i = comp.indexOf("  function pokeSalvage(raw) {"), j = comp.indexOf("\n  }\n", i);
  assert.ok(i > 0 && j > i, "抠不出 pokeSalvage");
  const salv = new Function(comp.slice(i, j + 4) + "\nreturn pokeSalvage;")();
  assert.deepEqual(salv('{"line":"又戳我？'), { line: "又戳我？" }, "半截 JSON");
  assert.deepEqual(salv('```json\n{"line": "别闹"}\n```'.replace("{\"line\": \"别闹\"}", "line: 别闹")), { line: "别闹" });
  assert.deepEqual(salv("「干嘛呀」"), { line: "干嘛呀" }, "只回了一句带引号的话");
  assert.deepEqual(salv("我：困死了别戳"), { line: "困死了别戳" });
  assert.equal(salv(""), null);
  assert.equal(salv("【这一下的手感】冲她这个人"), null, "复读提示词不算");
  assert.equal(salv("她戳了我一下，我应该按照自己的性子回应她，考虑到现在是晚上而且她今天已经戳了很多次，我觉得可以说一句带点无奈的话"), null, "一大段分析不算");
  assert.match(engine, /if \(!parsed && typeof probe\.salvage === "function"\)/);
  assert.match(comp, /once: true, salvage: pokeSalvage,/);
});
