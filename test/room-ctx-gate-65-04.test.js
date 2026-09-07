// v65.04：她 2026-09-06 报「他好像不是完全隔离啊，还知道我们开了情侣空间 3 天」——
// 那是在一间「不带出门」的房里（cognition 五档全关）。
//
// ⚠️病根不是漏了 coupleStatus 这一条。那道闸原来写成了**手抄的黑名单**：
//   ctxFor 造 41 栏，闸只点名擦掉 18 栏，**剩下 23 栏默认放行**——
//   好感度、生理期、情侣档案那七栏、纪念日、他送过什么、一起听过什么，全在里头。
//
// 黑名单的错法是【看不见的】：以后 ctxFor 每加一栏，隔离房就自动多漏一条，
// 不报错、不红任何测试。这正是 stub-from-the-writer.md 那条
// 「过滤**等于没有** → 该挡的没挡住（隐私、串场）」。
//
// 所以改成白名单：每一栏都得登记归谁管，没登记的默认挡住。
// 下面第一条就是那个「一劳永逸」：**ctxFor 造的每一栏都必须在表里**，漏登记就红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CR = require("../js/chat-rooms.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// ctxFor 那个对象字面量里的顶层字段
function ctxForKeys() {
  const lines = app.split("\n");
  const i = lines.findIndex(l => l.startsWith("  const ctxFor = "));
  assert.ok(i >= 0, "找不到 ctxFor");
  let j = i + 1;
  while (j < lines.length && !/^  const \w/.test(lines[j])) j++;
  const keys = [];
  for (let n = i; n < j; n++) {
    // `char,` / `profile,` 这种对象简写也是字段。旧测试只认带冒号的，正好漏掉
    // 两个生成引擎必需项，白名单把它们清成 null 后线上线下一起在 char.name 崩掉。
    const m = /^    ([A-Za-z_$][\w$]*)(?::|,\s*$)/.exec(lines[n]);
    if (m) keys.push(m[1]);
  }
  return [...new Set(keys)];
}

test("ctxFor 造的每一栏都得在白名单里登记（漏登记＝隔离房里默认漏出去）", () => {
  const all = new Set(Object.values(CR.CTX_GATE).flat());
  const missing = ctxForKeys().filter(k => !all.has(k));
  assert.deepEqual(missing, [],
    "这几栏没在 js/chat-rooms.js 的 CTX_GATE 里登记，隔离房会照样把它们发出去：\n  " + missing.join("、") +
    "\n登记时想一句：这一栏说的是【他是谁】(always)，还是【你们经历过什么】/【处到哪一步】/【今天他什么情况】/【别处发生的】？");
  // 反过来也钉：表里不许留 ctxFor 早就没有的死名字
  const dead = [...all].filter(k => !new RegExp("[\\s{,]" + k + "(?:\\s*:|\\s*,)").test(app));
  assert.deepEqual(dead, [], "白名单里这几个名字 ctxFor 已经不造了：" + dead.join("、"));
});

test("心情那两栏是 spread 出来的，也得登记", () => {
  // ⚠️moodLabel/moodNote 来自 ctxFor 里的 ...(function(){})()，四空格那条正则扫不到——
  //   所以单独点名。以后再有 spread 出来的栏，照这里加一条。
  const all = new Set(Object.values(CR.CTX_GATE).flat());
  ["moodLabel", "moodNote"].forEach(k => assert.ok(all.has(k), k + " 没登记"));
  assert.match(app, /return \{ moodLabel: st\.label \|\| null, moodNote: st\.note \|\| "" \};/, "心情那两栏的来处变了，回去看白名单还对不对");
});

test("她这次撞见的那几栏，归的是「你们处到哪一步了」", () => {
  const inner = CR.CTX_GATE.innerLife;
  ["coupleStatus", "affinity", "periodNote", "dateNote", "onMe", "wishLog"].forEach(k =>
    assert.ok(inner.includes(k), k + " 该归 innerLife（关掉「你们处到哪一步了」就不该有）"));
  // 情侣空间那七栏是你们一起攒的，归「经历过的事」
  assert.ok(CR.CTX_GATE.formalMemory.includes("coupleArchive"));
  // 困不困跟行程同一档（它自己的注释里就写着「跟 aMood 走同一条路」）
  assert.ok(CR.CTX_GATE.schedule.includes("sleepTone"));
});

