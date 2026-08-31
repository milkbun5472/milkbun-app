const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
const src = app.slice(app.indexOf("  const SCHED_PEER_MAX = 3"), app.indexOf("  const genScheduleDay = async (char, dayKey) => {"));
// 纯函数拿出来真跑：characters / rels / schedulesRef 由外面喂
const mk = (chars, rels, plans) => new Function("characters", "rels", "schedulesRef",
  src + "\nreturn schedPeerBlock;")(chars, rels, { current: plans });
const CH = [{ id: "c1", name: "裴照川" }, { id: "c2", name: "陆闻" }, { id: "c3", name: "路人" }];
const RELS = { "c1->c2": { label: "下属" }, "c2->c1": { label: "上司" } };
const K = "2026-08-31";
const PLANS = {
  c2: { [K]: { seqs: [{ time: "10:00", title: "和裴照川在城南茶楼碰面", location: "城南茶楼" }, { time: "14:00", title: "回官署抄录", location: "官署" }] } },
  c3: { [K]: { seqs: [{ time: "09:00", title: "摆摊", location: "街口" }] } }
};

// 她 2026-08-31：「怎么样能让有关系的两个人日程生成的时候会参考对方的，
// 然后比如说 10 点去咖啡厅两边都会写」。
test("只把【有关系】那几位的安排带上", () => {
  const out = mk(CH, RELS, PLANS)(CH[0], [K]);
  assert.match(out, /陆闻（下属）/, "有关系的那位没带上");
  assert.ok(out.indexOf("路人") < 0, "跟谁都没关系的也端过来了");
  // 一个关系都没有：整块不发，零 token
  assert.equal(mk(CH, {}, PLANS)(CH[0], [K]), "");
  // 有关系但对方还没排过：也不发
  assert.equal(mk(CH, RELS, {})(CH[0], [K]), "");
});

// 「10 点去咖啡厅两边都会写」＝点到他名字的那几段必须对齐
test("点到他名字的标星，而且说清必须对上", () => {
  const out = mk(CH, RELS, PLANS)(CH[0], [K]);
  assert.match(out, /⭐2026-08-31 10:00 陆闻（下属）：和裴照川在城南茶楼碰面（城南茶楼）/, "点到名字那段没标星");
  assert.match(out, /· 2026-08-31 14:00 陆闻（下属）：回官署抄录/, "没点到名字的那段不该标星");
  assert.match(out, /时间、地点、这件事本身都要对上/);
  assert.match(out, /绝不许一边写十点见面、另一边写下午见面/, "没把最常见的对不上说死");
  assert.match(out, /也不许一边有这件事另一边当没发生/, "少了「一边有一边没有」那一种");
  // 地点里带他名字的也算
  const p2 = { c2: { [K]: { seqs: [{ time: "09:00", title: "送东西", location: "裴照川府上" }] } } };
  assert.match(mk(CH, RELS, p2)(CH[0], [K]), /⭐/, "地点里点到他名字的没认出来");
});

// ⚠️不加这一句，每个人的一天都会变成「去找别人」
test("留了「他今天是他自己的一天」这道闸", () => {
  const out = mk(CH, RELS, PLANS)(CH[0], [K]);
  assert.match(out, /他今天是他自己的一天/, "没挡住「为了呼应硬凑」");
  assert.match(out, /多数日子两个人本来就各过各的/);
  assert.match(out, /没带⭐的只是让你知道那几位那天大概怎么过/, "没说清没标星的那些是干嘛的");
});

test("有上限：人数、条数、天数都封住", () => {
  const many = [{ id: "c1", name: "主" }].concat(Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, name: "邻" + i })));
  const rl = {}, pl = {};
  many.slice(1).forEach(c => {
    rl["c1->" + c.id] = { label: "友" };
    pl[c.id] = { [K]: { seqs: Array.from({ length: 12 }, (_, j) => ({ time: "0" + (j % 10) + ":00", title: "事" + j })) } };
  });
  const out = mk(many, rl, pl)(many[0], [K]);
  // ⚠️只数【真正的条目行】：底下那句说明也是以 ⭐ 开头的，按前缀数会把它一起算进来
  const rows = out.split("\n").filter(l => /^(⭐|· )\d{4}-\d\d-\d\d /.test(l));
  assert.ok(rows.length <= 20, "条数没封住：" + rows.length);
  const who = new Set(rows.map(l => (l.match(/邻\d/) || [""])[0]));
  assert.ok(who.size <= 3, "人数没封住：" + who.size);
  assert.match(app, /SCHED_PEER_DAYS = 3/, "天数没封住");
});

// 一层只写一处：单天和整周共用同一个块（整周那条才是每天自动跑的那条链）
test("单天和整周都接上，而且是同一个块", () => {
  assert.equal((app.match(/const schedPeerBlock = /g) || []).length, 1, "抄了第二份");
  assert.match(app, /instruction: schedInstr \+ schedPeerBlock\(char, \[dayKey\]\)/, "单天没接");
  assert.match(app, /\+ schedPeerBlock\(char, want\)/, "整周没接——那条才是每天自动跑的");
  // 不多花调用：这条链本来就是一个一个排，后排的看得见先排好的
  const week = app.slice(app.indexOf("  const genScheduleWeek = async (char, opts) => {"), app.indexOf("  const schedGenAllToday"));
  assert.equal((week.match(/schedPeerBlock\(/g) || []).length, 1, "整周那处调了不止一次");
});

// 她 2026-08-31：「现在从聊天进到行程那一页是日历整体 view，
// 而不是进到那一天看到实际行程」
test("从聊天点进日程，直接落在那一天", () => {
  assert.match(comp, /const \[mode, setMode\] = useState\(initialView && initialView !== "mine" \? "day" : "month"\);/,
    "还是一进来就整月");
  // 主屏那个日历组件进来（没有 initialView）仍旧是整月——那一处本来就该是整月
  assert.match(comp, /从主屏日历组件进来（没有 initialView）仍旧是整月/, "没写清为什么另一处不改");
  assert.match(comp, /const \[daySel, setDaySel\] = useState\(todayKey\);/, "落到那一天了却不是今天");
});
