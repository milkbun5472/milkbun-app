// 一起听·边听边说（她 2026-09-29）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const src = R("js/listen-talk.js"), app = R("js/app.js"), scr = R("js/screens.js"), comp = R("js/components.js");
const P = require("../js/auto-refresh-policy.js");

test("上下文走 companionHead（整份 bundle），调用上限不压低", () => {
  assert.match(src, /const sys = companionHead\(p\.ctxFor, char\)/);
  assert.match(src, /maxTokens: 65535/);
});
test("自己开口：一首最多一句、有间隔、受设置里同一格管", () => {
  assert.match(src, /if \(spokeForRef\.current\[song\.id\]\) return;/);
  assert.match(src, /AUTO_GAP_S \* 1000/);
  assert.match(src, /window\.__autoRefreshOn\("listen"\)/);
  assert.match(src, /window\.__setAutoFromPage\("listen", null, n\)/);
  assert.ok(P.FEATURES.some(f => f.id === "listen" && f.noChars));
});
test("播放页接上头像气泡和输入；离开往单聊落 listenlog，三处都认", () => {
  assert.match(scr, /window\.ListenTalk\.useTalk\(/);
  assert.match(scr, /talk \? talk\.bar : null/);
  assert.match(app, /onHandoff: \(charId, entry\) => pChat\(charId, p => \[\.\.\.p, entry\]\)/);
  assert.match(app, /m\.kind === "listenlog"\) \{/);
  assert.match(app, /\(m\.kind === "listenlog"\) \? \(typeof listenLogText/);
  assert.match(comp, /m\.kind === "listenlog"\) return h\(SysNote/);
  assert.match(R("index.html"), /js\/listen-talk\.js\?v=/);
});
test("parseSay：JSON 与空数组", () => {
  const body = src.slice(src.indexOf("function parseSay"), src.indexOf("// mode：reply"));
  const parseSay = new Function(body + "\nreturn parseSay;")();
  assert.deepEqual(parseSay('{"say":["嗯","好听"]}'), ["嗯", "好听"]);
  assert.deepEqual(parseSay('{"say":[]}'), []);
});
