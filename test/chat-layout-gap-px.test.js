const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = comp.indexOf("const CHAT_LAYOUT_DEFAULT"), j = comp.indexOf("\n}\n", comp.indexOf("function chatLayoutCSS")) + 3;
const chatLayoutCSS = new Function(comp.slice(i, j) + "; return chatLayoutCSS;")();
const js = s => Array.isArray(s) ? s.join("") : String(s);
test("连发间距能拉数字，拉过的盖住档位，null 回档位（群友 2026-10-25）", () => {
  const a = js(chatLayoutCSS({ gap: "tight", gapIn: 10, gapOut: 30 }));
  assert.match(a, /data-first="0"\]\{padding-top:10px/); assert.match(a, /data-first="1"\]\{padding-top:30px/);
  assert.ok(a.lastIndexOf("padding-top:10px") > a.indexOf("margin-top:-2px"));
  assert.doesNotMatch(js(chatLayoutCSS({ gap: "tight", gapIn: null })), /padding-top:\d+px !important;margin-top:0/);
  assert.match(comp, /"data-wk": "laygap"/);
  assert.match(eng, /\["gapIn", "gapOut"\]\.forEach/);
});
