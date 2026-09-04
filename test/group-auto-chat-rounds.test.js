const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
// 动念的键（角色@群）从真代码里抠出来：桩里再写一份的话，
// 哪天键格式改了，这个测试会拿旧格式自己跟自己对上，永远绿。
const dongnianKey = (() => {
  const m = /const dongnianKey = (\(charId, gid\) => [^;]+);/.exec(app);
  assert.ok(m, "app.js 里没有 dongnianKey——动念不分场了？回去看 v62.12");
  return new Function("return " + m[1])();
})();
const scan = (() => {
  const i = app.indexOf("const scanAutoGroups = () => {");
  assert.ok(i > 0, "群自发巡检没了");
  return app.slice(i, app.indexOf("\n    };", i));
})();

// 她 2026-08-27：「群自发聊天他们主动发了一轮就不继续了，都没到设定的最大轮数或者次数」
// 病因是【每一轮】都要求有人此刻正想找她。认领动念的同时会给本人记 25 分钟冷却、
// 还泄掉 0.28 的 connection；自发间隔默认才 8 分钟——第二轮永远等不到人。

// —— 把真的那段巡检抠出来跑，别拿模型推理代替测量 ——
// 环境全是桩：群、设置、成员、额度卡、replyGroup 只记账不发请求。
function drive(opts) {
  const { minutes, rounds, maxMsg, perRound = 5, dongnian = false, rand = 0.5, hours = 2, kicked = false, urge = true, autoChat = true, holdAfter = 0, resumeAfterMin = 0 } = opts || {};
  const src = (() => {
    const i = app.indexOf("const scanAutoGroups = () => {");
    return app.slice(i, app.indexOf("\n    };", i) + 6);
  })();
  const G = "g1";
  const T0 = Date.UTC(2026, 7, 27, 2, 0, 0);   // 真实时间轴，别从 0 起（会假装每个人的认领冷却都没过）
  let NOW = T0;
  const store = {}, calls = [];
  const gs = { memoryInterop: true, autoChat: autoChat, autoChatMin: minutes, autoChatRounds: rounds, autoChatMaxMsg: maxMsg, autoChatResetHours: 24 };
  const chat = [{ role: "user", ts: T0 }];      // 她先说了一句 → 开一张新额度卡
  const goff = opts.groupOffline || [];        // 这个群有没有一场【还在进行】的线下（v58.80）
  const env = {
    groups: [{ id: G, memberIds: ["c1", "c2"] }],
    characters: [{ id: "c1", name: "顾朝" }, { id: "c2", name: "顾暮" }],
    gsFor: () => gs,
    laneBusy: () => false,
    offlineGroup: null,
    contextAllowsMessage: () => true,
    groupChatsRef: { current: { [G]: chat } },
    groupOfflinesRef: { current: { [G]: goff } },
    loadJSON: (k, d) => d,
    InteractionClock: require("../js/interaction-clock.js"),
    dongnianFiredRef: { current: {} },
    getDongnian: () => ({ applyDelta() {} }),
    autoChatCycleRef: { current: store },
    autoChatRoundsRef: { current: {} },
    autoChatMsgsRef: { current: {} },
    writeAutoChatCycle: (gid, c) => (store[gid] = c),
    resetAutoChatCycle: (gid, ts, k) => (store[gid] = { rounds: 0, msgs: 0, cappedAt: 0, resetAt: 0, kicked: !!k, lastUserTs: Number(ts) || 0 }),
    replyGroup: (gid, o) => calls.push({ at: NOW, ...o }),
    AUTO_FIRST_ROUND_GRACE: 3,   // 她刚开过口那一段，第一轮要多等的倍数（v56.79）
    Math: Object.assign(Object.create(Math), { random: () => rand }),
    // ⚠️不能只桩一个 now：巡检里要 new Date(now).toDateString() 算「今天」
    //   （每天最多借几次那道闸）。只给 now 的话是 "Date is not a constructor"。
    Date: (() => {
      const RealDate = Date;
      const F = function (...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); };
      F.now = () => NOW;
      return F;
    })(),
    // v62.12：动念按【场】分，巡检读的是【这个群】那一份（键 = 角色@群）。
    // 键的算法不在这儿抄一份——从真代码里抠出来用，否则改了格式这个桩照样绿。
    dongnianKey: dongnianKey,
    window: { __dongnian: dongnian ? { [dongnianKey("c1", G)]: { triggers: urge ? [{ action: "contact" }] : [] }, [dongnianKey("c2", G)]: { triggers: [] } } : {},
      InteractionClock: require("../js/interaction-clock.js") }
  };
  const scan = new Function(...Object.keys(env), src + "\nreturn scanAutoGroups;")(...Object.values(env));
  // 黑色回复键那一下：replyGroup 里 !rgOpts.auto 走的就是这几句
  //（那一轮不记轮数、不吃条数额度；lastUserTs 一起记上，免得下一拍被当成新消息再 reset）
  if (kicked) {
    let lastU = 0;
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i].role === "user") { lastU = chat[i].ts; break; }
    env.resetAutoChatCycle(G, lastU, true);
  }
  for (let t = 0; t < hours * 3600000; t += 20000) {
    NOW = T0 + t;
    const before = calls.length;
    scan();
    // 中途翻成白色（等我接话）：她在第 holdAfter 轮之后按了那颗圆点
    if (holdAfter && calls.length >= holdAfter) gs.autoChat = false;
    // 过一阵再翻回黑色
    if (resumeAfterMin && (NOW - T0) / 60000 >= resumeAfterMin) gs.autoChat = true;
    if (calls.length > before) {                 // 这一轮真的发了几条，额度卡照实扣
      for (let k = 0; k < perRound; k++) chat.push({ role: "assistant", ts: NOW + k * 700 });
      NOW += perRound * 700;
      const old = store[G] || {};
      store[G] = { ...old, msgs: (old.msgs || 0) + perRound };
    }
  }
  const out = calls.map(c => ({ minute: (c.at - T0) / 60000, budget: c.msgBudget }));
  out.card = store[G] || {};   // 跑完之后那张额度卡长什么样（借了几次、冷却还在不在）
  return out;
}

