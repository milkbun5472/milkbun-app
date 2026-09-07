// v62.81 顺手清的最后一处：周刊那 15+ 个英文小字眉标。
// 这一页整套仿的是英文周刊的版式，所以要一处处看着改——不是全局替换。
// ⚠️换掉之后还得把【字体和字距】一起换：那些行原来挂着 'Archivo' 和给拉丁
//   大写字母定的 .2em~.42em 字距，中文按那个字距拉开就是散的。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/weekly.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("顶栏那一条也装上同一道闸：有中文标题就不发英文副题", () => {
  // ⚠️v65.14：WeeklyHead 不再自己搭一条，它就是【包了一层版面参数的共用 Head】，
  //   那道闸也就跟着共用了（Head 里那一处）。周刊这边再抄一份就是同一层写在两处。
  assert.match(NOC, /return h\(Head, \{ zh: props\.zh \|\| "周刊", en: props\.en, onBack: props\.onBack/);
  assert.ok(!/\[一-鿿\]/.test(NOC), "weekly.js 里又抄了一份那道闸");
  const comp = fs.readFileSync("js/components.js", "utf8");
  assert.match(comp, /const enCJK = \/\[一-鿿\]\/\.test\(String\(en \|\| ""\)\);/, "闸本身不在 Head 里了");
});

test("正文里那一堆英文眉标全换成中文", () => {
  ["INDEPENDENT WEEKLY", "TAP A HEADLINE", "LEAD STORY", "EXCLUSIVE INTERVIEW", "GOSSIP · SIDE NOTE",
   "EXHIBIT ", "FIELD NOTE · ", "OBSERVATION · ", "MATCH NOTE ", "LETTERS · 03", "ADDED TO THIS ISSUE",
   "BY THE NUMBERS", "THE WEEKLY", "ARCHIVE · 02", "OPEN THE BOUND VOLUME", "THE EDITORIAL ROOM",
   "MON—SUN", "THIS WEEK · NOW BOUND", "TAP TO PUBLISH", "PRINTING…", "SUPPLEMENT"]
    .forEach(w => assert.ok(NOC.indexOf(w) < 0, w + " 还在"));
  ["一个人的周刊", "点标题进去看", "头条 · 01", "独家专访 · 04", "边角闲话", "物证 ",
   "随记 · ", "观察 · ", "战报 ", "读者来信 · 03", "这期新加的", "数字上看",
   "翻开合订本", "编辑部 · 第 01 期起", "周一到周日", "这一周 · 已装订", "点一下发刊 →", "付印中…"]
    .forEach(w => assert.ok(NOC.indexOf('"' + w) >= 0, w + " 没落上"));
});

test("换成中文的那些行不许还挂着拉丁字距", () => {
  // 'Archivo' 是给拉丁大写字母配的；中文按 .3em 拉开是散的，不是「有设计感」
  const cn = ["一个人的周刊", "点标题进去看", "头条 · 01", "物证 ", "战报 ", "数字上看",
    "翻开合订本", "周一到周日", "这一周 · 已装订", "点一下发刊 →"];
  SRC.split("\n").forEach(l => {
    if (cn.some(t => l.indexOf('"' + t) >= 0)) {
      assert.ok(l.indexOf("'Archivo',sans-serif") < 0, "这一行换了中文却还挂着 Archivo：" + l.trim().slice(0, 80));
    }
  });
});

test("十种版面上那个洋名（VOICES.en）零引用了，删干净不是留着不用", () => {
  assert.doesNotMatch(NOC, /en: "THE SOCIETY PAGES"/);
  assert.doesNotMatch(NOC, /name: "[^"]+", en: "/);
  assert.doesNotMatch(NOC, /L\.it\.en/, "目录上那一行小字英文帽子还在");
  assert.doesNotMatch(NOC, /voiceOf\(sec\.voiceId\)\.en/);
});
