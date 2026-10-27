// 更新日志（她 2026-10-24：「公共版要不要搞个更新日志放设置里面，这样大家可以翻看更新过啥，
//   改提示词类型的不写」）——数据在 js/changelog-data.js，页面是设置里「新 · 更新了什么」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function loadList() { const w = {}; new Function("window", R("js/changelog-data.js"))(w); return w.QQ_CHANGELOG; }

test("日志的形状：一天一条、新的在最上面、日子不重复、每条都有字", () => {
  const list = loadList();
  assert.ok(Array.isArray(list) && list.length > 0);
  const days = list.map(x => x.d);
  days.forEach(d => assert.match(d, /^\d{4}-\d{2}-\d{2}$/, "日子要写成 2026-10-24 这样：" + d));
  assert.deepEqual(days, days.slice().sort().reverse(), "新的得在最上面");
  assert.equal(new Set(days).size, days.length, "同一天写成了两条：并进同一条");
  list.forEach(x => {
    assert.ok(Array.isArray(x.items) && x.items.length, x.d + " 一条都没有");
    x.items.forEach(it => assert.ok(typeof it === "string" && it.trim().length >= 4, x.d + " 有一条是空的"));
  });
});

test("写给用的人看的：不带施工话、不带家里才有的东西、不用破折号", () => {
  const items = loadList().flatMap(x => x.items);
  const bad = items.filter(it => /言秋|电台|配件|VPS|站长|提示词里|测试|锚点|挂点名单|——|乙游/.test(it));   // 乙游：她 2026-10-27「更新日志不要提乙游这种」
  assert.deepEqual(bad, [], "这几条不该进日志：" + bad.join(" / "));
});

