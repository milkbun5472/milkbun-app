// 她 2026-09-10 留下的四条里的后两条（⑧⑩），两条都是她当场拍的调子：
//  ⑧「只敲过才写」——她安安静静看完＝他真的不知道，上下文里一个字不留。
//    这个玩法成立的地方就是「他以为没人在看」，看一次就往他脑子里塞一句等于把它拆了。
//  ⑩「冷却关着，提示照做」——所以节奏全靠提示自己兜，不能靠冷却帮忙挡。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), phone = R("js/phone.js"), rooms = R("js/chat-rooms.js");
const W = require("../js/phone-watch.js");
const DAY = 86400000;

test("⑧ 没敲过就一个字都不发", () => {
  const now = Date.now();
  assert.equal(W.knockedToday([], now), 0);
  assert.equal(W.watchedNote(0, "小美"), "", "没敲过还发了一段——那就等于把「他不知道」拆了");
  assert.match(app, /\? window\.PhoneWatch\.watchedNote\(\s*\n\s*window\.PhoneWatch\.knockedToday\(\(knockLogRef\.current \|\| \{\}\)\[char\.id\], Date\.now\(\)\),/);
  // 空串在 engine 那头也要被挡住，别推一段空的进 parts
  assert.match(eng, /if \(!ctx\.notRoleplay && ctx\.watchedNote && ctx\.watchedNote\.trim\(\)\) parts\.push\(ctx\.watchedNote\.trim\(\)\);/);
});

test("⑧ 当天为界：昨天敲的今天不算", () => {
  const now = Date.now();
  assert.equal(W.knockedToday([now, now - 1000], now), 2);
  assert.equal(W.knockedToday([now - 2 * DAY], now), 0, "隔天还挂着就成了常驻层");
  assert.equal(W.knockedToday([now + 5 * DAY], now), 0, "未来的时间戳也算数了");
  assert.match(W.watchedNote(2, "小美"), /敲了你 2 下屏幕/);
  // 别让他把手机上做过什么复述一遍——她看见多少是她的事
  assert.match(W.watchedNote(1, "小美"), /别复述你在手机上做过什么/);
});

test("⑧ ctxFor 每一栏都得在房间那张白名单里登记（漏登记＝隔离房悄悄漏出去）", () => {
  assert.match(rooms, /"dreamEcho", "watchedNote"\]/, "watchedNote 没登记——room-ctx-gate 会红");
  // 归在「这间房外面发生的事」那一档：跟朋友圈回声同一个道理
  const i = rooms.indexOf("otherScenes: [");
  assert.ok(i > 0 && rooms.slice(i, i + 200).indexOf("watchedNote") > 0, "登记到别的组里去了");
  // ⚠️ctxFor 会在异步回调里被调到，直接闭包读 state 会读到旧的
  assert.match(app, /const knockLogRef = useRef\(knockLog\); knockLogRef\.current = knockLog;/, "读的是旧的 knockLog，刚敲完就说话那一行会漏");
  // 言秋不发（跟 gazeText 同一条判据）
  assert.match(app, /\(window\.PhoneWatch && !settingsFor\(char\.id\)\.engineerEyes\)/);
});

test("⑩ 冷却关着，所以节奏得由提示自己兜", () => {
  assert.equal(W.WATCH_COOLDOWN_OFF, true, "冷却开回来了，那 ⑩ 这套节奏要重新想");
  const now = Date.now(), day = new Date(now).toDateString();
  // ① 他得醒着：凌晨 1~8 点一律不提（深夜那一小时留着——深夜台就是那会儿刷的）
  [1, 3, 5, 8].forEach(h => assert.equal(W.watchHintOn("c", h * 60, {}, now), false, h + " 点还在提"));
  // ② 一天最多两次
  // ⚠️得先找一个【种子说亮】的小时来验，不然拿一个本来就不亮的小时去证「额度挡住了」，
  //   把闸整个删掉这条断言照样绿——那就是一条喂假的断言。
  assert.equal(W.HINT_PER_DAY, 2);
  let onH = -1;
  for (let h = 9; h < 24 && onH < 0; h++) if (W.watchHintOn("c", h * 60, {}, now)) onH = h;
  assert.ok(onH >= 0, "这个角色今天一小时都不亮，这条验不了（换个种子）");
  assert.equal(W.watchHintOn("c", onH * 60, { day: day, n: 2, hour: 0 }, now), false, "今天提够了还在提");
  // ③ 同一个小时不重复
  assert.equal(W.watchHintOn("c", onH * 60, { day: day, n: 1, hour: onH }, now), false, "同一小时里催两遍");
  // 隔天额度自己回来
  const used = W.watchHintUsed({ day: "别的一天", n: 2, hour: 9 }, 14 * 60, now);
  assert.deepEqual(used, { day: day, n: 1, hour: 14 }, "换一天没归零");
});

test("⑩ 同一小时里稳定地开或不开，不许闪来闪去", () => {
  const now = Date.now();
  // ⚠️Math.random 的话这颗点会随着每次重渲染换一次——那不叫提示，叫抽搐
  const a = W.watchHintOn("c1", 15 * 60 + 3, {}, now);
  for (let i = 0; i < 20; i++) assert.equal(W.watchHintOn("c1", 15 * 60 + 40, {}, now), a, "同一小时里答案变了");
  assert.ok(!/Math\.random/.test(R("js/phone-watch.js").slice(
    R("js/phone-watch.js").indexOf("function hintSeed"),
    R("js/phone-watch.js").indexOf("function watchHintUsed"))), "种子里混进了 Math.random");
  // 不同角色不该整天同时亮
  const hrs = c => { const o = []; for (let h = 9; h < 24; h++) if (W.watchHintOn(c, h * 60, {}, now)) o.push(h); return o.join(","); };
  assert.notEqual(hrs("c1"), hrs("c2"), "两个人的提示时段一模一样");
});

test("⑩ 那颗点只是呼吸一下，而且只在她真点进去时才算用掉一次", () => {
  // 不另加红点、不多一行字：本来就有的那颗绿点动一下
  assert.match(phone, /animation: \(watchHintOn && !watchCoolLeft && !watchBusy\) \? "wkbreathe 2\.4s ease-in-out infinite" : undefined/);
  assert.match(R("index.html"), /@keyframes wkbreathe/, "动画没定义，那颗点不会动");
  assert.match(phone, /watchHintOn \? T\("他在手机上"\) : T\("看他玩"\)/, "看不出此刻是「他正在玩」还是平时");
  // ⚠️只在她真点进来时记：路过看见那颗点不算，否则她压根没看，今天两次就白没了
  const gen = app.slice(app.indexOf("const genWatchSession = async"), app.indexOf("const watchSend ="));
  assert.match(gen, /setWatchHint\(hv => \{/, "点进去没记掉这一次");
  assert.ok(app.indexOf("setWatchHint(hv =>") > app.indexOf("const genWatchSession = async"), "记在了别处（比如一渲染就记）");
  assert.match(app, /watchHintOn: \(\(\) => \{/, "算出来了没往下传");
});
