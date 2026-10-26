const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("配色色号能手打、能粘贴，不带 # 和三位简写也认（群友 2026-10-26）", () => {
  const i = comp.indexOf("  const typeText = v => {"), body = comp.slice(i, comp.indexOf("  };", i) + 4);
  const sent = []; let hexOnly = true; const setDraft = () => {}; const onChange = v => sent.push(v);
  const typeText = eval("(" + body.replace("  const typeText = ", "").replace(/;\s*$/, "") + ")");
  ["fbd5a8", "#abc", "#12", "3f6d8c"].forEach(typeText);
  assert.deepEqual(sent, ["#fbd5a8", "#aabbcc", "#3f6d8c"]);
  assert.match(ui, /"data-wk": "themehex"[\s\S]{0,200}h\(ColorDot, \{[\s\S]{0,80}hexField: true,\s*hexOnly: true/);
});
