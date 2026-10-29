// 群友 2026-10-29 许愿，她：「面具设置里面加一个选里面有谁，聊天设置里面的认得那张面具也会同步改」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("面具页「谁认得这张」写的就是聊天设置那一格 maskId", () => {
  assert.match(app, /knowsOf: id => String\(settingsFor\(id\)\.maskId \|\| ""\)/);
  assert.match(app, /onSetKnows: \(id, maskId\) => patchChatSetting\(id, \{ maskId: maskId \|\| "" \}\)/, "得走同一个出口，不另存");
  assert.match(comp, /onClick: \(\) => onSetKnows\(c\.id, on \? "" : editId\)/, "再点一下认回主面具");
  assert.match(comp, /\(editId && !isPrimary && Array\.isArray\(chars\)/, "只在副面具上出现");
  assert.match(comp, /"data-wk": "maskknowsitem"[^\n]*\n[^\n]*minHeight: 40/, "点得到");
});

// 她 2026-10-29 转群友：换了面具头像、点了「谁认得这张」，聊天里还是默认紫头像——
//   「谁认得」一点就生效，头像却要点 ✓ 才存，划走面板就丢了。关掉面板也存。
test("面具面板关掉时把正在改的那张也存下", () => {
  assert.match(comp, /onClose: \(\) => \{ try \{ commit\(\); \} catch \(e\) \{\} onClose && onClose\(\); \},/);
});
