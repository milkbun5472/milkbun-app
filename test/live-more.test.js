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

test("礼物栏是一格一样东西、能自定义；充电是电池格、能自己填（不是一排胶囊）", () => {
  const shua = fs.readFileSync(path.join(__dirname, "../js/shua.js"), "utf8");
  assert.match(live, /function GiftPanel\(/);
  assert.match(live, /"自定义"/);
  assert.match(live, /onSaveCustom/);
  const room = live.slice(live.indexOf("function LiveRoom"), live.indexOf("function GiftPanel"));
  assert.doesNotMatch(room, /GIFTS\.map/);
  assert.match(shua, /function ChargePanel\(/);
  assert.doesNotMatch(shua, /"充 ¥" \+ n/);
});

test("TA 自己开播先看日程：日程写了直播就照那个点；排了日程没写直播就不播；没排才按日子掷", () => {
  const K = kit();
  const d = new Date(2026, 9, 8, 12);
  const at10 = new Date(2026, 9, 8, 22, 0).getTime();
  const fromSched = K.slotsOf([{ id: "c_b" }], d, () => [{ start: at10, end: at10 + 3600000 }]);
  assert.equal(fromSched.length, 1);
  assert.equal(fromSched[0].start, at10, "日程写 10 点直播就是 10 点开");
  assert.ok(fromSched[0].fromSchedule);
  assert.deepEqual(K.slotsOf([{ id: "c_b" }, { id: "c_c" }], d, () => []), [], "日程排好了却没写直播：今天不播");
  assert.deepEqual(K.slotsOf([{ id: "c_b" }, { id: "c_c" }], d, () => null), K.slotsOf([{ id: "c_b" }, { id: "c_c" }], d), "没排日程才按日子掷");
  // v75.080 起关注的路人主播也一起算（他们没有日程，走按日子掷），角色照旧先看日程
  assert.match(app, /K\.slotsOf\(liveChars\.filter\(c => c && !c\.npc\)\.concat\(stFollowed\), new Date\(\), c => stFollowed\.some\(x => x\.id === c\.id\) \? null : liveSchedFor\(c\)\)/, "开播提醒也看日程");
  assert.match(app, /liveSched: liveSchedFor/);
  assert.match(live, /slotsOf\(characters\.concat\(followedSt\), new Date\(\), c => followedSt\.some\(x => x\.id === c\.id\) \? null : \(props\.liveSched \? props\.liveSched\(c\) : null\)\)/);
});

test("直播输入框空着按＝接着看／接着播，不用非得发弹幕才往下走", () => {
  assert.match(live, /const send = \(\) => \{ const v = text\.trim\(\); if \(busy\) return;/);
  assert.match(live, /"接着看" : "接着播"/);
  assert.match(live, /if \(!v\) \{ if \(s\.mode === "watch"\) stepWatch\(curId, false\); else stepHost\(curId, false\); return; \}/);
});

test("自动往下播：默认关、不记住，开着才自己走下一拍，后台和下播不走", () => {
  assert.match(live, /const \[auto, setAuto\] = useState\(false\);/);
  assert.match(live, /if \(!auto \|\| busy \|\| readOnly \|\| ses\.endTs\) return;/);
  assert.match(live, /document\.hidden\) return; onSay\(""\)/);
});

test("自动往下播的间隔：平时只露一个「N 秒」，点了才出拉条，10~120 秒，记在 x_liveCfg", () => {
  assert.match(live, /auto && slider \? h\("div", \{ "data-wk": "liveautoslider"/);
  assert.match(live, /type: "range", min: 10, max: 120, step: 5/);
  assert.match(live, /autoSec: \(props\.liveCfg \|\| \{\}\)\.autoSec \|\| 25/);
  assert.match(live, /const AUTO_MS = autoSec \* 1000;/);
});

test("日程里只认 TA 自己播，看别人直播不算开播", () => {
  const src = app.match(/const selfLive = t => [^\n]+\n[^\n]+/)[0].replace(/^const selfLive = /, "").replace(/;\s*$/, "");
  const selfLive = new Function("return (" + src + ")")();
  ["开直播陪粉丝聊天", "直播带货", "晚上开播", "上直播打游戏"].forEach(t => assert.ok(selfLive(t), t));
  ["刷手机看直播", "窝在沙发看球赛直播", "在直播间里蹲人", "陪妹妹看直播", "睡前刷会儿直播"].forEach(t => assert.ok(!selfLive(t), t));
});

test("路人主播：一次刷一批、关注上限 20、交情大号马甲分开、门槛跟人设走、加好友拒了三天或升一级", () => {
  const K = kit();
  assert.match(live, /const ST_FOLLOW_MAX = 20, ST_BATCH = 6;/);
  assert.match(live, /const tieKeyOf = \(as, maskName\) => as === "mask" \? "mask:"/);
  // 统一门槛（她 2026-10-08）：4 级私信、7 级加好友；等级＝来一场 30 经验＋一块钱 1 经验；答不答应看他在乎什么
  assert.match(live, /const ST_DM_LV = 4, ST_FRIEND_LV = 7;/);
  assert.match(live, /const stExp = \(visits, total\) => \(Number\(visits\) \|\| 0\) \* 30 \+ \(Number\(total\) \|\| 0\);/);
  assert.match(live, /VALUES_ZH\[st\.values\]/);
  assert.match(live, /Date\.now\(\) - prev\.ts < 3 \* 86400000 && myLv <= \(prev\.lv \|\| 0\)/);
  assert.match(live, /判据：把他的人设拿掉名字，换个主播还成立，就是写坏了/);
  assert.match(live, /if \(props\.charPay && s\.charId && !s\.stranger\)/, "打赏路人主播不进任何角色钱包");
  assert.match(app, /promoteStranger: \(st, key, nm, fan\) =>/);
  assert.match(app, /createCharFromAssistant\(\{ name: st\.name/);
});
