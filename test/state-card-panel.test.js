const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("头像藏了也能看状态卡：单聊、群聊的「＋」里各有一格（群友 2026-10-26）", () => {
  assert.match(comp, /\["state", "状态卡", "mood"\]\]\.filter\(\(\[key\]\) => key !== "halfwin" \|\| !!onHalfWin\)\.filter\(\(\[key\]\) => key !== "state" \|\| !!onOpenState\)/);
  assert.match(comp, /if \(k === "state"\) \{ setPanelOpen\(false\); onOpenState && onOpenState\(\); return; \}/);
  assert.match(comp, /\.\.\.\(canPeek \? \[\["state", "状态卡", "mood"\]\] : \[\]\)/);
  assert.match(comp, /if \(k === "state"\) \{ setStatePick\(true\); return; \}/);
  assert.match(comp, /\(characters \|\| \[\]\)\.filter\(c => c && canPeek\(c\)\)\.map/);
  assert.match(comp, /mood: \[P\("M12 20s/);
});
