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
  assert.match(src, /maxTokens: 65000/);
});
test("自己开口：一首最多一句、有间隔、受设置里同一格管", () => {
  assert.match(src, /if \(spokeForRef\.current\[song\.id\]\) return;/);
  assert.match(src, /AUTO_GAP_S \* 1000/);
  assert.match(src, /window\.__autoRefreshOn\("listen"\)/);
  assert.match(src, /window\.__setAutoFromPage\("listen", null, n\)/);
  assert.ok(P.FEATURES.some(f => f.id === "listen" && f.noChars));
});
test("播放页接上头像气泡和输入；说的每句原样落进单聊，旧 listenlog 小条三处照认", () => {
  assert.match(scr, /window\.ListenTalk\.useTalk\(/);
  assert.match(scr, /talk \? talk\.bar : null/);
  assert.match(app, /onToChat: \(charId, rows\) => pChat\(charId/);
  assert.match(src, /if \(props\.onToChat\) props\.onToChat\(partner\.id, list\);/);
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

// 她 2026-09-29：「我的气泡能不能消失的时间和他的一致，因为有时候等回复很久我的气泡消失了他才回」
test("她的气泡从TA接上那一刻起算；等回话时不淡；TA的照旧从自己冒出来算", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "listen-talk.js"), "utf8");
  const i = src.indexOf("    const clockOf = r => {"), j = src.indexOf("\n    };\n", i);
  assert.ok(i > 0 && j > i, "抠不出 clockOf");
  const mk = (rows, busy, now) => new Function("rows", "busy", "now", src.slice(i, j + 7) + "\nreturn clockOf;")(rows, busy, now);
  const me = { role: "user", ts: 1000 }, him = { role: "assistant", ts: 40000 };
  assert.equal(mk([me, him], false, 50000)(me), 40000, "她那句没跟着TA的回话起算");
  assert.equal(mk([me, him], false, 50000)(him), 40000);
  assert.equal(mk([me], true, 30000)(me), 30000, "还在等TA，她的气泡就开始淡了");
  assert.equal(mk([me], false, 30000)(me), 1000, "TA没出声（没在等）时照旧从她发出那刻算");
  assert.match(src, /now - clockOf\(r\) - BUBBLE_MS \* 0\.6/, "淡出那一段还在按她自己发的时间算");
});