test("接线：跟设置同一组懒加载；首页一行带红点；点进去是那一页", () => {
  const html = R("index.html"), scr = R("js/screens-ui.js");
  assert.match(html, /<script type="text\/lazy" data-lazy="screens" data-src="js\/changelog-data\.js\?v=/);
  assert.match(scr, /if \(clList\.length\) homeRows\.push\(\{ key: "log", char: "新", title: "更新了什么"/);
  assert.match(scr, /dot: changelogUnseen\(clList\)/);
  assert.match(scr, /page === "log" && h\(ChangelogView, \{ list: clList \}\)/);
  assert.match(scr, /log: "更新了什么"/);
  // 只摊开最新那天、先画 20 天、底下「再往前看」
  const v = scr.slice(scr.indexOf("function ChangelogView("), scr.indexOf("function ConfigMark("));
  assert.match(v, /useState\(\(\) => \(all\[0\] \? \{ \[all\[0\]\.d\]: true \} : \{\}\)\)/);
  assert.match(v, /const \[shown, setShown\] = useState\(20\);/);
  assert.match(v, /"再往前看（还有 "/);
});

test("红点：这台手机看过最新那天就不亮；本机游标用 qq_ 键", () => {
  const scr = R("js/screens-ui.js");
  const a = scr.indexOf("const CHANGELOG_SEEN"), b = scr.indexOf("function ChangelogView(");
  assert.match(scr.slice(a, b), /const CHANGELOG_SEEN = "qq_changelogSeen";/);
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const unseen = new Function("localStorage", scr.slice(a, b) + "\nreturn changelogUnseen;")(ls);
  const list = [{ d: "2026-10-24", items: ["x"] }, { d: "2026-10-23", items: ["y"] }];
  assert.equal(unseen(list), true, "从没点开过要亮");
  store.qq_changelogSeen = "2026-10-24";
  assert.equal(unseen(list), false, "看过最新那天就不亮");
  assert.equal(unseen([{ d: "2026-10-25", items: ["z"] }].concat(list)), true, "又有新的一天再亮");
  assert.equal(unseen([]), false);
});

// 她 2026-10-24「你这个也加上吧」：秋秋答得上「最近更新了啥」「某样什么时候有的」
test("秋秋：问更新时带上日志（最近五天＋沾边的旧条），不问就一个字不带", () => {
  const a = R("js/assistant.js");
  const seg = a.slice(a.indexOf("const CHANGELOG_ASK"), a.indexOf("  // ── 秋秋记着的"));
  const memGramsSrc = a.slice(a.indexOf("const memGrams = "), a.indexOf("\n", a.indexOf("const memGrams = ")));
  const w = { QQ_CHANGELOG: loadList() };
  const block = new Function("window", memGramsSrc + "\n" + seg + "\nreturn changelogBlock;")(w);
  assert.equal(block("帮我把气泡改成粉色"), "", "不问更新时不该带");
  const recent = block("最近更新了啥");
  assert.match(recent, /【更新日志/);
  assert.match(recent, /10月24日/, "最近那天没带上");
  const old = block("片刻是什么时候有的");
  assert.match(old, /10月7日 · 新 app「片刻」/, "问某样东西什么时候有的，得翻到头一回那天");
  // 接线：拼进秋秋的系统提示；日志没下好时先拉那一组
  assert.match(a, /\+ \(\(\) => \{ const cl = changelogBlock\(question\); return cl \? cl \+ "\\n\\n" : ""; \}\)\(\)/);
  assert.match(a, /if \(window\.LazyMods && !window\.QQ_CHANGELOG && CHANGELOG_ASK\.test\(String\(text \|\| ""\)\)\) await window\.LazyMods\.load\("screens"\)/);
});

// 她 2026-10-25「搞个更新日志搜索吧」
test("能搜：空格隔开的词都要沾上；搜的时候那几天全摊开、只留沾上的那几条、不出「再往前看」", () => {
  const scr = R("js/screens-ui.js");
  const v = scr.slice(scr.indexOf("function ChangelogView("), scr.indexOf("// ── 设置这一整块"));
  assert.match(v, /"data-wk": "clsearch"/);
  assert.match(v, /const words = q\.trim\(\)\.toLowerCase\(\)\.split\(\/\\s\+\/\)\.filter\(Boolean\);/);
  assert.match(v, /const hit = it => words\.every\(/);
  assert.match(v, /const on = words\.length \? true : !!open\[day\.d\];/);
  assert.match(v, /!words\.length && all\.length > shown \?/);
  const ts = R("js/theme-studio.js");
  assert.match(ts, /\["clsearch", "/); assert.match(ts, /\["clmark", "/);
});

// 她 2026-10-25「搜出来只看关键词那部分」：长的一条只摆沾上的那一小段，前面带着说的是哪样，点一下看整条
test("搜到的长条只显示关键词那一段", () => {
  const scr = R("js/screens-ui.js");
  const v = scr.slice(scr.indexOf("function ChangelogView("), scr.indexOf("// ── 设置这一整块"));
  const a = v.indexOf("const cut = (str, sep)"), b = v.indexOf("const mark = it =>");
  const mk = q => new Function("useState", "words", v.slice(a, b) + "\nreturn snippet;")(() => [{}, () => {}], q.split(" "));
  const long = "照影：答法多了排序、拍卖会、淘汰赛；做题时能敲敲 TA 说话，TA 可能改选；做完能回头改；徽章收成一行；自己做到一半能存档；做完的能发给任何人看";
  const sn = mk("徽章")(long);
  assert.equal(sn, "照影：… 徽章收成一行 …");
  assert.equal(mk("亲属卡")("亲属卡能退，TA 会对此有反应"), "亲属卡能退，TA 会对此有反应", "短的不切");
  // 括号里的「、」不切开
  const paren = "论坛小红书样式：博主主页（获赞与收藏、笔记、收藏、赞过）、发笔记先放图挑话题、首页关注发现收藏、消息三栏、评论带 IP 属地";
  assert.match(mk("赞过")(paren), /博主主页（获赞与收藏、笔记、收藏、赞过）/);
  // 接线：搜的时候用片段，点一下切整条，后面挂「看整条」
  assert.match(v, /sn = words\.length && !full\[key\] \? snippet\(it\) : String\(it\)/);
  assert.match(v, /"data-wk": "clfull"/);
  assert.match(R("js/theme-studio.js"), /\["clfull", "/);
});

// 她 2026-10-25「要不要把往期公告折叠了，因为以后来新人看不到」
test("往期公告：日志页顶上折一行，只读公共版那份 QQ_NOTICES；搜的时候不出现", () => {
  const scr = R("js/screens-ui.js");
  const v = scr.slice(scr.indexOf("function NoticeArchive("), scr.indexOf("function ChangelogView("));
  assert.match(v, /const list = Array\.isArray\(window\.QQ_NOTICES\) \? window\.QQ_NOTICES : \[\];/);
  assert.match(v, /if \(!list\.length\) return null;/, "家里没有公告时这一块不该出现");
  assert.match(v, /const \[open, setOpen\] = useState\(false\);/, "默认得折着");
  assert.match(scr, /words\.length \? null : h\(NoticeArchive, null\),/);
  // 一行里的 **重点** 和旧写法 { strong, text } 都认
  const nl = scr.slice(scr.indexOf("function noticeLine("), scr.indexOf("function NoticeArchive("));
  assert.match(nl, /str\.split\(\/\\\*\\\*\(\.\+\?\)\\\*\\\*\/\)/);
  assert.match(nl, /line\.strong/);
  const ts = R("js/theme-studio.js");
  ["clnotices", "clnoticeshead", "clnotice", "clnoticetitle", "clnoticebody"].forEach(k => assert.match(ts, new RegExp('\\["' + k + '", "')));
});
