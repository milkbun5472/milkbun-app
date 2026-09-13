// 她 2026-09-13：「50、3 天都是设置可以改的对吧，但是 40 是钉死的」——是真的。
// 线上那半（几条、几天、几个字、跨情境那两根）全是拉条，线下那半一根都没有：
// 回看 40 拍、最近 3 拍给原文，全钉在代码里。
//
// 跨情境那两根同样是「防挤占」的闸，照样给了她；同一层规矩不该在两处长成两副面孔。
// ⚠️只放这两根：「摘录留 70 字」和「线下最多占三成预算」留在代码里——那是【怎么压】的
//   手艺，不是她需要天天拧的旋钮（旋钮多了每一根都变得不值钱）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("两根新拉条有默认值，而且跟老默认一模一样（老存档不变味）", () => {
  const m = app.match(/const MEM_CFG_DEFAULT = \{([^}]*)\}/);
  assert.ok(m, "找不到 MEM_CFG_DEFAULT");
  assert.match(m[1], /offBeats: 40/);
  assert.match(m[1], /offVerbatim: 3/);
  // 界面那头的兜底默认值要跟它对得上——两处不一样就是「改了设置才变」那种怪事
  assert.match(screens, /crossBudget: 800, offBeats: 40, offVerbatim: 3 \}, cfg \|\| \{\}\)/);
});

test("拼上下文那一处真的去读它了，没读到就落回老数字", () => {
  assert.match(app, /const OFF_BEATS = Math\.max\(1, Number\(memCfgRef\.current\.offBeats \?\? 40\)\);/);
  assert.match(app, /const OFF_VERBATIM = Math\.max\(1, Number\(memCfgRef\.current\.offVerbatim \?\? 3\)\)/);
  // ⚠️地板 1：拉到 0 会变成「一拍都不带」「一拍原文都没有」，那不是旋钮，是关掉功能
  assert.ok(!/const OFF_BEATS = 40;/.test(app), "还钉着一个 40");
  assert.ok(!/const OFF_VERBATIM = 3,/.test(app), "还钉着一个 3");
});

test("留在代码里的那两样【没有】跟着变成拉条", () => {
  assert.match(app, /OFF_EXCERPT = 70;/, "摘录字数被顺手做成拉条了");
  assert.match(app, /const offCap = Math\.min\(Math\.round\(budget \* 0\.3\), 3000\);/, "三成封顶被顺手做成拉条了");
  assert.ok(!/offExcerpt|offCapCfg/.test(screens), "召回设置里多出了不该给的旋钮");
});

test("拉条长在召回设置里，范围和说明都对得上", () => {
  assert.match(screens, /slider\("线下回看几拍", c\.offBeats != null \? c\.offBeats : 40, 10, 120, 5, " 拍"/);
  assert.match(screens, /slider\("线下最近几拍给原文", c\.offVerbatim != null \? c\.offVerbatim : 3, 1, 10, 1, " 拍"/);
  // 说明里要写清楚拉大了也挤不到聊天头上——那正是当初不敢给拉条的顾虑
  assert.match(screens, /线下再多也最多占走短期窗预算的三成，挤不到聊天头上/);
  assert.match(screens, /再往前由本场滚动摘要和记忆库兜底/);
  // 纯英文标题一个都不许有（施工规则/no-english-titles.md）
  assert.ok(!/slider\("[A-Za-z ]+"/.test(screens.slice(screens.indexOf('slider("线下回看几拍'), screens.indexOf('"保存"'))));
});

// 真跑：把拼上下文那一段抠出来（跟 test/offline-context-budget.test.js 同一个办法），
// 只是这一次把两根拉条真的拧一拧，看带进来的东西跟着变没有。
const recent = (() => {
  const i = app.indexOf("      const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));");
  const j = app.indexOf("      lines.reverse();", i);
  assert.ok(i > 0 && j > i, "recentChat 那段没了");
  const body = app.slice(i, j) + "      return { lines: lines.slice().reverse(), used, usedOff };";
  return (offline, cfg) => new Function(
    "online", "offline", "offSummary", "settingsFor", "char", "profile", "memCfgRef", "window", "thinOnline", "userName",
    body)([], offline, "", () => ({}), { id: "c", name: "他" }, { name: "Lisa" },
      { current: Object.assign({ recentBudget: 16000, recentDays: 0 }, cfg) }, {}, false, () => "Lisa");
})();
// ⚠️拍子要够长、够多：摘录那一步【只在线下装不下自己那份限额时】才启动
//   （装得下就全给原文——那是对的）。所以桩得照真实的长线下来给：一拍两三百字。
const beats = n => Array.from({ length: n }, (_, k) => ({
  role: k % 2 ? "user" : "assistant", _surface: "offline", ts: 1000 + k,
  content: k + "号拍：他把伞收起来，靠在门边，雨水顺着伞骨滴在地砖上，积成小小一滩。"
    + "「" + k + "，你怎么才来。」" + "他没抬头，声音压得很低，像是怕惊动什么。".repeat(6)
    + "外头的雨还在下。"
}));

test("拧一拧真的算数：回看几拍、几拍给原文，都跟着变", () => {
  // ① 回看几拍：拉到 10 就只带最后 10 拍，拉到 80 就带得更多
  const shortBeats = n => Array.from({ length: n }, (_, k) => ({
    role: k % 2 ? "user" : "assistant", _surface: "offline", ts: 3000 + k, content: k + "号拍：嗯。"
  }));
  const few = recent(shortBeats(60), { offBeats: 10 });
  const many = recent(shortBeats(60), { offBeats: 80 });
  assert.equal(few.lines.length, 10, "「线下回看几拍」拧了没反应");
  assert.ok(many.lines.length > few.lines.length, "拉大了反而没多带：" + many.lines.length);
  assert.ok(few.lines[0].indexOf("50号拍") >= 0, "带的不是最后那几拍");

  // ② 几拍给原文：原文那几拍带着后半句，摘录那几拍只留台词那一截
  const v1 = recent(beats(30), { offVerbatim: 1 });
  const v8 = recent(beats(30), { offVerbatim: 8 });
  const full = l => l.indexOf("外头的雨还在下") >= 0;
  assert.ok(v8.lines.filter(full).length > v1.lines.filter(full).length,
    "「最近几拍给原文」拧了没反应：" + v1.lines.filter(full).length + " vs " + v8.lines.filter(full).length);

  // ③ 读不到设置（老存档）＝还是原来那两个数。
  //    ⚠️这一条要用短拍子量：长拍子会先撞上线下那份字数限额（三成/封顶 3000），
  //      那时候拍数是被预算卡住的，量不出「默认几拍」这件事。
  const short = n => Array.from({ length: n }, (_, k) => ({
    role: k % 2 ? "user" : "assistant", _surface: "offline", ts: 2000 + k, content: k + "号拍：嗯。"
  }));
  assert.equal(recent(short(60), {}).lines.length, 40, "老存档的默认不再是 40 拍了");
  assert.equal(recent(short(60), { offBeats: 15 }).lines.length, 15);

  // ④ 拉到底也挤不到聊天头上：线下那份限额还在（三成 / 封顶 3000）
  assert.ok(recent(beats(60), { offBeats: 120 }).usedOff <= 3000, "拉大之后线下把预算吃穿了");
});
