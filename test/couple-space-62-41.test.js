// 她 2026-09-04 一口气报的五样：
//   ① 时光胶囊点进去退出会整个页面退出
//   ② 我们的日子能不能设定年份
//   ③ 墙上这一堆还是很无聊
//   ④ 交换日记的里面的样式也没弄还是一张纸
//   ⑤ 秋秋好像不知道情侣空间这里有啥
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");
const scr = R("js/screens.js"), app = R("js/app.js"), core = R("js/core.js");

// ── ② 纪念日的年份 ──────────────────────────────────────────
// 原来【只有月和日】。不重复的那一档只能拿建的那天去猜是哪一年，规矩是
// 「从建的那年往后找第一个」——所以站在明年二月，「7 月」永远指向明年七月，
// **今年七月这个日子根本表达不出来**。
test("只发生一次的纪念日按存下来的年份算，不再拿建档日去猜", () => {
  const core2 = R("js/core.js");
  const i0 = core2.indexOf("function annivNext(");
  const j0 = core2.indexOf("\n}", i0);
  const annivNext = new Function(core2.slice(i0, j0 + 2) + "\nreturn annivNext;")();
  const feb = new Date(2027, 1, 10).getTime();          // 站在 2027 年 2 月
  // 存了 2026：就是 2026 年 7 月 1 日，已经过去了
  const withYear = annivNext({ month: 7, day: 1, yearlyRepeat: false, year: 2026, createdAt: feb }, feb);
  assert.equal(new Date(withYear.ts).getFullYear(), 2026, "填了年份还在猜");
  assert.equal(withYear.passed, true, "2026 年 7 月站在 2027 年 2 月看，是过去了");
  // 没存年份的老记录：照旧走 createdAt 那条，一天都不许变
  const legacy = annivNext({ month: 7, day: 1, yearlyRepeat: false, createdAt: feb }, feb);
  assert.equal(new Date(legacy.ts).getFullYear(), 2027, "老存档的算法被动了");
  // 每年重复的那一档跟年份无关：填了也还是找下一个 7 月 1 日
  const yearly = annivNext({ month: 7, day: 1, yearlyRepeat: true, year: 2020, createdAt: feb }, feb);
  assert.equal(new Date(yearly.ts).getFullYear(), 2027);
  assert.equal(yearly.passed, false, "每年重复的永远不会「已过去」");
  // 年份写坏了要退回猜，不能算出一个 NaN 的日子
  const junk = annivNext({ month: 7, day: 1, yearlyRepeat: false, year: "去年", createdAt: feb }, feb);
  assert.ok(Number.isFinite(junk.ts) && new Date(junk.ts).getFullYear() === 2027, "年份写坏了就炸了");
});

