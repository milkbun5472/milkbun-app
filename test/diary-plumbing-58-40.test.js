const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

// 她 2026-08-30：「我记得你以前格式把秘密改成划掉了，但是一直没生效」
test("落库要留住 struck / pasted，不是只抄 text 和 secret", () => {
  const line = grab(app, "        paras: Array.isArray(d.paras)", "        signature:", "落库那一步");
  const map = new Function("d", "return (" + line.replace(/^\s*paras:\s*/, "").replace(/,\s*$/, "") + ");");
  const out = map({ paras: [
    { text: "普通一段" },
    { text: "不肯说的那句", secret: true },
    { text: "写了又划掉的半句", struck: true },
    { text: "票根上的字", pasted: true },
    { text: "", secret: true }
  ] });
  assert.equal(out.length, 4, "空 text 的没滤掉，或者滤多了");
  assert.deepEqual(out[1], { text: "不肯说的那句", secret: true, struck: false, pasted: false });
  assert.equal(out[2].struck, true, "划掉的那句又被丢了——提示词让写、界面会画，就是存不下来");
  assert.equal(out[3].pasted, true, "贴进来的那块又被丢了");
  // 四个标记都得是真布尔，界面靠它们分支
  out.forEach(p => ["secret", "struck", "pasted"].forEach(k => assert.equal(typeof p[k], "boolean", k + " 不是布尔")));
});

test("界面确实会把这两种画出来（不然存了也白存）", () => {
  const view = grab(scr, "function DiaryEntryView(", "\nfunction fmtClockShort", "DiaryEntryView");
  assert.match(view, /p\.pasted/, "贴进来的那块没画");
  assert.match(view, /textDecoration: p\.struck \? "line-through" : "none"/, "划掉的那句没画成划掉");
  assert.match(view, /opacity: p\.struck \? 0\.42/, "划掉的那句没淡下去");
  // 摘要不许拿划掉的半句或票根当开头，那两样单看都不成句
  const pv = grab(scr, "function diaryPreview(", "\n\n// 全文页", "diaryPreview");
  assert.match(pv, /!x\.secret && !x\.struck && !x\.pasted/);
});

// leanWriteCtx 是给贵线瘦身的，它会把 worldbook / carryLog 一并清空。
// 但日记上一行才刚按 diary 这个 scope 挑过世界书——算完又被抹掉，等于从来没生效过
test("日记自己挑的世界书和随身物，瘦身之后要放回去", () => {
  const lean = grab(eng, "function leanWriteCtx(ctx)", "\n// =====", "leanWriteCtx");
  assert.match(lean, /worldbook: ""/, "leanWriteCtx 不再清空 worldbook 了？那这条测试的前提变了");
  assert.match(lean, /carryLog: ""/);
  const gen = grab(app, "  const genDiary = async (charId, opts = {})", "  const genDiaryCommentsFor", "genDiary");
  assert.match(gen, /leanCtx\.worldbook = loreFor\(char, "diary"\)/, "按 diary scope 挑的世界书又被瘦身抹掉了");
  assert.match(gen, /leanCtx\.carryLog =/, "随身物没给日记——包里那把伞、衣柜里那件外套，日记里最见人的就是这种");
  // 放回去必须在 leanWriteCtx 之后，不然照样被抹掉
  assert.ok(gen.indexOf("const leanCtx = leanWriteCtx(ctx)") < gen.indexOf("leanCtx.worldbook ="), "放回去的顺序反了，等于没放");
  assert.ok(!/leanWriteCtx\(ctx\), \{ scheduleText/.test(gen), "还在直接把 leanWriteCtx(ctx) 传下去");
  assert.match(gen, /slice\(0, 900\)/, "随身物没封顶，长起来会撑爆贵线");
});

// 她问「更新了一堆功能后喂给日记的要不要也更新」——身体读数是能对得上日期又免费的那一层
test("那天的身体读数进了日记，而且取的是【那一天】那条", () => {
  const gen = grab(app, "  const genDiary = async (charId, opts = {})", "  const genDiaryCommentsFor", "genDiary");
  assert.match(gen, /vitalsFor\(charId\)/, "没读身体那条线");
  assert.match(gen, /x\.day === targetKey/, "没按目标那天挑——补写昨天的日记会拿到今天的读数");
  assert.ok(!/charData\[charId\]\.health|phonesRef[\s\S]{0,40}health/.test(gen),
    "直接读了手机里那份健康报告——那份是 ♻️「今天」，补写昨天会拿错一天");
  assert.match(gen, /bodyText: bodyText/, "算了却没传下去（声明了没引用的老毛病）");
  const blk = grab(eng, "  if (opts.bodyText", "  if (opts.walletText", "bodyText 那一段");
  assert.match(blk, /那天的身体读数/);
  assert.match(blk, /不要把这几个数字抄进日记/, "没拦住它把「综合分 74」原样抄进正文");
});

test("日记的落笔守则还在，别哪天被顺手删了", () => {
  ["日记的中心是你自己，不是用户", "不要默认使用『文艺日记腔』", "篇篇一样长本身就是假的",
   "全篇不要用括号写动作或神态", "禁止把它固定放在最后一段当收尾"]
    .forEach(k => assert.ok(eng.indexOf(k) > 0, "少了这条守则：" + k));
  // struck / pasted / secret 三条的配额也钉住，免得哪天变成每篇都涂一句凑气氛
  assert.match(eng, /设 struck=true 的段落只有一句/);
  assert.match(eng, /全篇 0~1 处，多数日子没有/);
  assert.match(eng, /全篇 0 个才是常态/);
});
