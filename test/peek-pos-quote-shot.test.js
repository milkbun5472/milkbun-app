// 查手机三件（她 2026-11-26）：记住每个聊天上次看到哪儿；心声对上那一句、回放时框出来；截图去找她算账
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js"), p = src("peek-phone.js"), ts = src("theme-studio.js");
const loadPeek = () => { const w = {}; new Function("window", "React", p)(w, {}); return w.PeekPhone; };

test("心声挂着原话：变成带 at 的 think，不再空滑一屏；老写法照旧", () => {
  const P = loadPeek();
  const out = P.cleanScript({ steps: [{ do: "open", app: "chat", who: "陆衍", thoughts: [{ at: "「陆衍：明天几点」", t: "约这么勤？" }, "还在聊"] }] }, ["chat", "messages"], { who: ["陆衍"] });
  const th = out.filter(s => s.do === "think");
  assert.deepStrictEqual(th[0], { do: "think", text: "约这么勤？", at: "明天几点" });
  assert.strictEqual(th[1].at, undefined);
  const i0 = out.indexOf(th[0]);
  assert.notStrictEqual(out[i0 - 1].do, "scroll", "挂了原话的不空滑");
});

test("每个聊天上次看到哪儿：有新的先看新的，没新的往上翻，翻完照实说", () => {
  const i = a.indexOf("  const peekWindow = "), j = a.indexOf("  // 翻完了：他点开过的那几个聊天", i);
  let store = {};
  const mk = new Function("loadJSON", "peekWinRef", a.slice(i, j) + "\nreturn peekWindow;");
  const ref = { current: {} }, win = mk((k, fb) => store[k] || fb, ref);
  const ms = Array.from({ length: 40 }, (_, k) => ({ ts: k + 1, content: "句" + (k + 1) }));
  let r = win("v", "c:x", "陆衍", ms, 16);
  assert.deepStrictEqual([r.win[0].ts, r.win[r.win.length - 1].ts, r.note], [25, 40, ""], "第一次：最近 16 条");
  store.x_peekPos = { v: { "c:x": { from: 25, to: 40 } } };
  r = win("v", "c:x", "陆衍", ms, 16);
  assert.deepStrictEqual([r.win[0].ts, r.win[r.win.length - 1].ts], [9, 24], "没新的：往上翻那一截");
  assert.match(r.note, /往上翻/);
  r = win("v", "c:x", "陆衍", ms.concat([{ ts: 41, content: "新的" }, { ts: 42, content: "又一句" }]), 16);
  assert.deepStrictEqual([r.win[0].ts, r.win[r.win.length - 1].ts], [38, 42], "有新的：新的那两条加前面三句接上");
  assert.match(r.note, /又聊了 2 条/);
  store.x_peekPos = { v: { "c:x": { from: 1, to: 40 } } };
  assert.match(win("v", "c:x", "陆衍", ms, 16).note, /从头翻到尾/);
  assert.deepStrictEqual(ref.current.v["陆衍"], { key: "c:x", from: 25, to: 40 });
});

test("翻完才记位置；回放不记", () => {
  assert.match(a, /peekPosSave\(p\.charId, \[\.\.\.new Set\(sc\.filter/);
  assert.match(a, /peekPosSave\(charId, \[\.\.\.new Set\(script\.filter/);
  assert.ok(a.indexOf("if (p && p.replay) { openChatById(p.charId); return; }") < a.indexOf("peekPosSave(p.charId"));
});

test("回放：滑到那一句、框住，再冒心声", () => {
  assert.match(p, /function findSaid\(quote\)/);
  assert.match(p, /if \(s\.at\) \{\n\s*let el = findSaid\(s\.at\);/);
  assert.match(p, /"data-wk": "peeksaidbox"/);
});

test("截图：翻完存下那几句，聊天里能甩出来，卡片照原话画", () => {
  assert.match(a, /const peekQuoteThoughts = \(viewerId, script\) =>/);
  assert.match(a, /openCaps\.push\("peekshot"\)/);
  assert.match(a, /if \(parsed\.peekshot != null && parsed\.peekshot !== false && !sideRoom\)/);
  assert.match(c, /if \(m\.kind === "peekshot" && m\.shot\) return h\("div"/);
  for (const k of ["peeksaidbox", "peekshot", "peekshotbar", "peekshothead", "peekshotline"]) assert.ok(ts.includes('["' + k + '"'), k);
});
