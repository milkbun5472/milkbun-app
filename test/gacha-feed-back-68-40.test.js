// 她 2026-09-14：「现在先想想扭蛋这些抽出来了怎么喂回去聊天呢」，
// 接着追问「但是如果每轮都背着不会撑爆上下文吗」。
//
// 查下来抽卡是「四处一样喂」名单上漏掉的第九处：SR 那六张（最常见的一档）兑完
// 只是一张文字卡，角色完全不知道发生过；双面券尤其怪——券是他给的，他却不认。
// 修法用现成的 coupleKeep：落一条记忆库条目，聊到相关才被检索，平时零成本。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

const KEEP = (() => {
  const i = app.indexOf("  const GACHA_KEEP = {");
  const src = app.slice(i, app.indexOf("\n  };", i) + 5);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.t = GACHA_KEEP;", ctx);
  return ctx.t;
})();

test("每一档都记成【带得上具体词】的句子，不是泛话", () => {
  Object.keys(KEEP).forEach(k => {
    const line = KEEP[k]("沈屿白", "那件东西", "他真正说的那一句");
    assert.match(line, /沈屿白|她/, k + " 这一条没有主语");
    assert.match(line, /「/, k + " 没把原话带进去——泛话什么话题都能匹配上，专占 topK 的坑");
    assert.ok(line.length < 120, k + " 太长了");
  });
});

test("最常见那一档（SR 六张）一条都不许漏", () => {
  ["word", "note", "secret", "song", "look", "date"].forEach(k =>
    assert.ok(KEEP[k], "make 的 " + k + " 没接上"));
  // 代笔那一支和书房那一支都要记，不能只接一半
  assert.equal((app.match(/gachaKeep\(char, card\.kind,/g) || []).length, 2, "SR 两条路没都接上");
});

test("双面券要记，不然券是他给的、他却不认", () => {
  assert.ok(KEEP.dual);
  assert.match(app, /gachaKeep\(char, "dual",/);
  assert.match(KEEP.dual("甲", "券名", "答应的事"), /给过她一张券/);
});

test("包裹记在【到货】那一刻，不是兑换那一刻", () => {
  const sw = app.slice(app.indexOf("const gachaSeedSweep = () => {"), app.indexOf("const gachaSeedSweep = () => {") + 2200);
  assert.match(sw, /gachaKeep\(\(characters \|\| \[\]\)\.find\(c => c\.id === sd\.charId\), "seed"/);
  // 兑换那一处不许记——东西还在路上的时候他并不知道是什么
  const plant = app.slice(app.indexOf('if (card.act === "seed")'), app.indexOf('if (card.act === "seed")') + 2000);
  assert.doesNotMatch(plant, /gachaKeep/, "还在路上就记进去了");
});

test("⚠️两处故意不记，而且理由写在代码里", () => {
  // flow＝她偷看了一眼，他不知道；drop 的分量在「被撞破那一下由她挑时机」
  ["flow", "drop"].forEach(k => assert.ok(!KEEP[k], k + " 不该自动记"));
  // ⚠️切到【这一支自己的结尾】，不是拍一个字数——drop 那一支很短，多切几百字就切进
  //   下面的双面券里，那儿是有 gachaKeep 的，断言会假红（第一版就这么红了一次）。
  const branch = act => {
    const i = app.indexOf('if (card.act === "' + act + '") {');
    assert.ok(i > 0, act);
    return app.slice(i, app.indexOf("\n      }\n", i));
  };
  assert.doesNotMatch(branch("flow"), /gachaKeep/);
  assert.doesNotMatch(branch("drop"), /gachaKeep/);
  const why = app.slice(app.indexOf("⚠️两处【故意不记】"), app.indexOf("⚠️两处【故意不记】") + 420);
  assert.match(why, /她偷看了一眼/);
  assert.match(why, /被撞破那一下由她挑时机/);
});

test("不常驻、不置顶、走现成的去重闸（她问的「会不会撑爆」）", () => {
  const i = app.indexOf("  const gachaKeep = (char, key, title, body) => {");
  const fn = app.slice(i, i + 500);
  assert.match(fn, /coupleKeep\(char\.id, line, "抽卡"\)/, "没走那一层现成的");
  assert.doesNotMatch(fn, /pinned|置顶/, "抽卡条目置顶了——置顶是 always-in，会直接常驻");
  // coupleKeep 自己是 source:"couple"（过去重闸），而且只是落一条、不是每轮注入
  const ck = app.slice(app.indexOf("  const coupleKeep = (charId, text, tag) => {"), app.indexOf("  const coupleKeep = (charId, text, tag) => {") + 300);
  assert.match(ck, /source: "couple"/);
  assert.doesNotMatch(ck, /pinned: true/);
});

test("记忆库里一眼认得出是扭蛋留下的，搜「抽卡」也翻得出来", () => {
  assert.match(scr, /includes\("抽卡"\) \? "扭蛋留下"/);
  // 搜索框本来就把 tags 一起搜了——所以打「抽卡」就能整批筛出来，不必另做一个筛子
  assert.match(scr, /\(e\.tags \|\| \[\]\)\.join\(" "\)/);
  // ⚠️抽卡那一档要排在 couple 前面，不然两者 source 一样、分不出来
  const i = scr.indexOf("const sourceLabelOf");
  const fn = scr.slice(i, i + 460);
  assert.ok(fn.indexOf('"扭蛋留下"') < fn.indexOf('couple: "情侣空间"'));
});
