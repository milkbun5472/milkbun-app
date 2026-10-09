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
  assert.match(app, /K\.slotsOf\(liveChars\.filter\([^\n]*?new Date\(\), c => stFollowed\.some\(x => x\.id === c\.id\) \? null : liveSchedFor\(c\)\)/, "开播提醒也看日程");
  assert.match(app, /liveSched: liveSchedFor/);
  assert.match(live, /slotsOf\(selfOn\.concat\(followedSt\), new Date\(\), c => followedSt\.some\(x => x\.id === c\.id\) \? null : \(props\.liveSched \? props\.liveSched\(c\) : null\)\)/);
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

test("粉丝团名字主播自己起：路人主播生成时顺手起、能重新起名；你的角色第一次开播时起；显示成两套（小数字等级＋展开的粉丝团）", () => {
  assert.match(live, /const normClub = c =>/);
  assert.match(live, /club: normClub\(x\.club\)/, "路人主播生成时顺手起");
  assert.match(live, /const rerollClub = async st =>/);
  assert.match(live, /if \(!ses\.club && !cfg\.stranger\) ses\.needClub = true;/, "你的角色第一次开播时起");
  assert.match(live, /clubs: Object\.assign\(\{\}, c0\.clubs, \{ \[ses\.charId\]: newClub \}\)/);
  assert.match(live, /"data-wk": "livestlv"/);
  assert.match(live, /"data-wk": "livestclub"/);
  const K = kit();
});

test("全屏直播间：顶上浮一条主播信息（不走 Head、安全区走 safeTop），标题单独一行、收起、点开看全", () => {
  assert.match(live, /"data-wk": "livestage", className: "shrink-0", style: \{ position: "relative", zIndex: 2, paddingTop: safeTop\(/);
  assert.match(live, /"data-wk": "livetitle", onClick: \(\) => setTitleOpen/);
});

test("一拍里主播和常客的话按先后排（flow），回谁的弹幕那条就排在前面；模型没写 flow 才退回老排法", () => {
  assert.match(live, /"flow":\[\{"who":"常客网名","text":""\},\{"who":"主播","text":""\}\]/);
  assert.match(live, /你在回谁的弹幕，就把那条弹幕排在你那句前面/);
  assert.match(live, /if \(!flowLines\.length\) flowLines = normLines\(d\.say\)/);
  assert.match(live, /const add = flowLines/);
});

test("画面跟着每一拍：此刻在干嘛每拍换、镜头里的样子变了才换；字幕把这一拍主播的话一句句放，回谁的带在上面", () => {
  assert.match(live, /act: act \|\| s\.act \|\| "", beat: \(s\.beat \|\| 0\) \+ 1,/);
  assert.match(live, /scene: S\(d\.scene\) \? S\(d\.scene\)\.slice\(0, 200\) : s\.scene/);
  assert.match(live, /"data-wk": "liveact"/);
  assert.match(live, /if \(l\.beat !== ses\.beat \|\| l\.kind !== "host"\) return;/);
  assert.match(live, /setTimeout\(function \(\) \{ setCapIdx\(i => i \+ 1\); \}, 2800\)/);
  assert.match(live, /"回 " \+ capNow\.reply\.name/);
});

test("全屏直播间：字幕卡、礼物横幅、弹幕区面板开着时变矮、按钮收进 ⋯ 但自动往下播留在外面；起伏要有来由", () => {
  assert.match(live, /"data-wk": "livecapcard"/);
  assert.match(live, /"data-wk": "livegiftbanner"/);
  assert.match(live, /height: panelOpen \? "18vh" : "30vh"/);
  assert.match(live, /"data-wk": "livemoremenu"/);
  const menu = live.slice(live.indexOf('"data-wk": "livemoremenu"'), live.indexOf('"data-wk": "liveautoslider"'));
  assert.match(menu, /livelinkbtn/);
  assert.match(menu, /liveautobtn/, "自动往下播也收进 ⋯（她 2026-10-08：放外面丑）");
  assert.match(live, /"data-wk": "liveautodot"/, "开着时 ⋯ 上一个小红点");
  assert.match(live, /情绪起伏得有来由/);
});

test("镜头和动作不截行：中间那块自己能滚（她 2026-10-08：看不完全上面的动作）", () => {
  assert.match(live, /"data-wk": "livemid", className: "flex-1 min-h-0 flex flex-col overflow-y-auto"/);
  for (const k of ["livescene", "liveact"]) {
    const i = live.indexOf('"data-wk": "' + k + '"');
    assert.doesNotMatch(live.slice(i, live.indexOf("}", live.indexOf("style: {", i))), /WebkitLineClamp/, k);
  }
});

test("字幕卡自己左右划；一碰就不再自动往下放，下一拍才恢复", () => {
  assert.match(live, /const \[capHand, setCapHand\] = useState\(false\)/);
  assert.match(live, /if \(capHand \|\| capIdx >= caps\.length - 1\) return;/);
  assert.match(live, /setCapIdx\(0\); setCapHand\(false\);/);
  assert.match(live, /"data-wk": "livecapcard", onTouchStart: capDown, onTouchEnd: capUp/);
});

test("错过的那场看昨天那张日程；播什么照日程写的来（她 2026-10-08：为啥都在播吃饭）", () => {
  assert.match(app, /const liveSchedFor = \(char, at\) =>/);
  assert.match(app, /return kind \? \{ start, end, kind \} : \{ start, end \};/);
  const missed = live.slice(live.indexOf("const missed ="), live.indexOf(";\n", live.indexOf("const missed =")));
  assert.match(missed, /props\.liveSched\(c, new Date\(now - 86400000\)\)/);
  assert.doesNotMatch(missed, /, \(\) => null\)/);
});

test("直播间画出来：⋯ 里点了才画，存在这一场上铺成底图", () => {
  assert.match(app, /draw: \(charId, desc\) => drawFromDesc\(/);
  const fn = live.slice(live.indexOf("const drawStage = async"), live.indexOf("const invite = c =>"));
  assert.match(fn, /props\.draw\(/);
  assert.match(fn, /img: ref/);
  assert.match(live, /"data-wk": "livebg"/);
  assert.match(live, /"data-wk": "livedrawbtn"/);
});

test("谁会自己开播一个个选；点掉的人连时间表都不算（直播首页和开播提醒两处）", () => {
  assert.match(live, /const selfOn = characters\.filter\(c => !\(\(cfg\.selfOff \|\| \{\}\)\[c\.id\]\)\)/);
  assert.match(live, /slotsOf\(selfOn\.concat\(followedSt\), new Date\(\),/);
  assert.match(live, /slotsOf\(selfOn\.concat\(followedSt\), new Date\(now - 86400000\)/);
  assert.match(app, /!\(\(liveCfg\.selfOff \|\| \{\}\)\[c\.id\]\)/);
  assert.match(live, /"data-wk": "liveselfchip"/);
});
