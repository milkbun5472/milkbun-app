// 名册的退出机制（墓碑）
//
// 书签会取消收藏、草稿会发出去或删掉、关注会取关、黑名单里的人会被放出来、
// 想买的会买到手。这几样不是日志（不是「发生过什么」），是名册（「现在有哪些」）——
// 但也不能做成 ♻️ 每次重掷：♻️ 的字段压根不发回给模型，它会每次凭空编一份新黑名单，
// 比只进不出还糟。所以走【累积 + 墓碑】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = new Function(phoneSrc + "; return { PHONE_RETIRE, PHONE_GROW, phoneRowName, phoneNameNorm, phoneRosterBlock, phoneSelfAvoidBlock, phoneGrowMerge, phoneMergeSaved, phoneProbeSpec, phoneAlbumTidy, PHONE_ALBUM_CAP, PHONE_ALBUM_MIN, PHONE_ALBUM_CATS, phoneVitalOf, phoneVitalMerge, PHONE_VITAL_DAYS };")();
const NOW = new Date(2026, 7, 29, 15, 0).getTime();
const char = { name: "某人" };

test("写进 retired 的从名单上消失，别的原样留着", () => {
  const old = { blocked: [{ name: "一个自称能通门路的", why: "第三回打来" }, { name: "旧仇家", why: "" }], calls: [] };
  const gen = { blocked: [{ name: "新拉黑的", why: "半夜打来" }], calls: [], retired: { blocked: ["旧仇家"] } };
  const out = P.phoneGrowMerge("calls", old, gen, NOW);
  const names = Array.from(out.blocked, x => x.name);
  assert.ok(names.includes("新拉黑的"), "新的没进来");
  assert.ok(names.includes("一个自称能通门路的"), "没点名的被误删了");
  assert.ok(!names.includes("旧仇家"), "写进 retired 的还赖着不走");
});

test("retired 本身不许被存下来——它是指令不是内容", () => {
  const out = P.phoneGrowMerge("calls", { blocked: [] }, { blocked: [{ name: "甲" }], retired: { blocked: [] } }, NOW);
  assert.equal(out.retired, undefined);
  const saved = P.phoneMergeSaved("liked", { follows: [{ name: "斫木记" }] },
    { follows: [], retired: { follows: ["斫木记"] } }, NOW);
  assert.equal(saved.retired, undefined);
  assert.equal(saved.follows.length, 0, "取关了却还在");
});

test("名字对名字时忽略标点空白——模型回写时标点常常飘", () => {
  assert.equal(P.phoneNameNorm(" 以后再算的账。 "), "以后再算的账");
  const out = P.phoneGrowMerge("browser",
    { marks: [{ name: "以后再算的账" }] },
    { marks: [], retired: { marks: ["「以后再算的账」"] } }, NOW);
  assert.equal(out.marks.length, 0, "带了引号就对不上了");
});

test("没写 retired 的时候一切照旧累积（大多数轮次就该是这样）", () => {
  const out = P.phoneGrowMerge("browser", { marks: [{ name: "旧书签" }] }, { marks: [{ name: "新书签" }] }, NOW);
  assert.deepEqual(Array.from(out.marks, x => x.name), ["新书签", "旧书签"]);
  // 脏 retired 不炸
  [{ retired: "不是对象" }, { retired: { marks: "不是数组" } }, { retired: { marks: [null, 3] } }]
    .forEach(bad => assert.doesNotThrow(() => P.phoneGrowMerge("browser", { marks: [{ name: "旧书签" }] }, { marks: [], ...bad }, NOW)));
});

test("名单要发回提示词，而且必须说清「不写不算删」", () => {
  // 累积层里「没写」等于「还在」。不把这句挑明，模型会以为漏掉就是删掉。
  const blk = P.phoneRosterBlock("liked", { follows: [{ name: "斫木记" }], drafts: [{ title: "写给某个不看的人" }] });
  assert.match(blk, /斫木记/);
  assert.match(blk, /写给某个不看的人/);
  assert.match(blk, /原样照抄回来/);
  assert.match(blk, /光是不写它不算删掉/);
  assert.match(blk, /retired/);
  assert.equal(P.phoneRosterBlock("notes", { items: [] }), "");
  assert.equal(P.phoneRosterBlock("liked", null), "");
});

