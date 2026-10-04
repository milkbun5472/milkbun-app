const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("js/app.js"), comp = read("js/components.js");
// 忙的时候晚点回（v74.713）：群里肉肉肉酱意面提、她 2026-10-04 拍板——本地掷骰子、不调模型；默认关；通话同一类
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

test("日程每段多一个 busy（排日程时顺手要，不多一枪），落库收成 0-3 的整数", () => {
  assert.match(app, /\\"busy\\":\\"这一段他顾不顾得上看手机：0 随时能看／1 偶尔瞄一眼／2 基本顾不上／3 完全碰不了（整数）\\"/);
  assert.match(app, /busy: Math\.max\(0, Math\.min\(3, Math\.round\(Number\(s\.busy\) \|\| 0\)\)\)/);
});

test("闸：默认关、只管主线单聊、正聊着不拦、一段只掷一次、中了不调模型", () => {
  const g = cut(app, "const busyGate = (char, chatKey) => {", "const busyRelease = cid =>");
  assert.match(g, /settingsFor\(char\.id\)\.busyHold !== true\) return null/, "没开就放行");
  assert.match(g, /if \(chatKey && chatKey !== char\.id\) return null/);
  assert.match(g, /BUSY_GAP_MIN \* 60000\) return null/);
  assert.match(g, /h0\.segKey === b\.segKey\) return null/);
  assert.match(g, /Math\.random\(\) < \(b\.odds != null \? b\.odds : BUSY_ODDS\[b\.level\]\)/);
  assert.doesNotMatch(g, /replyNow|runProbe|callAI/, "掷骰子这一步一分钱不花");
  assert.match(comp, /const \[busyHold, setBusyHold\] = useState\(settings\.busyHold === true\)/, "开关默认关");
  assert.match(comp, /busyHold: busyHold,/);
});

test("让TA回复：拦下就只落她的话；再按一次就当场回；忙完由主动那一路回一次", () => {
  const r = cut(app, "const bg = busyGate(activeChar, chatKey);", "return replyNow(activeChar.id, extraText, null, { room, chatKey });");
  assert.match(r, /if \(bg && bg\.held\) \{[\s\S]*pushUser\(activeChar\.id, extra, chatKey\);[\s\S]*return;/);
  assert.match(r, /busyNudge: \{ title: bg\.nudge\.title, sleep: !!bg\.nudge\.sleep \}/);
  assert.match(app, /replyNow\(cid, "", null, \{ busyBack: \{ title: h0\.title, sleep: !!h0\.sleep \} \}\)/);
  assert.match(app, /paceHint \+ callHint \+ busyHint \+ proactiveHintAll/);
  // busyHint 读 uName，必须在 uName 声明之后（TDZ）
  assert.ok(app.indexOf("const busyHint = opts.busyBack") > app.indexOf("const uName = userName(profile); // 须在下面"));
});

test("通话跟线上一类：打不通落未接卡，拨号键和回拨都过同一道闸", () => {
  const c = cut(app, "const callCharGated = (activeChar, m) => {", "const busyRelease = cid =>");
  assert.match(c, /answered: "missed", busyMissed: bg\.held\.title/);
  assert.match(app, /onStartCall: m => callCharGated\(activeChar, m\),/);
  assert.match(app, /onCallBack: m => callCharGated\(activeChar, m\.mode\),/);
  assert.match(comp, /m\.busyMissed \? "无法接通 · " \+ \(who \|\| "TA"\) \+ "在忙（" \+ m\.busyMissed \+ "）"/);
});

test("提示词里不说「催」：只说你还在忙、抽空看了一眼（不然开口就是催什么催）", () => {
  const i = app.indexOf("const busyHint = opts.busyBack"), j = app.indexOf("const bdayHint = opts.bday", i);
  assert.ok(i > 0 && j > i);
  assert.doesNotMatch(app.slice(i, j).replace(/\/\/.*$/gm, ""), /催/);
  assert.match(app.slice(i, j), /这会儿抽空看了一眼手机/);
});

test("忙完那一回：回成了才算数，关 App、断网、被截断下次还会来；忙完后她自己按就当TA看到了", () => {
  assert.match(app, /pOnce\("busy:" \+ cid, "busy:" \+ cid \+ ":" \+ h0\.at,\s*\(\) => replyNow\(cid, "", null, \{ busyBack: \{ title: h0\.title, sleep: !!h0\.sleep \} \}\),\s*\(\) => busyRelease\(cid\)\);/);
  assert.match(app, /Date\.now\(\) >= \(h0\.until \|\| 0\) \? \{ back: h0 \} : \{ nudge: h0 \}/);
  assert.match(app, /busyBack: \{ title: bg\.back\.title, sleep: !!bg\.back\.sleep \}/);
  assert.match(app, /x_busyHold/, "拦下来的那笔落盘，关了 App 也记得");
});

// 她 2026-10-05：「睡觉的时候让他不回复其实一次都没触发……挂到忙碌晚点回那里」
test("睡着也走晚点回那一条：拦下就等到醒，醒了回一句；被叫醒有自己的说法", () => {
  assert.match(app, /const sleepHoldFor = char => \{\n\s+if \(sleepPhaseOf\(char\) !== "asleep"\) return null;/);
  assert.match(app, /const zz = sleepHoldFor\(char\);\n\s+if \(zz\) return zz;/, "busyNowFor 没先问睡没睡");
  assert.match(app, /opts\.busyBack && opts\.busyBack\.sleep \? /);
  assert.match(app, /opts\.busyNudge && opts\.busyNudge\.sleep \? /);
});
// 群↔私聊说一嘴：掷的是给谁开门，不是替他说
test("群里私下说一嘴、私聊去群里说一嘴，都有本地骰子开门", () => {
  assert.match(app, /const gDmPick = gDmMembers\.length && Math\.random\(\) < GDM_ODDS \?/);
  assert.match(app, /Math\.random\(\) < TOGROUP_ODDS && _gLast\(toGroupTarget\)/);
});
