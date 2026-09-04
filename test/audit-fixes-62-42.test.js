// v62.42 审计修复第一批（AUDIT-REPORT-2026-09-04）：群通话补层+记忆围栏；四个无封顶日志加盖
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("群通话：记忆走 splitGroupMemories 分流，不再只按 people[0] 全群共享", () => {
  const seg = src.slice(src.indexOf("// 群通话：多角色你一言我一语"), src.indexOf("const raw = await callAI(active, sys, hist, { maxTokens: 10400 })"));
  assert.match(seg, /const gcSplit = splitGroupMemories\(/);
  assert.match(seg, /gcSplit\.perChar\[String\(c\.id\)\]/);
  assert.doesNotMatch(seg, /retrieveMemories\(memLibRef\.current, people\[0\]/);
});

test("群通话：五层补齐（长出来的自我/A情绪/随身物/我们的档案/印象卡）+ 用户人设块", () => {
  const seg = src.slice(src.indexOf("// 群通话：多角色你一言我一语"), src.indexOf("const raw = await callAI(active, sys, hist, { maxTokens: 10400 })"));
  assert.match(seg, /HeartKit\.personaText/);
  assert.match(seg, /aMoodTextOf\(c\.id\)/);
  assert.match(seg, /carryContextText/);
  assert.match(seg, /coupleArchiveBlock/);
  assert.match(seg, /window\.Gaze/);
  assert.match(seg, /【和大家通话的人/);
});

test("四个自动日志全部封顶：朋友圈/论坛NPC总量/匿名箱三处/搜索帖走同一道闸", () => {
  assert.match(src, /const MOMENTS_CAP = 240/);
  assert.match(src, /FORUM_NPC_TOTAL_CAP = 240/);
  assert.equal((src.match(/records: \[[^\n]*\.slice\(0, 200\)/g) || []).length >= 2, true);
  assert.match(src, /appendForumPosts\(recs, board\); \/\/ v62\.42/);
});

test("淘汰帖子时孤儿评论一起清", () => {
  const seg = src.slice(src.indexOf("const appendForumPosts"), src.indexOf("// 版块刷新"));
  assert.match(seg, /setForumComments\(fc => \{/);
  assert.match(seg, /if \(!kill\.has\(pid\)\) keep\[pid\] = fc\[pid\]/);
});
