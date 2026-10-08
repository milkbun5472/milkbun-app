// 直播加料（她 2026-10-08）：TA 自己开播（本地算）、连麦、粉丝团、突发、房管、PK、带货买同款、切片、点歌、平台抽成
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const live = fs.readFileSync(path.join(__dirname, "../js/live.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

function kit() {
  const win = {};
  const fn = new Function("window", "h", "Svg", "useState", "useEffect", "useRef", "loadJSON", "saveJSON", live + "\nreturn window.LiveKit;");
  return fn(win, () => null, () => null, () => [null, () => {}], () => {}, () => ({}), () => [], () => {});
}

test("开播时间表本地算：同一天同一人永远同一个结果，晚上七点到十一点之间开", () => {
  const K = kit();
  const chars = Array.from({ length: 60 }, (_, i) => ({ id: "c" + i }));
  const d = new Date(2026, 9, 8, 12);
  const a = K.slotsOf(chars, d), b = K.slotsOf(chars, d);
  assert.deepEqual(a, b);
  assert.ok(a.length > 0 && a.length < 30, "大概五天一回，不是天天播");
  a.forEach(x => { const h0 = new Date(x.start).getHours(); assert.ok(h0 >= 19 && h0 <= 22); assert.ok(x.end > x.start); });
});

test("粉丝团按累计打赏的钱分级", () => {
  const K = kit();
  assert.equal(K.fanLevel(0), 0);
  assert.equal(K.fanLevel(1), 1);
  assert.equal(K.fanLevel(520), 4);
  assert.ok(K.fanLevel(99999) >= 9);
});

test("平台抽成：直播主播到手一半，送的人全额出", () => {
  assert.match(live, /const LIVE_CUT = 0\.5;/);
  assert.match(live, /props\.charPay\(s\.charId, toHost\(amount\)/, "看 TA 播时她打赏，TA 只拿一半");
  assert.match(live, /props\.pay\(toHost\(g\.amount\)/, "她开播收礼，她只拿一半");
  assert.match(live, /props\.charPay\(gc\.id, -g\.amount/, "送礼的人全额出");
});

test("不看就不调用：提醒只看时间表；进去才开始生成", () => {
  const eff = app.slice(app.indexOf("TA 自己开播的提醒"), app.indexOf("}, [liveCfg.selfLive, liveChars.length]);"));
  assert.ok(eff.length > 50);
  assert.doesNotMatch(eff, /callAI|runProbe|probeAs/);
  assert.ok(app.indexOf("TA 自己开播的提醒") > app.indexOf("const liveChars = characters.filter"), "用到 liveChars 必须写在它后面");
});

test("连麦、房管、PK、带货、点歌、突发都只是往下一拍里添事实", () => {
  assert.match(live, /if \(ses\.linkAsk && !ses\.linked\)|ses\.linkAsk && !ses\.linked/);
  assert.match(live, /const watchShape = \(ses, first\)/);
  assert.match(live, /EVENT_P/);
  assert.match(live, /props\.onClip\(/);
  assert.match(app, /buy: \(item, host\) =>/);
  assert.match(app, /songs: \(\) =>/);
});

test("攻略文件本身能被解析（多行字符串写成真换行会让整份攻略读不出来）", () => {
  const src = fs.readFileSync(path.join(__dirname, "../js/assistant-manual.js"), "utf8");
  assert.doesNotThrow(() => new Function(src));
});
