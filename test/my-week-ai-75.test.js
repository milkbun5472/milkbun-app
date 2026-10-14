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
