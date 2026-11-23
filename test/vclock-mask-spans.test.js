// 换面具不改旧消息的时间（群里 2026-11-23：用虚拟时钟的人聊天记录全变回现实时间）
const test = require("node:test"), assert = require("assert"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("写聊天设置的总口子换面具时记 maskSpans", () => {
  assert.match(app, /const \[chatSettings, _setChatSettingsRaw\] = useState/);
  const w = app.slice(app.indexOf("const setChatSettings = upd =>"), app.indexOf("const setChatSettings = upd =>") + 1200);
  assert.ok(w.includes("maskSpans") && w.includes("until: now"));
});
test("clockKeyOf 按消息时间查当时那张面具", () => {
  const c = app.slice(app.indexOf("const clockKeyOf = (id, ts)"), app.indexOf("const ownClockSpansNext"));
  assert.ok(c.includes("maskSpans") && c.indexOf("maskSpans") < c.lastIndexOf("return maskKeyOf(id)"));
});
