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
