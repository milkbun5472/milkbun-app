const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("番茄钟收桌往私聊放一张小卡：时长、戳了几次、TA 的批注都带上", () => {
  const pomo = read("pomodoro.js"), app = read("app.js"), comp = read("components.js");
  assert.match(pomo, /pokes: \(sessRef\.current\.pokes \|\| 0\) \+ 1/, "戳了几次没记");
  assert.match(pomo, /pokes: s\.pokes \|\| 0/, "收桌记录里没带戳的次数");
  assert.match(pomo, /props\.onShare\(rec, s\.char\)/, "收桌没往外递");
  assert.match(pomo, /window\.PomoShareCard = PomoShareCard/);
  assert.match(app, /kind: "pomoshare", content: body/, "私聊里没落那张卡");
  assert.match(comp, /if \(kind === "pomoshare"\) return window\.PomoShareCard/, "聊天里不认这张卡");
});
