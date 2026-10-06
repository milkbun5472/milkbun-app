// 群里唯心主弈 2026-10-06 许愿：「加一个角色自动回复，收起键盘多少秒后开始回复（点叶子感觉在逼他回复）」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("聊天设置里能调、存得住、递进聊天页", () => {
  assert.match(cmp, /const \[autoReplySec, setAutoReplySec\] = useState\(Math\.max\(0, Number\(settings\.autoReplySec\) \|\| 0\)\)/);
  assert.match(cmp, /autoReplySec: autoReplySec,/);
  assert.match(app, /autoReplySec: Math\.max\(0, Math\.min\(600, Number\(s\.autoReplySec\) \|\| 0\)\),/);
  assert.match(app, /autoReplySec: Math\.max\(0, Math\.min\(600, Number\(settingsFor\(activeChar\.id\)\.autoReplySec\) \|\| 0\)\),/);
});
test("只在：最后一条是她的、键盘收着、框是空的；走的是叶子那一个 reply，一条只回一次", () => {
  const i = cmp.indexOf("const autoFiredRef = useRef(0);"), seg = cmp.slice(i, i + 1800);
  assert.match(seg, /last\.role !== "user"/);
  assert.match(seg, /document\.activeElement === b \|\| String\(b\.value \|\| ""\)\.trim\(\)\.length > 0/);
  assert.match(seg, /autoFiredRef\.current = last\.ts; reply\(""\);/);
  assert.match(seg, /autoFiredRef\.current >= last\.ts/);
});
