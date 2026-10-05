const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 她 2026-10-05：忙的时候晚点回，那句「TA 在忙」要灰字落在屏幕上，不要 toast
test("在忙那句落进聊天，不再 toast", () => {
  const i = app.indexOf("const bg = busyGate(activeChar, chatKey);");
  assert.ok(i > 0, "抠不出让TA回复那段");
  const seg = app.slice(i, i + 1400);
  assert.match(seg, /kind: "busynote"/);
  assert.doesNotMatch(seg, /toast\(characterText\(activeChar, "TA 这会儿在忙/);
  assert.match(seg, /last\.kind === "busynote" && last\.content === busyNote \? p/, "连按会叠好几条");
});

test("busynote 画成撤回那样的一行灰字", () => {
  assert.match(comp, /if \(m\.kind === "busynote"\) return h\("div", \{ key: i, className: "text-center my-2" \}/);
});
