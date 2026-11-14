import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const scr = (readFileSync(new URL("../js/screens.js", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8"));
test("我放的纸条：摊开放进抽屉，标 from:me", () => {
  assert.match(app, /kind: "mine", from: "me",[^}]*openedTs: Date\.now\(\)/);
});
test("让他看看：走 TA 亲口的那条路（人设、最近聊天、防八股都在 bundle 里），回信贴在原条上、记进记忆", () => {
  const i = app.indexOf("const replyDrawerMine"), body = app.slice(i, i + 3000);
  assert.match(body, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{\s*voice: true/);
  assert.match(body, /reply: r, replyTs: Date\.now\(\)/);
  assert.match(body, /coupleKeep\(char\.id/);
  assert.doesNotMatch(body, /别在聊天里提|不要在聊天里提/);
});
test("抽屉页接上：放一张、让他看看；里程碑不算我放的", () => {
  assert.match(scr, /"data-wk": "drawerputmine"/);
  assert.match(scr, /onAskReply\(x\.id\)/);
  assert.match(app, /x\.kind !== "mine"\)/);
});
