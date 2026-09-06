// 她 2026-09-06 两报：
// ①「语音视频聊天好像不挂进上下文」——打完电话回到聊天，他跟没打过一样；
// ②「我之前改了一下线上线下聊天互通好像线下的部分也不进上下文了」——
//    一按收线，整场线下当场从上下文里消失。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("通话回执带的是小结 + 近期原文，不是「已结束·时长 02:01」", () => {
  // 病根：那条气泡的 content 只有标签，通话里说了什么全在 sum，而 sum 从来没人读
  assert.match(app, /const bubble = \{ role: "system", kind: "callend"[\s\S]{0,200}content: label/, "写入方变了，这条得重看");
  assert.match(app, /\{ \.\.\.x, sum \}/, "小结那一栏没了");
  assert.match(app, /const line = \(m\.kind === "callend"\)/, "读的时候还是照普通消息渲染");
  assert.match(app, /\+ \(m\.sum \? String\(m\.sum\)\.trim\(\) \+ "\\n" : ""\)\s*\n\s*\+ callLogText\(m, uName, char\.name\)/, "没把原文接上");
  // ⚠️她 2026-09-06 追的：「他电话里说我们下次去 xxx 结束了就忘了」——
  //   小结是一两句概括，那句约定多半被概括掉了。所以近期那几通挂原文。
  assert.match(app, /const CALL_VERBATIM_MS = 24 \* 3600000, CALL_LOG_CAP = 1200;/, "没有原文那一层");
  assert.match(app, /if \(!log\.length \|\| Date\.now\(\) - \(m\.ts \|\| 0\) > CALL_VERBATIM_MS\) return "";/, "老通话也一律给原文——预算会被吃光");
  assert.match(app, /x\.act \? "（" \+ who \+ " " \+ String\(x\.content\)\.trim\(\) \+ "）"/, "视频里的动作行丢了");
  assert.match(app, /if \(n > CALL_LOG_CAP && out\.length\) \{ out\.unshift\("…（前面还说了几句）"\); break; \}/, "没封顶");
  assert.match(app, /"【" \+ \(m\.callMode === "video" \? "视频通话" : "语音通话"\) \+ "·刚打完】"/, "看不出这段是电话里发生的");
});

test("刚收线的那场线下照样算最近发生的事", () => {
  const i = app.indexOf("const newest = (list || []).find(s => s && (s.msgs || []).length > 0);");
  assert.ok(i > 0, "还在只找没结束的那一场");
  const blk = app.slice(i, i + 600);
  // 结束得还近才带——三周前那场不该压在今天的上下文里，那是记忆库的活
  assert.match(blk, /const offFloor = Math\.max\(0, Number\(memCfgRef\.current\.recentDays \?\? 3\)\) \* 86400000;/, "没有新鲜度这道闸");
  assert.match(blk, /!newest\.endTs \|\| \(offFloor && Date\.now\(\) - newest\.endTs <= offFloor\)/, "闸的判据不对");
  // 跟聊天记录用同一根拉条，不另拍一个数
  assert.match(app, /const recentDays = Math\.max\(0, Number\(memCfgRef\.current\.recentDays \?\? 3\)\);/, "两处各拍各的数了");
});

test("带进来了就得说清它已经散了", () => {
  assert.match(app, /if \(offEnded && offSlice\.length\) rendered\.unshift\("（下面掺在里头的【线下】那几段是刚结束的那一场，已经散了/,
    "不说的话他会以为你俩还面对面站着");
  // 「有一场没散的线下」那一层照旧只认没结束的，别让它跟着说谎
  assert.match(app, /const s = \(list \|\| \[\]\)\.find\(x => x && !x\.endTs && \(x\.msgs \|\| \[\]\)\.length > 0\);/,
    "offlineActiveFor 也放行了已结束的——那会说成「你们正在一块儿」");
  assert.match(app, /offEnded = !!\(active && active\.endTs\);/, "没记下它是不是已经结束");
});

// 她 2026-09-06 追的第三件：「语音和视频聊天是不是也得更新一下心声卡」
// ——挂了电话他的心情/在哪/在干嘛/心里那句全停在通话之前。
test("一对一通话挂完顺手刷状态卡，走的是聊天那个出口", () => {
  assert.match(app, /const solo = \(!cur\.groupId && cur\.participants\.length === 1\) \? cur\.participants\[0\] : null;/, "没分出一对一那一支");
  // 站位：原来这一枪是光秃秃的归档 sys，人设/心情/记忆一层都没有；心声尤其不能用分析师的椅子写
  assert.match(app, /d = await runProbe\(bgActiveRef\.current, ctxFor\(solo\), \{\s*\n\s*voice: true,/, "还是那把分析师的椅子");
  assert.match(app, /thought 你心里那一句（第一人称，你自己的话，不是总结）/, "心声那一栏没说清是第一人称");
  // 写状态走跟聊天同一条路，不另写一条
  assert.match(app, /setStateFor\(solo\.id, ns\);\s*\n\s*pushStateHist\(solo\.id, ns\);/, "另写了一条写状态的路");
  assert.match(app, /\["thought", "place", "action", "wearing", "condition"\]\.forEach/, "该刷的几栏不全");
  assert.match(app, /if \(st\.thought\) st\.thoughtUpdatedAt = Date\.now\(\);/, "心声没盖时间戳——那它会被当成过期的");
  // 群通话不刷：一枪刷不动好几张卡，硬刷会把别人的心情写歪
  assert.match(app, /群通话不刷/, "没写清为什么群不刷");
  assert.match(app, /const sys = "把这通『" \+ uN/, "群那条归档路被顺手删了");
});
