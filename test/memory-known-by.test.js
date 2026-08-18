const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const cloud = fs.readFileSync(path.join(root, "js/cloud.js"), "utf8");
const sql = fs.readFileSync(path.join(root, "supabase/memories.sql"), "utf8");

// 记忆可见性 V1（2026-08-18，Codex 裁决）。三态必须端到端分得开：
//   undefined = 旧数据走旧规则 / [] = 仅用户知道 / [A] = A 知道
test("known_by 三态在本地、云端与建表里都不许被压平", () => {
  assert.match(sql, /known_by text\[\] null/, "列必须可空，不能 not null default '{}'");
  // 只看真正的 DDL 行，注释里出现「绝不能 not null」不算
  const ddl = sql.split("\n").filter(l => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(ddl, /known_by[^\n]*not null/i);
  assert.doesNotMatch(ddl, /known_by[^\n]*default/i, "也不能给默认值，默认值会把 legacy 变成 user-only");
  assert.match(cloud, /known_by: Array\.isArray\(e\.knownBy\) \? e\.knownBy\.map\(String\) : null/,
    "上行：不是数组就写 NULL，不能兜成 []");
  assert.match(app, /knownBy: Array\.isArray\(r\.known_by\) \? r\.known_by\.map\(String\) : undefined/,
    "下行：NULL/缺失要保持 undefined，不能学 charIds 兜成 []");
  assert.match(cloud, /id,text,tags,char_ids,known_by,/, "select 列表要带上 known_by，否则永远读不回来");
});

test("可见性过滤排在置顶与打分之前，且置顶绕不过权限", () => {
  const seg = engine.slice(engine.indexOf("function retrieveMemories"), engine.indexOf("function retrieveMemories") + 1600);
  assert.match(seg, /const canSee = e => Array\.isArray\(e\.knownBy\)/);
  assert.ok(seg.indexOf("canSee") < seg.indexOf("e.pinned"), "过滤必须在取置顶之前");
  // 语义（用最小实现复刻同一条规则）
  const canSee = (e, id) => Array.isArray(e.knownBy)
    ? e.knownBy.indexOf(id) > -1
    : (!e.charIds || e.charIds.length === 0 || e.charIds.includes(id));
  assert.equal(canSee({ charIds: [] }, "A"), true, "旧数据 charIds 空＝全员");
  assert.equal(canSee({ charIds: ["B"] }, "A"), false);
  assert.equal(canSee({ charIds: ["B"], knownBy: [] }, "B"), false, "空数组＝仅用户，本人也召不回");
  assert.equal(canSee({ charIds: ["C"], knownBy: ["A"] }, "A"), true);
  // 「用户单独跟 A 吐槽 C」——C 绝不能召回到
  assert.equal(canSee({ charIds: ["C"], knownBy: ["A"] }, "C"), false);
  assert.equal(canSee({ charIds: ["C"], knownBy: ["A"], pinned: true }, "C"), false, "置顶也不能绕过");
});

test("新写入必须显式带受众，群聊用当时的成员快照", () => {
  assert.match(app, /tags: \["线下"\], charIds: \[charId\], knownBy: \[charId\]/);
  assert.match(app, /knownBy: memberIds\.slice\(\)/, "群线下用进入这轮时取的成员，不是写入时的当前成员");
  assert.match(app, /knownBy: \(group\.memberIds \|\| \[\]\)\.slice\(\)/);
  assert.match(app, /knownBy: cur\.participants\.map\(c => c\.id\)/, "通话用当时的参与者");
  assert.ok((app.match(/knownBy:/g) || []).length >= 18, "写入点覆盖要够广");
});

test("迁移先只读审计，不自动回填", () => {
  assert.match(app, /window\.__knownByAudit = function \(\)/);
  assert.match(app, /仍是legacy/);
  assert.doesNotMatch(app, /knownBy = e\.charIds/, "不许把旧 charIds 一把梭复制成 knownBy");
});

// v53.61：群聊里的可见性。她 2026-08-18 提的那个场景——
// 「A 受伤了告诉我但是没有告诉 B，在群聊不应该默认 B 知道」。
test("群聊记忆按在场成员的可见交集分流，不再拿一个人的可见结果当全群公共记忆", () => {
  const seg = engine.slice(engine.indexOf("function splitGroupMemories"),
    engine.indexOf("function splitGroupMemories") + 2200);
  assert.ok(seg, "engine 必须有 splitGroupMemories");
  assert.match(seg, /audience\.length === ids\.length/, "只有全员都看得见才进公共段");
  assert.match(seg, /audience\.forEach\(id => perChar\[id\]\.push\(entry\)\)/, "其余的落进各自私密段");

  // 语义复刻：A、B 在群里，一条只有 A 知道的记忆
  const canSee = (e, id) => Array.isArray(e.knownBy)
    ? e.knownBy.indexOf(id) > -1
    : (!e.charIds || e.charIds.length === 0 || e.charIds.includes(id));
  const ids = ["A", "B"];
  const hurt = { id: "m1", text: "A 手腕受伤了", charIds: ["A"], knownBy: ["A"] };
  const both = { id: "m2", text: "三个人一起吃过火锅", charIds: [], knownBy: ["A", "B"] };
  const audOf = e => ids.filter(id => canSee(e, id));
  assert.deepEqual(audOf(hurt), ["A"], "受伤这条只有 A 是受众");
  assert.notEqual(audOf(hurt).length, ids.length, "所以它绝不能进全群公共段");
  assert.deepEqual(audOf(both), ["A", "B"], "全员都知道的才进公共段");
});

test("线上群与群线下都改用分流，不再用 members[0] 的身份代表全群", () => {
  assert.doesNotMatch(app, /retrieveMemories\(memLibRef\.current, members\[0\]/,
    "线上群不许再拿第一个成员的可见结果当公共记忆");
  assert.match(app, /const gSplit = splitGroupMemories\(memLibRef\.current, members\.map\(c => c\.id\), hist/);
  assert.match(app, /const groupMem = formatMemLib\(gSplit\.shared\)/);
  assert.match(app, /只有 " \+ c\.name \+ " 知道】的事/, "私有条目要落进本人那段并标明别人不知情");
  assert.match(app, /return splitGroupMemories\(memLibRef\.current, group\.memberIds \|\| \[\], qtext/,
    "群线下同样走分流");
  assert.match(app, /const picked = memSplit\.shared;/, "群线下的公共记忆只取 shared");
  // 向量预热必须排在召回之前，否则分流那次召回退化成纯关键词
  assert.ok(app.indexOf("await primeQueryVec(hist)") < app.indexOf("const gSplit = splitGroupMemories"),
    "primeQueryVec 要在 splitGroupMemories 之前");
});
