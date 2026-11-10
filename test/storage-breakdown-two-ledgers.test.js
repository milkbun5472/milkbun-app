// 「本地空间 → 看谁占地方」这一页 2026-11-09 大修。
// 立因：群友的存档出了事，这一页是她唯一能自己看的一页，而它两处都在说假话——
//   我拿它当证据，判错了一回（Lisa 当场用她自己那台反证：她一切正常，也一样没有金库行）。
//   ① 「（文字金库）」那一支的判据是 localStorage.getItem(k) != null，
//      而 Storage.prototype.getItem 被转接层改写过（engine.js installLsBridge）：
//      问一把住 IDB 的键，它从内存镜像拿、返回有值 —— 于是每一把金库键都被跳过，
//      「· IDB」在谁的机器上都没显示过。
//   ② 列表按 localStorage.length 数，而 length/key(i) 没被转接，
//      只数得到真在 localStorage 里那几把；聊天记录、记忆库这些最大的根本不进表。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ui = read("screens-ui.js");
const engine = read("engine.js");
const fn = ui.slice(ui.indexOf("function storageBreakdown()"), ui.indexOf("function AutoBackupSection"));
assert.ok(fn.length > 400, "抠不出 storageBreakdown");

test("转接层还在——这一页的判据必须绕开它", () => {
  // 前提变了的话，下面几条的道理要重新想一遍（别闷头让测试继续绿）
  assert.match(engine, /function installLsBridge\(\)/, "localStorage 转接层没了");
  assert.match(engine, /P\.getItem = function \(k\)[\s\S]{0,300}_txtMirror\(\)\.get\(k\)/,
    "转接层不再从内存镜像取值了，这一页的判法可以重新想");
});

test("列金库不许再问 localStorage", () => {
  assert.ok(!/localStorage\.getItem\(k\) != null/.test(fn),
    "又拿 localStorage.getItem 当「这把键在不在 localStorage」用了——转接层会让它永远回真值");
  assert.match(fn, /lsRaw/, "读真 localStorage 要走 lsRaw（engine.js 里在转接层装上之前就抓好了原生方法）");
});

test("两本账分开记，金库那一摞一把一把列出来", () => {
  assert.match(fn, /window\.__txtMirror\.forEach/, "没有直接问金库要");
  assert.match(fn, /vaultBytes/, "没分开算金库总量");
  assert.match(fn, /lsBytes/, "没分开算 localStorage 总量");
  assert.match(fn, /idb: idb/, "行上没标明是哪一本账（靠名字里找「文字金库」是会被文案改动带断的锚）");
  assert.match(fn, /\.slice\(0, 10\)[\s\S]{0,80}\.slice\(0, 8\)/,
    "两边没各留各的名额——金库那几条一进来就会把 localStorage 整摞挤没");
});

test("金库空了要喊，但不许冲着新装的人喊", () => {
  const at = ui.indexOf("rows.vaultKeys === 0");
  assert.ok(at > 0, "抠不出那条判断");
  const seg = ui.slice(at - 200, at + 400);
  assert.match(seg, /info\.hadData/, "没问「这台机器到底存过东西没有」，全新装的人会被乱喊一通");
  assert.match(ui, /qq_vaultHasData/, "hadData 得读 engine.js 写的那一笔");
  assert.match(engine, /lsRaw\.set\("qq_vaultHasData", "1"\)/, "写那一笔的地方变了，这条判据要跟着改");
  assert.match(seg, /info\.vault\.done && info\.vault\.ok/,
    "仓库【打不开】那一种由常驻横幅说，这儿只说「开着但空了」，两种不许混");
});

test("图例不许再讲那个从没出现过的标签", () => {
  assert.ok(!/标有「文字金库」的项目住在 IDB/.test(ui), "旧图例还在解释一个没显示过的东西");
  assert.match(ui, /两本账分开记/, "新图例不见了");
});