test("拿她的设置真跑一遍：5 轮一轮不少", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50 });
  assert.equal(got.length, 5, "轮数上限 5，实际只发了 " + got.length + " 轮");
  assert.deepEqual(got.map(x => x.budget), [50, 45, 40, 35, 30], "剩余条数预算要一轮轮递减");
});

test("有 dongnian 的群也一样跑满——动念只管起聊那一下", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true });
  assert.deepEqual(got.slice(0, 5).map(x => x.budget), [50, 45, 40, 35, 30],
    "正经那 5 轮要一轮不少、预算照旧递减");
  // 第 6 轮起是 v62.13 的【冷却期借几轮】。默认跑 2 小时，两次借之间要隔 3 小时，
  // 所以这一趟只借得到一次：5 + 4 = 9。（一天的上限 13 在下面那条单独量。）
  assert.equal(got.length, 9, "借的节奏变了？实际 " + got.length + " 轮");
});

test("总条数上限先到就先停", () => {
  const got = drive({ minutes: 3, rounds: 20, maxMsg: 20, perRound: 5 });
  assert.equal(got.length, 4, "20 条 ÷ 每轮 5 条 = 4 轮");
});

// 她掐着表：「过了三分钟没有」。以前抖动是 1~1.5×，设 3 分钟实际 3~4.5、平均 3.75，
// 每一次都比她看到的数字晚。现在绕着那个数走，她设的数字是平均值。
test("设 3 分钟就该是 3 分钟上下，不是一律往后拖", () => {
  const early = drive({ minutes: 3, rounds: 5, maxMsg: 50, rand: 0 });   // 抖动最快那一头
  const late = drive({ minutes: 3, rounds: 5, maxMsg: 50, rand: 0.999 }); // 最慢那一头
  const step = a => a[1].minute - a[0].minute;
  assert.ok(step(early) < 3, "最快那一头该比 3 分钟早，实际 " + step(early));
  assert.ok(step(late) < 4, "最慢那一头也不该超过 4 分钟，实际 " + step(late));
});

test("动念只管起聊那一下，后面几轮不再要新的思念", () => {
  const i = scan.indexOf("let urgeChars = [];");
  assert.ok(i > 0, "urgeChars 的声明变了");
  const gate = scan.indexOf('if ((rounds === 0 && !cycle.kicked) || borrowing === "maybe") {', i);
  assert.ok(gate > i, "没有把动念这道门收进【第一轮 或 起借】里");
  const seg = scan.slice(gate, gate + 1300);
  assert.match(seg, /if \(!urgeChars\.length && \(borrowing === "maybe" \|\| anyDongnian\)\) continue;/,
    "起聊仍要有人真想找她；起借更严——一个动念引擎都没有时也不许借");
  assert.match(seg, /dongnianFiredRef\.current\[c\.id\] = now;/, "认领冷却要留在门里面");
  assert.match(seg, /applyDelta\(\{ connection: -0\.28 \}\)/, "泄思念也要留在门里面");
});

