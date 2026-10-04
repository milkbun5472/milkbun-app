const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
// 单人视频跟微信一个摆法（她 2026-10-05）：TA 铺满、你在右上角小框，点小框互换
const i = comp.indexOf("function CallScreen("), j = comp.indexOf("\nfunction ", i + 20);
const cs = comp.slice(i, j);
test("meBig 这个 hook 排在缩小早退前面（不然按缩小键会崩）", () => {
  const a = cs.indexOf("const [meBig, setMeBig] = useState(false);"), b = cs.indexOf("if (minimized) {");
  assert.ok(a > 0 && b > a);
});
test("只管单人视频；镜头关了自动回到 TA 铺满；群视频照旧", () => {
  assert.match(cs, /const pip = isVideo && !isGroup && !bye;/);
  assert.match(cs, /const showMeBig = pip && meBig && camOn;/);
  assert.match(cs, /isVideo && !bye && !pip \? h\("div", \{ "data-wk": "callcamera"/, "群视频还是原来那块镜头");
  assert.match(cs, /\(bgUrl \|\| pip\) \? \[\] :/, "单人视频中间那个头像框收起来，人已经铺满了");
});
test("铺满那层在正文底下；小框点一下互换；同一时刻只有一个 <video>", () => {
  assert.match(cs, /"data-wk": "callstage", style: \{ position: "absolute", inset: 0, zIndex: -1/);
  assert.match(cs, /showMeBig \? callMeVideo\(true\) : bgUrl \?/);
  assert.match(cs, /onClick: \(\) => setMeBig\(v => !v\)/);
  assert.match(cs, /showMeBig \? callHimFace\(\) : callMeVideo\(false\)/);
  assert.equal((cs.match(/callMeVideo\(/g) || []).length, 2, "大小各用一处");
  assert.match(cs, /const callMeVideo = big => h\("video", \{ ref: cameraAttach,/);
});
