const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("聊天里每一行的头像都是同一颗：能点开状态卡、头像框套得上（她 2026-10-27）", () => {
  assert.match(c, /const charAvEl = \(\) => h\("button", \{ onClick: avTap\(onOpenState\)/);
  assert.match(c, /const gMeAvEl = \(size, radius\) => gsp\.showMyAvatar \? h\("span", \{ "data-wk": "avatar"/);
  const i = c.indexOf('if (m.kind === "emote") return');
  assert.match(c.slice(i, i + 400), /"data-wk": "cardrow", "data-me":[\s\S]*charAvEl\(\)/);
  // 单聊消息分派里不再有裸的 40px 头像
  const a = c.indexOf("    const cardRow = (i, m, card) => {"), b = c.indexOf('"data-wk": "msg", "data-me": isU ? "1" : "0", "data-i": i,');
  assert.ok(!/h\(Avatar, \{ character: (character|meAv), size: 40, radius: 10 \}\)/.test(c.slice(a, b).replace(/const (charAvEl|meAvEl) = [^\n]*\n/g, "")));
  assert.match(c, /\[data-wk="cardrow"\] > \[data-wk="avatar"\]\{display:none !important;\}/);
});
