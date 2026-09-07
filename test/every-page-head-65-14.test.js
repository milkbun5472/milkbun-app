// 她 2026-09-06：「继续把主题工作室每一个页面都弄好可以正常挂 css 吧」。
//
// ⚠️病根跟文风台那次一样：主题工作台里能挑的每一页，页面 CSS 都靠 data-wk 挂点抓东西；
//   而【自己手写了一条顶栏】的页面身上一个挂点都没有——写给那一页的 CSS 一条都不生效。
//   v65.14 把它们逐页处理完了，两条路各有各的判据：
//     · 形状本来就是「返回＋居中标题＋右侧操作位」的 → 换成共用 Head（顺带合规
//       施工规则/mobile-ui-layout.md §1，返回键也从十几像素的字符变成 46×34）；
//     · 形状是【故意的】（淘宝搜索栏、周刊刊头、日历「‹2026年」、擂台赛况、
//       信纸落款、查手机里扮成微信/相册的那些）→ 只加属性，长相一个像素不动。
//
// 这份测试盯的是【别再退回去】：新写一条顶栏而不挂任何点，这里当场红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = f => fs.readFileSync(path.join(root, f), "utf8");

// 顶栏的签名：自己吃刘海（paddingTop: safeTop(…)）。
// 允许不挂的，只有【压根不是顶栏】的那几处，一处一个理由。
// ⚠️认的是【那一行代码长什么样】，不是行号：别人在上面加两行，行号就全错位了
//   （这份测试自己第一版就是拿行号写的，一次 rebase 之后当场误报）。
const NOT_A_BAR = [
  ["js/components.js", 'paddingTop: safeTop(8),', "Head 自己（挂点就长在它身上）"],
  ["js/components.js", 'return Object.assign({ paddingTop: safeTop(0) },', "一个算 padding 的工具函数，不是元素"],
  ["js/phone.js", 'h("div", { className: "shrink-0 px-6", style: { paddingTop: safeTop(30) } },', "查手机锁屏上那块大时钟，不是顶栏"],
  ["js/phone.js", 'aspectRatio: "16 / 9"', "视频封面那一格（返回键浮在图上，不是一条栏）"],
  ["js/yanqiu.js", 'paddingTop: safeTop(10)', "言秋的文件，不归这个窗口动（界面装修工单里也这么记着）"]
];

test("凡是自己吃刘海的那一条，都得挂得住", () => {
  const bad = [];
  fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js")).forEach(f => {
    const lines = R("js/" + f).split("\n");
    lines.forEach((l, i) => {
      if (!/paddingTop: safeTop\(|padding: `\$\{safeTop\(/.test(l)) return;
      // ⚠️挂点常常写在同一个对象字面量的【上面几行】（style 是多行摊开的），
      //   只看当前这一行会把已经挂好的判成没挂。
      if (lines.slice(Math.max(0, i - 6), i + 1).some(x => x.indexOf("data-wk") >= 0)) return;
      const at = "js/" + f + ":" + (i + 1);
      if (NOT_A_BAR.some(x => x[0] === "js/" + f && l.indexOf(x[1]) >= 0)) return;
      bad.push(at + "  " + l.trim().slice(0, 90));
    });
  });
  assert.deepEqual(bad, [], "这几条顶栏没有任何挂点，页面 CSS 抓不到它们：\n  " + bad.join("\n  "));
});

test("换成共用 Head 的那几页，是真的换了", () => {
  // ⚠️桩钉在【画它那一头】：谁哪天改回手写，这条当场红。
  const want = [
    ["js/dwell.js", /h\(Head, \{ zh: title, sub: sub, onBack: back, right: right, bg: "transparent", noLine: true \}\)/, "去处"],
    ["js/dwell.js", /h\(Head, \{ zh: title, sub: sub, onBack: back, ink: OVER_INK/, "去处压在图上那一条"],
    ["js/study.js", /return h\(Head, \{\s*\n\s*zh: props\.zh, en: props\.en \|\| skin\.label,/, "一起学"],
    ["js/tarot.js", /const NightHead = \(\{ title, onBack, right \}\) => \{ const N = nightNow\(\); return h\(Head, \{/, "塔罗"],
    ["js/fanfic.js", /h\(Head, \{ zh: f\.title, sub: props\.tab\.name, onBack: props\.onBack/, "同人文·读一篇"],
    ["js/fanfic.js", /h\(Head, \{ zh: view === "shelf" \? "书架" : "同人文"/, "同人文·书架"],
    ["js/weekly.js", /return h\(Head, \{ zh: props\.zh \|\| "周刊", en: props\.en, onBack: props\.onBack/, "周刊内页"],
    ["js/weekly.js", /h\(Head, \{ zh: panelTitle, ink: L\.ink/, "周刊工具台"],
    ["js/impression.js", /const header = \(title, right\) => h\(Head, \{ zh: title, onBack: back/, "月度印象"],
    ["js/map.js", /h\(Head, \{ zh: "好友地图", onBack: onBack, noLine: true/, "好友地图"],
    ["js/trpg.js", /const header = \(title, right\) => h\(Head, \{ zh: title, onBack: back/, "跑团"],
    ["js/components.js", /h\(Head, \{ zh: "匿名问答", onBack: onBack, ink: A\.ink/, "匿名问答"],
    ["js/assistant.js", /h\(Head, \{ zh: "设置", onBack: props\.onBack \}\)/, "秋秋的设置"]
  ];
  want.forEach(([f, re, zh]) => assert.match(R(f), re, zh + "那一页又变回手写顶栏了"));
  // 记账那六条顶栏是同一个形状，一次全换了
  assert.equal((R("js/ledger.js").match(/h\(Head, \{ zh:/g) || []).length, 6, "记账那六条顶栏没都换过来");
  assert.ok(!/safeTop\(/.test(R("js/ledger.js")), "记账里还剩着手写顶栏");
});

test("故意保留原样的那几条，写清了为什么，而且真的只加了属性", () => {
  // ⚠️「不换 Head」是可以的，但必须写下理由——不然下一个人分不清是【有意】还是【漏了】。
  const cases = [
    ["js/screens.js", "【不换成公共 Head】，理由写在这儿：它扮的是淘宝那条搜索栏"],
    ["js/components.js", "这一条【不换成公共 Head】：它没有居中标题"],
    ["js/debate.js", "这一条【不换成公共 Head】：它没有标题"],
    ["js/weekly.js", "封面这一条【不换成 Head】：它是刊头"],
    ["js/phone.js", "查手机里这些内层 app【不换成公共 Head】"],
    ["js/screens.js", "信纸这两页【不换成公共 Head】"]
  ];
  cases.forEach(([f, why]) => assert.ok(R(f).indexOf(why) >= 0, f + " 里那条「为什么不换」的理由没了：" + why));
  // 淘宝那条搜索栏：形状没动（橙描边＋橙搜索钮还在），只是多了属性
  const sc = R("js/screens.js");
  assert.match(sc, /border: "1\.5px solid " \+ MSHOP\.orange/, "淘宝那条搜索栏被改坏了");
  assert.match(sc, /"data-wk": "head", className: "shrink-0 px-3 pb-2\.5 flex items-center gap-2"/);
});

test("线下那两条顶栏也挂上了（它们压在聊天页上，皮肤要抓得住）", () => {
  const comp = R("js/components.js");
  assert.equal((comp.match(/"data-wk": "chathead"/g) || []).length, 4,
    "单聊 / 群聊 / 单人线下 / 群线下，四条顶栏要都挂着 chathead");
});
