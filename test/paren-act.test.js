// 单聊：她这句（）里算动作还是打的字（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js"), ts = R("theme-studio.js");
test("输入框有括号才冒开关；选了动作发出去带 parenAct，按人记住", () => {
  assert.match(cmp, /chatMode === "chat" && PAREN_ACT_RE\.test\(String\(draft \|\| ""\)\) \? h\("button", \{ "data-wk": "parenacttoggle"/);
  assert.match(cmp, /else if \(actOf\(v\)\) sendRich\(\{ role: "user", content: v, parenAct: true, read: true \}\);/);
  assert.match(cmp, /saveJSON\("x_parenAct", Object\.assign\(\{\}, all, \{ \[character && character\.id\]: !!v \}\)\)/);
});
test("气泡里（）斜体；喂给 TA 说明括号里是动作", () => {
  assert.match(cmp, /isU && m\.parenAct \? h\(ParenActText, \{ text: m\.content \}\)/);
  assert.match(app, /const _pa = m\.parenAct && !m\.kind \?/);
  assert.match(ts, /\["parenacttoggle", /);
});
test("拆段：只把括号那几段挑出来", () => {
  const re = /([（(][^（）()]+[）)])/;
  const segs = "好啊（抱住你）走吧".split(re);
  assert.deepEqual(segs, ["好啊", "（抱住你）", "走吧"]);
});