test("年份这一层写的和读的对得上，日历那一份也跟着走", () => {
  // 照 .claude/rules/stub-from-the-writer.md：先钉写的那一头
  assert.match(app, /const addAnniv = \(char, name, month, day, yearlyRepeat, linkCalendar, year\) => \{/);
  assert.match(app, /if \(yr\) rec\.year = yr;/, "年份没存进去");
  // ⚠️日历那一份原来硬写今年：填了 2027 也会被记进今年的格子。
  //   跟倒数用的必须是同一个算法，否则「空间里写着明年、日历上却在今年」。
  assert.match(app, /const nx = annivNext\(rec\);[\s\S]{0,200}?new Date\(nx\.ts\)\.getFullYear\(\)/,
    "日历那一份还在自己算年份");
  assert.doesNotMatch(app, /saveCalEvent\(char\.id, new Date\(\)\.getFullYear\(\)/, "旧那行硬写今年的还留着");
  // 表单：每年重复的那一档不发这一行——它压根没有「哪一年」这个问题
  assert.match(scr, /onAddAnniv\(partner, an, mo, dy, yearly, link, yearly \? null : yr\)/);
  assert.match(scr, /yearly \? null : h\("div", \{ className: "flex items-center justify-center", style: \{ background: "#b85252"/,
    "年份那一行没有跟着「每年重复」收起来");
});

// ── ① 时光胶囊：退一层就是退一层 ────────────────────────────
test("时光胶囊是情侣空间里的一层，不是另一个屏", () => {
  assert.match(scr, /sub === "capsule" && typeof window !== "undefined" && window\.CapsuleApp\)/);
  assert.match(scr, /onBack: \(\) => setSub\(null\)/);
  assert.doesNotMatch(app, /screen === "capsule"/, "旧那一屏还留着——两条路进同一个页面");
  // 走 spine 默认的 openSub，才会记住主页滚到哪儿了（mobile-ui-layout §3）
  assert.doesNotMatch(scr, /onOpenCapsule/);
});

// ── ④ 交换日记：一本轮流传的本子 ────────────────────────────
test("交换日记是一本本子，不是一张纸", () => {
  const i = scr.indexOf("function CoupleExDiary({");
  const page = scr.slice(i, scr.indexOf("\nconst COUPLE_MOODS", i));
  assert.ok(page.length > 1500, "取到的那一段不对");
  // 纸上有格，而且正文的行高必须【跟格距相等】——不相等的话字是浮在格子上的
  assert.match(page, /const RULE_H = 26;/);
  assert.match(page, /repeating-linear-gradient\(180deg,rgba\(0,0,0,0\) 0 " \+ \(RULE_H - 1\)/);
  assert.equal((page.match(/lineHeight: RULE_H \+ "px"/g) || []).length, 2,
    "有一处正文的行高没跟格距对齐（写的那页和读的那页都要）");
  // 装订边在哪一侧＝这一页是谁写的。位置也变了，不只是换个纸色——
  // 「选中态不能只靠一个色差」（tabs-not-plain-pills 那两条不许牺牲的之一）。
  assert.match(page, /isMe \? \{ left: 0 \} : \{ right: 0 \}/, "两边的装订边在同一侧，那就只剩颜色能分了");
  assert.match(page, /padding: isMe \? "12px 15px 15px 28px" : "12px 28px 15px 15px"/, "正文没给装订边让位");
  // 写字那一页：输入框不许自己再上一层底和边框，字要落在这一页的格子上
  assert.match(page, /background: "transparent", border: "none", padding: 0,\s*\n?\s*fontFamily: "'Noto Serif SC',serif"/);
  // 底纹铺在【外壳】上、Head 透上来（.claude/rules/mobile-ui-layout.md §3.5）
  assert.match(page, /h\("div", \{ className: "h-full flex flex-col", style: \{ background: t\.bg,/);
  assert.match(page, /h\(Head, \{ zh: "交换日记", en: partner\.name, onBack, bg: "transparent" \}\)/);
  assert.match(page, /className: "flex-1 min-h-0 overflow-y-auto/);
  // 「写一页」不是一颗实心药丸
  assert.doesNotMatch(page, /background: t\.ink, color: t\.bg2, fontFamily: F_DISPLAY, fontSize: 14\.5/);
});

// ── ⑤ 秋秋知道情侣空间里有什么 ──────────────────────────────
test("手册把情侣空间拆开讲，十几扇门都点到名", () => {
  const win = {}; new Function("window", R("js/assistant-manual.js"))(win);
  const M = win.AssistantManual;
  ["couple", "couple_wall", "couple_kept", "couple_days"].forEach(id =>
    assert.ok(M.byId(id), "手册里没有 " + id));
  const all = ["couple", "couple_wall", "couple_kept", "couple_days"].map(id => M.textOf(M.byId(id))).join("\n");
  // 门一扇都不许漏：漏了的那一扇，秋秋只会说「我不确定」
  ["合照", "照相馆", "第一次", "如果馆", "抽卡", "抽屉", "窗台", "唱片",
   "情书", "交换日记", "问答小本", "他记得的", "说好的", "时光胶囊",
   "我们的档案", "愿望板", "和好间", "时光轴", "里程碑"].forEach(w =>
    assert.ok(all.indexOf(w) >= 0, "手册里没提到「" + w + "」"));
  // 目录永远全发，所以这四条在目录里也要看得见
  const idx = M.index();
  ["情侣空间 · 墙上", "情侣空间 · 收着的", "情侣空间 · 我们的日子"].forEach(z =>
    assert.ok(idx.indexOf(z) >= 0, "目录里没有「" + z + "」"));
  // ⚠️手册铁律②：只写怎么用，不写怎么做出来的
  assert.ok(!/x_[a-zA-Z]|openSub|setSub|localStorage/.test(all), "词条里漏了实现细节出去");
  // 问得着才算数
  assert.ok(M.find("纪念日能填年份吗", 4).some(x => x.id === "couple_days"));
  assert.ok(M.find("抽屉是干嘛的", 4).some(x => x.id === "couple_wall"));
  assert.ok(M.find("交换日记怎么用", 4).some(x => x.id === "couple_kept"));
});
