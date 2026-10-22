// 群里 2026-10-22：「char 换了我的照片，全被消息挡住了」——查手机的锁屏上，通知从顶上一路排到底，
//   把刚换上去的那张锁屏壁纸整个盖住。换上照片本来就是想看的。
//   做法：有壁纸时通知【贴底排】（真机锁屏就是这样，上半屏留给图），再给一颗能把整摞收起来的；
//   收起来只剩图和钟，底下留一行「N 条消息收着」点回来。没设壁纸的照旧从上往下排，一个像素不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pui = fs.readFileSync(path.join(__dirname, "..", "js/phone-ui.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js/theme-studio.js"), "utf8");
const lock = pui.slice(pui.indexOf("function LockScreen("), pui.indexOf("function WechatNavIcon("));

test("有锁屏壁纸时通知贴底排，上半屏留给那张图", () => {
  assert.match(lock, /style: lockSrc \? \{ display: "flex", flexDirection: "column", justifyContent: "flex-end" \} : null/,
    "通知区没贴底：通知一多就从顶上盖满整张图");
  // 没壁纸的那一档不许跟着变（原样从上往下）
  assert.match(lock, /: null \}/);
});

test("能把整摞消息收起来再点回来；没壁纸时不出现这两颗", () => {
  assert.match(lock, /const \[notifOff, setNotifOff\] = useState\(false\);/);
  assert.match(lock, /lockSrc && notifOff && pool\.length \? h\("button", \{ "data-wk": "phonelocknotifshow"/,
    "收起来以后没有叫回来的入口");
  assert.match(lock, /"⌃ " \+ pool\.length \+ " 条消息收着"/);
  assert.match(lock, /lockSrc && pool\.length \? h\("button", \{ "data-wk": "phonelocknotifhide"/,
    "展开着的时候没有「收起」那一颗");
  assert.match(lock, /"⌄ 收起消息，看这张图"/);
  // 收起来时这一整摞真的不画（不是只藏起来还占着地方）
  assert.match(lock, /lockSrc && notifOff \? null : h\(Fragment, null,/);
  // 挂点要登记，不然美化带不上
  assert.match(ts, /\["phonelocknotifhide", "锁屏上「收起消息，看这张图」"\]/);
  assert.match(ts, /\["phonelocknotifshow", "收起来以后那行「N 条消息收着」"\]/);
});