test("刹车还在：轮数上限、总条数上限、闲置间隔一个都不许少", () => {
  assert.match(scan, /const roundCap = Math\.max\(1, gs\.autoChatRounds \|\| 5\)/, "轮数上限没了");
  assert.match(scan, /const totalCap = Math\.max\(1, gs\.autoChatMaxMsg \|\| 50\)/, "总条数上限没了");
  assert.match(scan, /const capped = rounds >= roundCap \|\| msgsSoFar >= totalCap;/, "到顶不歇了");
  assert.match(scan, /if \(now - \(last\.ts \|\| 0\) < gap\) continue;/, "闲置间隔没了");
  // 上限判断必须排在动念那道门【之前】：先看额度够不够，再看有没有人想说话
  assert.ok(scan.indexOf("const capped = rounds >= roundCap") < scan.indexOf("let urgeChars = [];"), "顺序反了");
});

test("每一轮照旧记账，额度卡跨重开仍然有效", () => {
  assert.match(scan, /rounds: rounds \+ 1/, "轮数不加了");
  assert.match(app, /if \(rgOpts\.auto\) addAutoChatMessages\(groupId, safeArr\.length\)/, "条数不记了");
  assert.match(scan, /replyGroup\(gid, \{ auto: true, msgBudget: totalCap - msgsSoFar/, "剩余预算没往下传");
});

test("没配 dongnian 的群照旧纯闲置触发，一个字没变", () => {
  const gate = scan.indexOf('if ((rounds === 0 && !cycle.kicked) || borrowing === "maybe") {');
  assert.ok(gate > 0, "动念那道门的写法变了");
  const seg = scan.slice(gate, gate + 1300);
  assert.match(seg, /let anyDongnian = false;/, "没 dongnian 的群该直接放行");
});

// 她 2026-08-27：「就是要按黑键之后无视 dongnian」——她已经明说了要他们聊，
// 别再让「此刻有没有人想我」这道门拦着自发链条接上。
test("按过黑键的那一段，第一轮不等谁动念", () => {
  const cold = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, urge: false });
  assert.equal(cold.length, 0, "没人动念、也没按黑键 → 本来就不该起聊");
  const kicked = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, urge: false, kicked: true });
  assert.equal(kicked.length, 5, "按过黑键就该一路接满 5 轮，实际 " + kicked.length + " 轮");
});

test("她自己发言开的那张卡不带这个标记——正常说话，起聊照旧由人格驱动", () => {
  const src = app.slice(app.indexOf("const scanAutoGroups = () => {"));
  assert.match(src, /resetAutoChatCycle\(gid, last\.ts\);/, "用户消息那一路不许传 kicked");
  assert.match(app, /resetAutoChatCycle\(groupId, _lastUserTs, true\);/, "黑键那一路要传 kicked");
});

test("kicked 只管这一段的第一轮，发过就消掉", () => {
  const src = app.slice(app.indexOf("const scanAutoGroups = () => {"));
  assert.match(src, /rounds: rounds \+ 1, msgs: msgsSoFar, cappedAt: 0, resetAt: 0, kicked: false/,
    "起聊之后要把标记清掉，别跨过下一次额度刷新还赖着");
  assert.match(src, /if \(\(rounds === 0 && !cycle\.kicked\) \|\| borrowing === "maybe"\)/, "动念那道门要认这个标记");
});

// 上面那条差点漏掉：黑键 reset 时不记 lastUserTs，下一拍巡检就会把她那句话
// 当成没处理过的新消息、再 reset 一次，顺手把 kicked 抹掉——按了等于没按。
test("黑键那一下要把她最后那句话的时间一起记上", () => {
  const i = app.indexOf("if (!rgOpts.auto) {");
  assert.ok(i > 0, "黑键那一路的写法变了");
  const seg = app.slice(i, i + 600);
  assert.match(seg, /m\.role === "user"/, "得回头找她最后那句话");
  assert.match(seg, /resetAutoChatCycle\(groupId, _lastUserTs, true\)/, "找到的时间要传进去");
});

// 「有时候只是我还没来得及接话」原本是靠猜的（第一轮多等三倍）。v56.80 改成她自己说了算：
// 顶栏那颗圆点白＝等我接话，群设置里的 autoChat 直接关掉，巡检压根不碰这个群。
// 所以这里只要证明【关掉就一轮都不发】，不再有需要调的宽限倍数。
test("关掉自发就一轮都不发——白色那一档是真的停", () => {
  const off = drive({ minutes: 3, rounds: 5, maxMsg: 50, autoChat: false });
  assert.equal(off.length, 0, "关掉了还发了 " + off.length + " 轮");
});

