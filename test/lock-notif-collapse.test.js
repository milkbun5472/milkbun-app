// 群里 2026-10-22：「char 换了我的照片，全被消息挡住了」——查手机的锁屏上，通知从顶上一路排到底，
//   把刚换上去的那张锁屏壁纸整个盖住。换上照片本来就是想看的。
//   做法：有壁纸时通知【贴底排】（真机锁屏就是这样，上半屏留给图）。没设壁纸的照旧从上往下排，一个像素不动。
//   「不想再看这几条」那一半归通知上面那颗「× 清除」（同一轮另一处做的，永久划掉）——
//   同一件事只留一套，别再加第二颗收起键（施工规则/one-public-mechanism.md）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pui = fs.readFileSync(path.join(__dirname, "..", "js/phone-ui.js"), "utf8");
const lock = pui.slice(pui.indexOf("function LockScreen("), pui.indexOf("function WechatNavIcon("));

test("有锁屏壁纸时通知贴底排，上半屏留给那张图", () => {
  assert.match(lock, /style: lockSrc \? \{ display: "flex", flexDirection: "column", justifyContent: "flex-end" \} : null/,
    "通知区没贴底：通知一多就从顶上盖满整张图");
});

test("嫌挡还能一键清掉；收起/叫回来不许再做第二套", () => {
  assert.match(lock, /"data-wk": "phonelockclear", onClick: \(\) => clearAll\(list\.map\(r => r\.id\)\)/);
  assert.doesNotMatch(lock, /notifOff/, "又加了一套收起键：清除那一颗已经管这件事了");
});
