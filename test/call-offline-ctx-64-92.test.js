// 她 2026-09-06 两报：
// ①「语音视频聊天好像不挂进上下文」——打完电话回到聊天，他跟没打过一样；
// ②「我之前改了一下线上线下聊天互通好像线下的部分也不进上下文了」——
//    一按收线，整场线下当场从上下文里消失。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// v64.99 起通话被 expandCall 摊平成一条条了，这一支只剩给【没存转录的老通话】兜底
test("没存转录的老通话，退回那句小结", () => {
  // 病根：那条气泡的 content 只有标签，通话里说了什么全在 sum，而 sum 从来没人读
  assert.match(app, /const bubble = \{ role: "system", kind: "callend"[\s\S]{0,200}content: label/, "写入方变了，这条得重看");
  assert.match(app, /\{ \.\.\.x, sum \}/, "小结那一栏没了");
  assert.match(app, /: \(m\.kind === "callend"\)/, "读的时候还是照普通消息渲染");
  assert.match(app, /\+ \(m\.sum \? String\(m\.sum\)\.trim\(\) : String\(body \|\| ""\)\.trim\(\)\)/, "没有小结时该退回标签，别空着");
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