test("那颗圆点翻的就是群设置里的 autoChat，不另立一个会打架的状态", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(comp, /const gHold = gs\.autoChat === false;/, "白/黑读的就是 autoChat");
  assert.match(comp, /onSaveSettings\(\{ autoChat: gHold \}\)/, "点一下就翻它");
  // 状态要看得见：底下那颗按钮跟着变色，顶栏副标题也写一句
  // ⚠️冻的是【这一档在按钮上看得见，而且不是只差个颜色】，不是它用哪个属性表达：
  //   v60.68 那颗键是一片枫叶，两档画成叶子的【空心／实心】；
  //   v60.99 换成言秋在秋声那片叶子（她：「直接偷他那片过来」），整片本来就是描线的，
  //   于是两档改画成【实线／虚线】——「虚实」在这儿仍旧是字面意思。
  assert.match(comp, /hold: !!gHold/, "这一档没传给底下那颗键");
  assert.match(comp, /dash: hold === true/,
    "两档要在键上看得出来，而且不能只差一个颜色");
  assert.match(comp, /gHold \? " · 等我接话" : ""/, "顶栏没写出当前是哪一档");
});

test("巡检那边照旧认这个开关，一个字没改", () => {
  assert.match(scan, /if \(!gs\.memoryInterop \|\| gs\.autoChat === false\) continue;/);
});

// 她 2026-08-27 问：「我原来开了他们 5 轮，他们聊到第三轮我换成白色，能把后面俩停了吗」
test("聊到第三轮换成白色，后面两轮真的停得住", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, holdAfter: 3 });
  assert.equal(got.length, 3, "该停在第 3 轮，实际发了 " + got.length + " 轮");
});

test("再翻回黑色，接着把剩下那两轮聊完（额度卡没被清掉）", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, holdAfter: 3, resumeAfterMin: 40, hours: 3 });
  assert.equal(got.length, 5, "翻回来该接着聊满 5 轮，实际 " + got.length + " 轮");
  assert.ok(got[3].minute > 40, "第 4 轮该发生在翻回来之后，实际 " + got[3].minute + " 分");
});

// ── 她 2026-08-31：「我和顾朝顾暮在群线下，然后他们同一个群线上又在继续聊
//    和线下发生的无关的东西」──────────────────────────────────────────────
// 病因不是提示词（replyGroup 早有「你们此刻正在一场群线下」那一段，也真拼进了
// system），是守卫盯错了东西：它盯【线下浮层开着】，可下拉「回线上群」只是
// setOfflineGroup(null) 收浮层，那一场并没有结束——浮层一收，自发聊立刻放行。
const T0 = Date.UTC(2026, 7, 27, 2, 0, 0);
test("群线下还在演，同一个群的线上一句都不许自发（哪怕浮层已经收起来了）", () => {
  const live = drive({ minutes: 8, rounds: 5, maxMsg: 50, hours: 2,
    groupOffline: [{ id: "s1", startTs: T0 - 600000, msgs: [{ role: "user", ts: T0 - 600000 }] }] });
  assert.equal(live.length, 0, "人还面对面坐着，线上却自顾自聊了 " + live.length + " 轮");
  // 对照：同样两小时，没有线下就该照常跑满
  const free = drive({ minutes: 8, rounds: 5, maxMsg: 50, hours: 2 });
  assert.ok(free.length >= 5, "对照组本身就没跑起来，上面那条等于没测");
});

test("线下结束之后，线上自发要能恢复", () => {
  const ended = drive({ minutes: 8, rounds: 5, maxMsg: 50, hours: 2,
    groupOffline: [{ id: "s1", startTs: T0 - 600000, endTs: T0 - 60000, msgs: [{ role: "user", ts: T0 - 600000 }] }] });
  assert.ok(ended.length >= 5, "线下都结束了还锁着——那就再也聊不起来了");
});

test("一场忘了结束的线下不许把自发聊永远关死", () => {
  const stale = drive({ minutes: 8, rounds: 5, maxMsg: 50, hours: 2,
    groupOffline: [{ id: "s1", startTs: T0 - 9 * 3600000, msgs: [{ role: "user", ts: T0 - 9 * 3600000 }] }] });
  assert.ok(stale.length >= 5, "9 小时前那场还锁着自发聊");
  // 开了但一拍没演的，也不算「正在进行」
  const empty = drive({ minutes: 8, rounds: 5, maxMsg: 50, hours: 2,
    groupOffline: [{ id: "s1", startTs: T0 - 600000, msgs: [] }] });
  assert.ok(empty.length >= 5, "只是开了个空场就把线上锁住了");
});

