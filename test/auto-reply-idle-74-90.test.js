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
  const i = cmp.indexOf("const autoFiredRef = useRef(0);"), seg = cmp.slice(i, i + 2600);   // reply 里多了「我的动作」那两支（2026-10-31），窗口放宽
  assert.match(seg, /last\.role !== "user"/);
  assert.match(seg, /document\.activeElement === b \|\| String\(b\.value \|\| ""\)\.trim\(\)\.length > 0/);
  assert.match(seg, /autoFiredRef\.current = last\.ts; reply\(""\);/);
  assert.match(seg, /autoFiredRef\.current >= last\.ts/);
});

// 群里 2026-10-20：「发完下一秒自己弹了第二轮」——她自己按了叶子／发送，同一条不许再自动回一轮
{
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(c, /const reply = \(pending\) => \{\n    if \(sending\) return;[\s\S]{0,300}autoFiredRef\.current = Math\.max\(autoFiredRef\.current, Date\.now\(\) \+ 3000\);/);
  assert.match(c, /const now0 = lastMsgRef\.current; if \(busy\(\) \|\| sending \|\| autoFiredRef\.current >= last\.ts \|\| !now0 \|\| now0\.role !== "user" \|\| now0\.ts !== last\.ts\) return;/);
}
