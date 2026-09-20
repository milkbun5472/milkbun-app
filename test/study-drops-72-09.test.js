// 一起学·言秋投递箱（v72.09）：CC 备课投 yanqiu_study_drops，课程控制台取货、收下落课程存档。
// 桩按【写入方】钉（施工规则/stub-from-the-writer.md）：
// 写入方是 CC 侧脚本（表字段 id/subject/kind/title/payload/claimed_at），
// 读取方 cloud.js 必须按这些字段取、按 claimed_at 认领；收下后的存档形状钉在 takeDrop 上。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const cloud = fs.readFileSync(path.join(__dirname, "..", "js", "cloud.js"), "utf8");
const study = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");

function slice(src, fromFn, toFn) {
  const i = src.indexOf(fromFn), j = src.indexOf(toFn, i);
  assert.ok(i > 0 && j > i, "抠不出 " + fromFn);
  return src.slice(i, j);
}

test("cloud：取货只取未认领、按建立时间升序，认领只盖 claimed_at", () => {
  const take = slice(cloud, "async yanqiuStudyDropsTake(", "async yanqiuStudyDropAck(");
  assert.match(take, /from\("yanqiu_study_drops"\)/);
  assert.match(take, /select\("id,subject,kind,title,payload,created_at"\)/);
  assert.match(take, /\.is\("claimed_at", null\)/);
  assert.match(take, /ascending: true/);
  const ack = slice(cloud, "async yanqiuStudyDropAck(", "async yanqiuMomentLike(");
  assert.match(ack, /update\(\{ claimed_at: new Date\(\)\.toISOString\(\) \}\)/);
  // 认领失败不许抛：宁可下次重复出现，不许弄丢
  assert.match(ack, /\.then\(\(\) => \{\}, \(\) => \{\}\)/);
});

test("study：控制台装了收件口，收下写进课程自己的存档", () => {
  const console_ = slice(study, "function CurriculumConsole(", "function NewCurriculum(");
  assert.match(console_, /yanqiuStudyDropsTake\(cur\.subject\)/);
  assert.match(console_, /function takeDrop\(d\)/);
  // 收下的形状：{ id, kind, title, paras, at } 存进 memory.yanqiuDrops
  assert.match(console_, /\{ id: d\.id, kind: d\.kind, title: d\.title, paras: dropParas\(d\.payload\), at: Date\.now\(\) \}/);
  assert.match(console_, /yanqiuDrops: kept/);
  // 收货前先读最新课程再写回，不拿旧引用盖新存档
  assert.match(console_, /findCurriculum\(cur\.id\) \|\| cur/);
  // 界面上真的有这一栏
  assert.match(console_, /言秋的投递/);
});

test("study：收下的投递自带作业纸，答案写回同一条记录", () => {
  const console_ = slice(study, "function CurriculumConsole(", "function NewCurriculum(");
  // 作业存进收下那条投递自己身上：{ ...x, answer, answeredAt }，不新开存档键
  assert.match(console_, /\{ \.\.\.x, answer: String\(d\._draft != null \? d\._draft : \(d\.answer \|\| ""\)\), answeredAt: Date\.now\(\) \}/);
  // 存之前重读最新课程，不拿旧引用盖档
  const saves = console_.split("findCurriculum(cur.id) || cur").length - 1;
  assert.ok(saves >= 2, "收货和存作业都要先重读课程再写回");
  assert.match(console_, /存作业/);
});