test("真跑一遍：一间「不带出门」的房里，这些栏必须是空的", () => {
  const room = CR.normalize({ id: "r1", name: "不带出门", ...CR.PRESETS.isolated }, "c1");
  const ctx = { coupleStatus: "together|3", affinity: 88, periodNote: "她这两天不舒服",
    coupleArchive: "彼此称呼：崽崽", gazeText: "她最近很累", memory: "一起去过温尼伯",
    memLib: [{ id: 1 }], moodLabel: "闷", personaEvolve: true, geo: { lat: 1 }, timeAware: true,
    sleepTone: "他这会儿困了", offlineNow: "在场", giftLog: "他送过一条围巾", wishLog: "她想要那本书",
    onMe: "他送的手链", dateNote: "后天是纪念日", dreamEcho: "昨晚那个梦",
    chars: [{ id: "c1" }], worldbook: "这个世界下雪", homeCity: "温尼伯", notRoleplay: false };
  const out = CR.gateCtx(ctx, room);
  const leaked = Object.keys(ctx).filter(k => !CR.CTX_GATE.always.includes(k)
    && JSON.stringify(out[k]) === JSON.stringify(ctx[k]) && ctx[k] !== false && ctx[k] !== "" );
  assert.deepEqual(leaked, [], "这几栏在隔离房里漏出去了：" + leaked.join("、"));
  assert.equal(out.coupleStatus, "", "她这次看见的那条还在漏");
  assert.equal(out.affinity, null);
  assert.deepEqual(out.memLib, [], "数组要清成空数组，不是 null");
  assert.equal(out.personaEvolve, false, "真假值要清成 false，不是 null");
  // 「他是谁」那几栏照旧给
  assert.deepEqual(out.chars, ctx.chars);
  assert.equal(out.worldbook, ctx.worldbook);
  assert.equal(out.homeCity, "温尼伯");
});

test("真跑一遍：隔离房仍保留生成引擎的身份骨架，关系网只清成空表", () => {
  const room = CR.normalize({ id: "r_engine", name: "不带出门", ...CR.PRESETS.isolated }, "7");
  const char = { id: 7, name: "陆衍", persona: "寡言" };
  const profile = { name: "Lisa" };
  const out = CR.gateCtx({ char, profile, chars: [char], rels: { "7->me": { label: "恋人" } } }, room);
  assert.equal(out.char, char, "ctx.char 被清掉会让线上线下同时在 char.name 崩掉");
  assert.equal(out.profile, profile, "房里不能连正在和谁说话都忘掉");
  assert.deepEqual(out.rels, {}, "关掉内在关系时应给引擎可读取的空表，不是 null");
});

test("主房和开着那一档的房，一栏都不许少", () => {
  const ctx = { coupleStatus: "together|3", affinity: 88, memory: "x", schedNow: "在写论文" };
  assert.deepEqual(CR.gateCtx(ctx, CR.mainRoom("c1")), ctx, "主房被过滤了");
  // ⚠️主房认的是 main 这个身份，不是「它的开关碰巧全开着」：
  //   哪天存档里写进一份开关不全的主房，主聊天也绝不许被掏空。
  assert.deepEqual(CR.gateCtx(ctx, { main: true, cognition: { formalMemory: false, innerLife: false, schedule: false, otherScenes: false } }), ctx,
    "主房是靠「开关碰巧全开」蒙混过去的——闸没认 main 这个身份");
  const everyday = CR.normalize({ id: "r2", ...CR.PRESETS.everyday }, "c1");
  assert.deepEqual(CR.gateCtx(ctx, everyday), ctx, "「慢慢聊这件事」那一档不该被过滤");
  assert.deepEqual(CR.gateCtx(ctx, null), ctx, "没有房间时不该动");
});

