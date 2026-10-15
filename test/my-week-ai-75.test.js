// 她 2026-10-14：「为啥不直接搞个角色一样的ai帮排」——我自己的日历也能 AI 排这几天
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
test("我的日历：AI 帮我排这几天，只往空档里排、落成普通日程", () => {
  const app = R("js/app.js"), i = app.indexOf("const genMyWeek = async");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 3000);
  assert.ok(/saveCalTimedEvent\(\{ owner: "mine"/.test(seg));
  assert.ok(/days\.indexOf\(String\(x\.date/.test(seg));
  assert.ok(/onGenMyWeek: genMyWeek/.test(app));
  const c = R("js/components.js");
  assert.ok(/view === "mine" && onGenMyWeek/.test(c));
  assert.ok(/AI 帮我排这几天/.test(R("js/assistant-manual.js")));
});

test("照面具人设排：persona 和她在哪都喂进去", () => {
  const app = R("js/app.js"), seg = app.slice(app.indexOf("const genMyWeek = async"), app.indexOf("const genMyWeek = async") + 3500);
  assert.ok(/profile\.persona/.test(seg) && /myRealm\(null\)/.test(seg));
});

test("每张面具一本日程：副面具记在 mine:面具id，角色跟着自己认的面具看", () => {
  const app = R("js/app.js"), c = R("js/components.js");
  assert.ok(/const myCalOwnerFor = charId => \{ const k = maskKeyOf\(charId\); return k \? "mine:" \+ k : "mine"; \}/.test(app));
  assert.ok(/timedTitles\(myCalOwnerFor\(char\.id\)\)/.test(app));
  assert.ok(/calEventsOnDay\(calEventsRef\.current, myCalOwnerFor\(viewerId\)/.test(app));
  assert.ok(/const evOwner = view === "mine" \? \(myMask \? "mine:" \+ myMask : "mine"\) : view;/.test(c));
  assert.ok(/calEventsOnDay\(calEvents, evOwner, dk\)\.filter\(e => !e\._allDay\)/.test(c));
  assert.ok(/maskKeyOf\(c\.id\) === myMask/.test(c));
  assert.ok(/onGenMyWeek\(myAsk, myMask\)/.test(c));
});
