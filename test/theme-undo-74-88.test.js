// 她 2026-10-05：「美化改错了想恢复前一步现在没办法咋办」
//   →「美化回退做到每个聊天窗口里吧，自己做错的也可以自己退也可以让秋秋退。秋秋也可以自己退它做错的」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ts = rd("theme-studio.js"), ui = rd("theme-studio-ui.js"), eng = rd("engine.js"), app = rd("app.js"), cmp = rd("components.js"), asst = rd("assistant.js");

// 把 engine.js 里 LookHist 那一段单拎出来跑
function lookEnv() {
  const store = {};
  const i = eng.indexOf("const LOOK_HIST_KEY"), j = eng.indexOf("function loadJSON(k, fb)");
  const src = eng.slice(i, j) + "; return { LookHist, lookPick, lookFullPatch };";
  const f = new Function("loadJSON", "saveJSON", "CHAT_LAYOUT_DEFAULT", src);
  const api = f((k, d) => (k in store ? JSON.parse(store[k]) : d), (k, v) => { store[k] = JSON.stringify(v); return true; },
    { bubble: "bubble", avatar: "all", top: 0 });
  return { store, ...api };
}

test("一本账：单聊、群聊、线下、主题都记在 LookHist；挂在 saveJSON 上不挂调用点", () => {
  assert.match(eng, /const LOOK_STORES = \{ x_chatSettings: "chat", x_groupSettings: "group", x_offlineSettings: "offline" \};/);
  assert.match(eng, /if \(typeof LOOK_STORES === "object" && LOOK_STORES\[k\]\) \{ try \{ LookHist\.noteStore\(k, v\); \} catch \(e\) \{\} \}/);
  assert.match(ts, /LH\(\)\.note\(HIST_SCOPE, prev, next\)/);
  assert.match(ts, /g\.ThemeStudio = \{ histCount, undoStep, /);
});

test("一直点「上一版」就一直往前退；「换回来」能回去；正常改一次清掉换回来", () => {
  const { store, LookHist } = lookEnv();
  const save = (id, css, prevAll) => { const next = { ...prevAll, [id]: { customCSS: css } }; LookHist.noteStore("x_chatSettings", next); store.x_chatSettings = JSON.stringify(next); return next; };
  let s = {};
  s = save("c1", "A", s); s = save("c1", "B", s); s = save("c1", "C", s);
  assert.equal(LookHist.count("chat:c1").back, 3);
  const cur = () => ({ customCSS: JSON.parse(store.x_chatSettings).c1.customCSS });
  const back = () => { const r = LookHist.step("chat:c1", cur(), "back"); s = { c1: r.v.customCSS ? { customCSS: r.v.customCSS } : {} }; LookHist.noteStore("x_chatSettings", s); store.x_chatSettings = JSON.stringify(s); return r.v.customCSS; };
  assert.equal(back(), "B");
  assert.equal(back(), "A");               // 第二下退到更早，不是跳回 C
  assert.equal(LookHist.count("chat:c1").fwd, 2);
  const r = LookHist.step("chat:c1", cur(), "fwd");
  assert.equal(r.v.customCSS, "B");
  s = { c1: { customCSS: "B" } }; LookHist.noteStore("x_chatSettings", s); store.x_chatSettings = JSON.stringify(s);
  s = save("c1", "D", s);
  assert.equal(LookHist.count("chat:c1").fwd, 0);
});

test("设置页一保存把排版铺满默认值、字体两格空，不算一次改动", () => {
  const { lookPick } = lookEnv();
  assert.deepEqual(lookPick("chat", { layout: { bubble: "bubble", avatar: "all", top: 0 }, font: { body: "", display: "" }, customCSS: "" }), {});
  assert.deepEqual(lookPick("chat", { layout: { top: 40 } }), { layout: { top: 40 } });
});

test("每个聊天窗、群、线下、主题工作台都摆同一颗 LookUndoRow", () => {
  assert.match(cmp, /function LookUndoRow\(\{ count, step, onDone, toast \}\)/);
  assert.match(cmp, /window\.__lookStep\("chat", character\.id, dir\)/);
  assert.match(cmp, /window\.__lookStep\("group", group\.id, dir\)/);
  assert.match(cmp, /window\.__lookStep\("offline", char\.id, dir\)/);
  assert.match(ui, /h\(LookUndoRow, \{[\s\S]{0,80}studio\.histCount\(\)/);
  assert.match(app, /window\.__lookStep = lookStep;/);
});

test("秋秋：能替她退一步（lookundo），能撤回自己改错的（undo），聊天窗那几栏也退得动", () => {
  assert.match(asst, /lookundo: \{/);
  assert.match(asst, /undo: \{\n      zh: "撤回我改过的一条"/);
  assert.match(asst, /UNDOABLE = \{[^}]*bubble: 1, chatcss: 1, chatlayout: 1, offlinecss: 1, groupcss: 1, grouplayout: 1 \}/);
  assert.match(asst, /美化能退回的:/);
  assert.match(asst, /\|lookundo\|undo[|"]/);
});
