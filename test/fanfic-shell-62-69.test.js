// v62.69 审美审计（2026-09-04）第三类问题：**元素合格、外壳裸着**。
// 同人文这九个子页的纸皮早就铺好了（pageSkin("paper")、书脊 tab、订书钉薄册子
// 都判合格），可 `Head` 用的是默认的 t.bg——一条平色带压在纸皮上（违 §3.5）；
// 穿书会话那页更狠，滚动区自己写着 background: t.bg，把皮整个盖掉。
//
// 「改法很便宜」：外壳铺同材质底 + Head 传 bg:"transparent"。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/fanfic.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("每一个 Head 都让底透上来，一个都不许漏", () => {
  // 漏一处，那一页顶上就横着一条没盖住的平色带——这正是「一层写在十一处」的形状
  const all = (NOC.match(/h\(Head, \{/g) || []).length;
  const clear = (NOC.match(/h\(Head, \{ bg: "transparent",/g) || []).length;
  assert.equal(clear, all, "有 " + (all - clear) + " 处 Head 还顶着平色带");
  // v63.92 少了一处：加笔那一屏（选身份/记忆/落点）整个撤掉了
  assert.ok(all >= 10, "Head 的处数比预期少，说明有人又自己写了一条顶栏");
});

test("中间那几层不许自己铺底把皮盖掉", () => {
  // 穿书会话那页的滚动区原来写着 background: t.bg
  assert.doesNotMatch(NOC, /className: "flex-1 min-h-0 overflow-y-auto px-7 pb-8", style: \{ background: t\.bg \}/);
  assert.match(NOC, /className: "flex-1 min-h-0 overflow-y-auto px-7 pb-8" \}/);
});

test("英文眉标换成中文，而且不是把英文译回来", () => {
  // no-english-titles：眉标该说的是这一栏在干嘛
  ["TOP OF THE FEED", "ON THE SHELF", '"FANFIC"', '"SHELF"', '"RELATION"', '"TAGS"', '"STATS"']
    .forEach(w => assert.ok(NOC.indexOf(w) < 0, w + " 还在"));
  assert.match(NOC, /"圈子里最上面那一篇"/);
  assert.match(NOC, /view === "shelf" \? "收进来的那些" : "别人都在写什么"/);
  assert.match(NOC, /metaRow\("这一对"/);
  // Head 上那几个 en:（有 zh 时 Head 本来就不发纯拉丁的 en）也一并删掉，不留死重量
  assert.doesNotMatch(NOC, /en: "(Publish|Mine|Published|Ships|Settings)"/);
});