test("app.js 那一处真的换成白名单了，黑名单删干净", () => {
  assert.match(app, /_gated = window\.ChatRooms\.gateCtx\(_roomCtx,/, "调用点没换成公共那道闸");
  assert.match(app, /buildBundle\(_singleHistoryLayout \? \{ \.\.\._gated, recentChat: "" \} : _gated\)/, "过滤完的那份没被真正用上");
  // ⚠️线下那条路上原来还有【第二份一模一样的手抄件】，两处一起漏那 23 栏。
  //   两处都得走同一张白名单，不然改一处永远漏另一处（one-public-mechanism.md）。
  assert.match(app, /oCtx = window\.ChatRooms\.gateCtx\(oCtx,/, "线下那条路没换成公共那道闸");
  assert.equal((app.match(/ChatRooms\.gateCtx\(/g) || []).length, 2, "过闸的地方不是线上线下两处");
  // 「撤掉东西要删除，不是留在原地」
  assert.ok(!/moodLabel = null; /.test(app), "旧那张黑名单还留着");
  assert.ok(!/if \(!rc\.formalMemory\)/.test(app), "旧那张黑名单还留着");
  assert.ok(!/if \(!rc\.otherScenes\)/.test(app), "旧那张黑名单还留着");
});

// ── 房内自留的浓缩（同一版）──────────────────────────────────────
// 她 2026-09-06：「那这里的上下文就过了上限就只能丢了对吗宝宝因为不能进记忆库」——
// 原来是的：memoryCandidate 关着时 maybeSummarize 和 maybeAutoExtract 一起不跑，
// 而且 maybeSummarize(charId) 浓缩的是【主聊天】那一份，房间那条线它根本不看。
// 所以掉出 80 条 / 14000 字那个窗口的，就再也回不来了。
//
// 补法：浓缩照跑，但结果【只存在这间房里、只喂这间房】——
// 不进长期记忆、不进记忆库、不出门，所以「不带出门」一个字都没破。

test("攒够 50 条才浓缩，末尾 15 条留着不动，主房不跑", () => {
  const msgs = Array.from({ length: 70 }, (_, i) => ({ content: "第" + i + "句", role: i % 2 ? "assistant" : "user" }));
  const room = CR.normalize({ id: "r1", ...CR.PRESETS.isolated }, "c1");
  const due = CR.digestDue(room, msgs);
  assert.ok(due, "70 条了还不浓缩");
  assert.equal(due.slice.length, 70 - CR.ROOM_SUM_BUFFER, "末尾那截没留住");
  assert.equal(due.upto, 70 - CR.ROOM_SUM_BUFFER, "游标推错了");
  assert.equal(CR.digestDue(room, msgs.slice(0, 49)), null, "还不够就不该跑（她按次计费）");
  assert.equal(CR.digestDue(CR.mainRoom("c1"), msgs), null, "主房不该走这一份（它有自己的 maybeSummarize）");
  // 撤回的和空的不算数
  const dirty = msgs.slice(0, 60).map((m, i) => i < 55 ? { ...m, recalled: true } : m);
  assert.equal(CR.digestDue(room, dirty), null, "撤回的也被算进条数了");
});

test("满仓时整段整段地掉，不许拦腰砍出半句开头", () => {
  let g = "";
  for (let i = 0; i < 12; i++) g = CR.digestMerge(g, "【第" + i + "段】" + "字".repeat(500));
  assert.ok(g.length <= CR.ROOM_DIGEST_CAP, "没收住仓");
  assert.match(g.slice(0, 4), /^【第\d/, "开头是半句话——按字数拦腰砍了");
  assert.equal(CR.digestMerge("", "头一段"), "头一段");
  assert.equal(CR.digestMerge("旧的", "新的"), "旧的\n\n新的", "新的要接在后面");
});

test("这份浓缩只喂回这间房，而且说清了它是这条线自己的往事", () => {
  const room = CR.normalize({ id: "r1", name: "长篇如果", selfDigest: "他们在雪里走了很久。", ...CR.PRESETS.isolated }, "c1");
  const p = CR.prompt(room, []);
  assert.match(p, /【这间房前面发生过的｜是这条线自己的往事，不是别处的记忆】/, "没喂回去");
  assert.match(p, /他们在雪里走了很久。/);
  // 主房拿不到侧房的这一份（主房走的是交接那条路）
  assert.ok(!/这间房前面发生过的/.test(CR.prompt(CR.mainRoom("c1"), [])), "漏进主房了");
  // 空的时候不占一个字（她按次计费，也守聊天预算）
  const empty = CR.normalize({ id: "r2", ...CR.PRESETS.isolated }, "c1");
  assert.ok(!/这间房前面发生过的/.test(CR.prompt(empty, [])), "没浓缩过也塞了一个空段");
});

test("浓缩不看 memoryCandidate——它本来就不出门", () => {
  const i = app.indexOf("const _roomMayRemember =");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /if \(room && !room\.main\) setTimeout\(\(\) => maybeSummarizeRoom\(char, room\), 200\);/,
    "浓缩没挂上，或者被挂进了 _roomMayRemember 那个 if 里（那样「不带出门」的房还是会失忆）");
  // ⚠️必须在 if 外面：挂进去就等于又被 memoryCandidate 管住了
  const inIf = seg.slice(seg.indexOf("if (_roomMayRemember) {"), seg.indexOf("\n      }"));
  assert.ok(!/maybeSummarizeRoom/.test(inIf), "浓缩被挂进 memoryCandidate 那个 if 里了");
});

test("浓缩这一枪：走后台便宜池、跑之前重读那间房、失败不留半份", () => {
  const i = app.indexOf("const maybeSummarizeRoom = async");
  assert.ok(i > 0, "maybeSummarizeRoom 不见了");
  const fn = app.slice(i, app.indexOf("\n  const maybeSummarize = async", i));
  assert.match(fn, /const p = bgApiFor\(char\.id\) \|\| active;/, "没走后台便宜池");
  assert.match(fn, /roomSumBusyRef\.current\[key\]/, "没有防并发的锁");
  // 浓缩跑几十秒，中途她可能改过这间房——落盘前得重读
  assert.match(fn, /const cur = window\.ChatRooms\.get\(char\.id, room\.id\) \|\| room;/, "落盘前没重读那间房，会把她中途的改动盖掉");
  assert.match(fn, /selfSummedCount: due\.upto/, "游标没往前推，下次会把同一段再浓缩一遍");
  assert.match(fn, /filter\(m => !isOocMsg\(m\) && contextAllowsMessage\(m\)\)/, "OOC 和失败诊断被浓缩进去了");
});
