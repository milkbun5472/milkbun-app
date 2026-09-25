// 她 2026-09-24：一起学「让他也可以发文件过来」——老师递讲义／小抄／练习
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const fn = name => { const i = src.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return src.slice(i, src.indexOf("\n  }\n", i) + 4); };

test("老师说要给才出卡；kind 只认三种，没标题没内容不出", () => {
  const ctx = { JSON, String, extractJSON: r => { try { return JSON.parse(r); } catch (e) { return null; } } };
  vm.createContext(ctx);
  vm.runInContext(fn("parseHandout") + "\nthis.p = parseHandout;", ctx);
  assert.equal(ctx.p(JSON.stringify({ say: ["x"] })), null);
  assert.equal(ctx.p(JSON.stringify({ handout: { kind: "小抄", title: "", focus: "" } })), null);
  const h = ctx.p(JSON.stringify({ handout: { kind: "随便", title: "て形", focus: "收一页" } }));
  assert.equal(h.kind, "讲义");
  assert.equal(h.title, "て形");
});

test("正文另写一枪：料在 system、user 一句话、上限开满；题卡和出格式那几条不带进去", () => {
  const g = fn("genHandout");
  assert.match(g, /callAI\(active, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 65535 \}\)/);
  assert.match(g, /\.replace\(OUT_FMT, ""\)\.replace\(QUIZ_CARD_FMT, ""\)/);
  assert.match(g, /\.replace\(HANDOUT_FMT, ""\)/);
});

test("只有老师（和一起研究的同伴）能递；三人课堂的同学不行", () => {
  assert.match(fn("buildStudyPrompt"), /if \(mode === "teach" \|\| mode === "nv1-teacher" \|\| \(mode === "costudy" && session\.mode === "costudy"\)\) parts\.push\(HANDOUT_FMT\);/);
  assert.match(src, /handout: role === "nv1-peer" \? null : parseHandout\(raw\)/);
  assert.match(src, /if \(res && res\.handout && role !== "nv1-peer"\)/);
});

test("卡先落、正文不堵这一轮；写坏了能点着重写；收进资料和她传的文件走同一处", () => {
  assert.match(src, /writeHandout\(hoId, char, role\);   \/\/ 不等它/);
  assert.match(src, /else if \(failed\) writeHandout\(m\.id, who, role\)/);
  assert.match(src, /await saveMaterialText\(props\.curId, ho\.title \|\| ho\.kind, "handout", ho\.body\)/);
  assert.match(fn("addMaterial"), /return saveMaterialText\(curId,/);
  assert.match(src, /await saveTextFile\(/);
});
