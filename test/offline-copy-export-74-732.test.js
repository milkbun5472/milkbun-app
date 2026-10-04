// 线下：单轮可以复制 + 全部记录可以导出（她 2026-10-03）
//
// 她原话：「线下单轮可以复制，然后可以线下全部记录可以导出」。
//
// 两件都不许另起一套：
//   · 复制只有 components.js 的 copyText 那一支（新接口 → execCommand 老路）
//   · 写文件只有 engine.js 的 saveTextFile 那一支（它管 iOS 壳和浏览器两条路）
// 导的是【纯文本】不是 json：她要的是能读、能存、能发给别人的那一份；
//   拿去再导回来的那种整包存档走「设置 → 数据 → 导出全部数据」，那一份本来就含线下。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync("js/components.js", "utf8");
const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const CARD = live.slice(live.indexOf("function OffCard({"), live.indexOf("function GroupOfflineMode({", live.indexOf("function OffCard({")));
const HIST = live.slice(live.indexOf("function offlineSessionsText("), live.indexOf("function OfflineSetupStyleSection"));

test("① 每一轮卡片上有「复制」，走公共那一支", () => {
  assert.match(CARD, /const copyOne = \(\) => copyText\(String\(m\.content \|\| ""\)\.trim\(\)\)/, "没接 copyText，或者又自己写了一份");
  assert.match(CARD, /h\(CGlyph, \{ k: "copy", size: 15/, "图标没用长按菜单那张同一个");
  assert.match(CARD, /title: "复制这一轮"/, "没有这颗按钮");
  // 排在最前：它最无害，不该挨着「删除」等着误触
  const i = CARD.indexOf('title: "复制这一轮"'), j = CARD.indexOf('onDelete(m.id), "删除"');
  assert.ok(i > 0 && j > i, "复制排在删除后面了");
});

test("② 导出走 saveTextFile，导的是能读的纯文本", () => {
  assert.match(HIST, /saveTextFile\(\(who \|\| "线下"\) \+ "-线下记录\.txt", txt, "text\/plain"\)/, "没走公共那一支写文件");
  assert.ok(!/JSON\.stringify/.test(HIST), "导成 json 了——那不是她要的那一份");
  assert.match(HIST, /h\("button", \{ onClick: exportAll/, "没有「导出全部」这颗");
});

test("③ 「全部」是真的全部：正在演的那一场也算", () => {
  assert.match(HIST, /const past = \(sessions \|\| \[\]\)\.filter\(s => s && \(s\.msgs \|\| \[\]\)\.length\)/,
    "只导已经结束的那些，正在演的这一场漏了");
  assert.match(HIST, /\.sort\(\(a, b\) => \(a\.startTs \|\| 0\) - \(b\.startTs \|\| 0\)\)/, "没按时间顺着排");
  assert.match(HIST, /s\.endTs \? "" : "（还没结束）"/, "没标出哪一场还没结束");
  // 往期是空的、但正开着一场时，这一块也得出现（不然那一场导不出来）
  assert.match(HIST, /if \(!past\.length && !hasAny\) return null;/, "正开着一场却整块不显示");
});

test("④ 群线下按人署名，不是一律写群名", () => {
  assert.match(HIST, /members && m\.senderId \? members\.find\(x => x && x\.id === m\.senderId\)/,
    "群里好几个人，导出来会全挂同一个名字");
  assert.match(HIST, /m\.role === "narration" \? "旁白"/, "旁白没单独标出来");
  assert.match(live, /onDelSession, who: gName, members \}/, "群线下那一处没把 members 递下去");
});

test("⑤ 开场白和总结都带上，不然读起来缺一截", () => {
  assert.match(HIST, /if \(s\.opening\) head\.push\("【开场】"/, "开场白丢了");
  assert.match(HIST, /s\.summary \? \["【这一场后来被总结成】"/, "总结丢了");
});