test("同一栏不许既说「照抄回来」又说「别再写一遍」", () => {
  // 两句相反的话喂给模型，它必然写歪
  const known = { follows: [{ name: "斫木记" }], items: [{ title: "某条笔记" }] };
  const avoid = P.phoneSelfAvoidBlock("liked", known);
  assert.ok(avoid.indexOf("斫木记") < 0, "名册那栏跑进了「别再写一遍」的清单里");
  assert.ok(avoid.indexOf("某条笔记") > 0, "日志那栏该留在避重清单里");
});

test("有墓碑的 app，schemaHint 里得有 retired 这个口子", () => {
  Object.keys(P.PHONE_RETIRE).forEach(k => {
    const spec = P.phoneProbeSpec(k, char, [], "", []);
    assert.ok(spec.schemaHint.indexOf("retired") > 0, k + " 的 schemaHint 没给 retired");
    assert.doesNotThrow(() => JSON.parse(spec.schemaHint), k + " 的 schemaHint 不是合法 JSON");
  });
});

// ── 相册 ──────────────────────────────────────────────────

test("相册：同一张照片换个说法不再攒两份", () => {
  const items = [
    { caption: "秒撤回的那条邀请记录", category: "memory", date: "2026-08-28 18:42" },
    { caption: "秒撤回的那条邀请记录。", category: "memory", date: "2026-08-28 20:00" },   // 只差一个句号
    { caption: "那条秒撤回的邀请记录", category: "memory", date: "2026-08-28 21:00" },     // 包含关系
    { caption: "完全不同的另一张", category: "memory", date: "2026-08-28 22:00" },
    { caption: "秒撤回的那条邀请记录", category: "memory", date: "2026-03-01 10:00" }      // 隔了几个月，不算重
  ];
  const out = Array.from(P.phoneAlbumTidy({ items }, NOW).items);
  const sameDay = out.filter(x => String(x.date).indexOf("2026-08-28") === 0 && x.caption.indexOf("邀请记录") >= 0);
  assert.equal(sameDay.length, 1, "同一天那三条（差句号、换语序）该并成一条，现在还剩 " + sameDay.length + " 条");
  assert.ok(out.some(x => String(x.date).indexOf("2026-03-01") === 0), "隔了几个月的同名照片不该被当成重复");
  assert.ok(out.some(x => x.caption === "完全不同的另一张"), "把不相干的照片也并掉了");
});

test("相册：满仓时五类都保得住，不被数量大的挤没", () => {
  const mk = (cat, n) => Array.from({ length: n }, (_, i) => ({ caption: cat + i, category: cat, date: "2026-08-2" + (i % 9) + " 10:00" }));
  // 回忆一大堆，私密只有几张
  const items = mk("memory", 200).concat(mk("private", 5), mk("favorite", 5), mk("saved", 5));
  const out = P.phoneAlbumTidy({ items }, NOW);
  assert.ok(out.items.length <= P.PHONE_ALBUM_CAP);
  ["private", "favorite", "saved"].forEach(cat =>
    assert.ok(out.items.filter(x => x.category === cat).length >= 5,
      cat + " 被回忆挤没了（还剩 " + out.items.filter(x => x.category === cat).length + " 张）"));
});

test("相册：没满仓就别动", () => {
  const items = [{ caption: "甲", category: "memory", date: "2026-08-28 10:00" }];
  const out = P.phoneAlbumTidy({ items }, NOW);
  assert.equal(out.items.length, 1);
  [null, {}, { items: "x" }, { items: [null, 3] }].forEach(bad =>
    assert.doesNotThrow(() => P.phoneAlbumTidy(bad, NOW)));
});

// ── 健康的每日快照 ──────────────────────────────────────────