// ── 冷却期借几轮（v62.13，她 2026-09-04：「做吧宝宝」）───────────────────
// 她原来的想法是「动念满了就去把 50 轮重置掉」。那等于突破一次换一张新卡＝取消上限，
// 所以改成【借一小段】：放行几轮、聊完还回冷却、resetAt 一秒不动，外加每天最多借几次。
test("到顶之后没人动念，一轮都不许借", () => {
  // kicked 让头一轮不等动念，正经 5 轮照跑；之后 urge:false＝谁都不想说话
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, urge: false, kicked: true, hours: 20 });
  assert.equal(got.length, 5, "没人想说话也借到了，实际 " + got.length + " 轮");
  assert.ok(got.card.resetAt > 0, "冷却该挂着");
  assert.ok(!got.card.borrowUsed, "根本没借，不该记账");
});

test("有人动念就借得到——但借的是一小段，冷却一秒没动", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, hours: 1.2 });
  assert.equal(got.length, 9, "5 轮正经 + 借 4 轮 = 9，实际 " + got.length);
  assert.ok(got.card.resetAt > 0, "⚠️借完把冷却清了——那就是换了张新卡，等于取消上限");
  assert.equal(got.card.rounds, 5, "借的账不许记进 rounds，那样下次就看不出已经到顶了");
  assert.equal(got.card.borrowUsed, 1, "今天借了一次");
  assert.equal(got.card.borrowLeft, 0, "四轮走完，借的那一段该还回去了");
  // 借来那一轮能发几条：她设的 50 条 ÷ 5 轮 = 10，不是负数、也不是新拍的魔数
  assert.deepEqual(got.slice(5).map(x => x.budget), [10, 10, 10, 10]);
});

test("一天最多借两次，第三次说什么都不放", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, hours: 20 });
  assert.equal(got.card.borrowUsed, 2, "日闸没兜住，借了 " + got.card.borrowUsed + " 次");
  assert.equal(got.length, 13, "5 + 4 + 4 = 13，实际 " + got.length);
});

test("换一张新额度卡：借来的那一段作废，但今天借过几次要留着", () => {
  const src = app.slice(app.indexOf("const resetAutoChatCycle = (gid"), app.indexOf("const addAutoChatMessages"));
  assert.match(src, /borrowLeft: 0/, "新卡还留着上一段没走完的借轮");
  assert.match(src, /borrowDay: prev\.borrowDay \|\| "", borrowUsed: Number\(prev\.borrowUsed\) \|\| 0/,
    "⚠️日闸没跨过换卡活下来——换卡最常见的原因就是【她说了一句话】，随口一句就把闸清零，那道闸等于不存在");
});

test("借的那一路绝不许清掉 cappedAt / resetAt", () => {
  const i = scan.indexOf("if (borrowing) {");
  assert.ok(i > 0, "借的那一路没了");
  const seg = scan.slice(i, scan.indexOf("} else {", i));
  assert.doesNotMatch(seg, /resetAt: 0/, "借完把冷却清了＝换新卡＝取消上限");
  assert.doesNotMatch(seg, /cappedAt: 0/, "同上");
  assert.doesNotMatch(seg, /rounds: rounds \+ 1/, "借的账混进了正经轮数");
  assert.match(seg, /borrowLeft: \(start \? BORROW_ROUNDS : borrowLeft\) - 1/, "借的轮数不递减＝借了就永远还不回去");
});

test("换一天，闸自己归零（不是攒一辈子）", () => {
  assert.match(scan, /const dayKey = new Date\(now\)\.toDateString\(\);/, "没有「今天」这个概念");
  assert.match(scan, /cycle\.borrowDay === dayKey \? \(Number\(cycle\.borrowUsed\) \|\| 0\) : 0/,
    "跨天不归零的话，借满两次之后这个群一辈子再也借不到");
});

test("两次借之间要隔一阵——日闸挡不住「两次挤在一小时里」", () => {
  // 3 小时内只借得到一次，哪怕那份动念一直是满的
  assert.equal(drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, hours: 2.9 }).card.borrowUsed, 1);
  assert.equal(drive({ minutes: 3, rounds: 5, maxMsg: 50, dongnian: true, hours: 4 }).card.borrowUsed, 2);
  assert.match(scan, /const BORROW_GAP_MS = 3 \* 3600000;/, "最小间隔没了");
  assert.match(scan, /now - \(Number\(cycle\.borrowAt\) \|\| 0\) < BORROW_GAP_MS\) continue;/, "间隔没生效");
});