test("健康只抽一条极轻的快照，不把整份报告天天累计", () => {
  const health = {
    today: { score: 74, label: "熬了半宿" },
    cards: Array.from({ length: 20 }, (_, i) => ({ name: "指标" + i, score: 60 + i, note: "很长很长的一段说明".repeat(20) })),
    timeline: [{ time: "02:34", text: "很长" }], insights: [{ title: "x", text: "y" }], tail: "尾巴"
  };
  const v = P.phoneVitalOf(health, NOW);
  assert.equal(v.score, 74);
  assert.equal(Object.keys(v.marks).length, 10, "核心指标该封顶在 10 个");
  assert.equal(v.day, "2026-08-29");
  // 长文一个字都不许进快照
  const json = JSON.stringify(v);
  assert.ok(json.indexOf("很长很长") < 0 && json.indexOf("尾巴") < 0, "把报告正文也存进趋势了");
  assert.ok(json.length < 500, "快照太大了：" + json.length);
  assert.equal(P.phoneVitalOf(null, NOW), null);
  assert.equal(P.phoneVitalOf({ today: {}, cards: [] }, NOW), null);
});

test("健康快照一天一条，同一天覆盖，留 90 天", () => {
  assert.equal(P.PHONE_VITAL_DAYS, 90);
  let list = [];
  list = P.phoneVitalMerge(list, { day: "2026-08-28", score: 60, marks: {} });
  list = P.phoneVitalMerge(list, { day: "2026-08-29", score: 70, marks: {} });
  list = P.phoneVitalMerge(list, { day: "2026-08-29", score: 74, marks: {} });   // 同一天再刷
  assert.equal(list.length, 2, "同一天刷两次存成了两条");
  assert.equal(list[0].day, "2026-08-29");
  assert.equal(list[0].score, 74, "同一天该以最后那次为准");
  // 满 90 天砍最旧的
  let big = [];
  for (let i = 0; i < 120; i++) big = P.phoneVitalMerge(big, { day: "2026-" + String(1 + Math.floor(i / 28)).padStart(2, "0") + "-" + String(1 + i % 28).padStart(2, "0"), score: 50, marks: {} });
  assert.equal(big.length, P.PHONE_VITAL_DAYS);
  assert.deepEqual(P.phoneVitalMerge(null, null), []);
});

// v59.44 起健康是【两层】的（她 2026-09-01 把 perspective 换成了大夫的诊断）：
// 病历夹累积，其余照旧每次重写。这一条钉的就是那条界线——**只有 visits 一栏可以攒**。
test("只有病历夹攒着，报告本身照旧每次重写", () => {
  assert.deepEqual(Object.keys(P.PHONE_GROW.health || {}), ["visits"], "健康累积的不止病历夹那一栏");
  ["cards", "timeline", "since", "tail"].forEach(f =>
    assert.ok(!(P.PHONE_GROW.health || {})[f], f + " 被做成累积了——它说的是今天身上什么样，不是发生过什么"));
  assert.match(phoneSrc, /其余全部（cards \/ timeline \/ since \/ tail）→ ♻️ 照旧每次重写/);
});

// ── 每周一次的例行刷新 ──────────────────────────────────────

test("周从周一起算，跟她说的「周一 0:00」对齐", () => {
  const W = new Function(phoneSrc + "; return { phoneWeekKey, PHONE_WEEKLY_HINT };")();
  const mon = new Date(2026, 7, 24, 0, 0).getTime();   // 周一
  const sun = new Date(2026, 7, 30, 23, 59).getTime(); // 同一周的周日
  const nextMon = new Date(2026, 7, 31, 0, 1).getTime();
  assert.equal(W.phoneWeekKey(mon), W.phoneWeekKey(sun), "周一到周日必须算同一周");
  assert.notEqual(W.phoneWeekKey(sun), W.phoneWeekKey(nextMon), "跨到周一就该是新的一周");
});

test("例行刷新要告诉模型时间窗是「过去这一周」", () => {
  const W = new Function(phoneSrc + "; return { phoneProbeSpec, PHONE_WEEKLY_HINT };")();
  const weekly = W.phoneProbeSpec("notes", char, [], "", [], null, null, true).instruction;
  const manual = W.phoneProbeSpec("notes", char, [], "", [], null, null, false).instruction;
  assert.match(weekly, /过去这一周/);
  assert.match(weekly, /不是从头再编一遍他这个人/);
  assert.ok(manual.indexOf("过去这一周") < 0, "手动刷不该带这一段");
});
