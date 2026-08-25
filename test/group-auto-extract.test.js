const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 她 2026-08-25：「单聊不是有那个几轮就自动抽取吗？」——对，而且这才是她期待的东西。
// 单聊线上、单聊线下、群线下三处都有 maybeAutoExtract*，只有【群线上】没有：
// 它一直只挂着 maybeSummarizeGroup，而那个要攒够 150 条才动一次。
// 于是她在群里聊了一会儿，记忆库里什么都没有——不是坏了，是这一处压根没接。
test("四处都要有「每几轮抽一次」，不能只有三处", () => {
  const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ["maybeAutoExtract(charId)", "maybeAutoExtractOffline(charId)",
   "maybeAutoExtractGroupOffline(group.id)", "maybeAutoExtractGroup(groupId)"]
    .forEach(call => assert.ok(code.indexOf(call) > 0, "没接上：" + call));
  // 群线上要挂在 replyGroup 的 finally 里，和总结并排
  assert.match(app, /maybeSummarizeGroup\(groupId\);\n\s*setTimeout\(\(\) => maybeAutoExtractGroup\(groupId\), 260\);/);
});

test("群线上抽取要跟另外三处一样的节拍和防漏", () => {
  const i0 = app.indexOf("const maybeAutoExtractGroup = async groupId");
  const fn = app.slice(i0, app.indexOf("const maybeSummarizeGroup = async groupId", i0));
  assert.ok(fn.length > 500, "切片没取到函数体");
  assert.match(fn, /if \(!cfg\.autoExtract \|\| !bgActiveRef\.current\) return;/, "跟随同一个开关，走便宜的后台池");
  assert.match(fn, /if \(!gsFor\(groupId\)\.memoryInterop\) return;/, "封闭群不往主线抽（她定的只进不出）");
  assert.match(fn, /cnt % interval !== 0/, "按 extractInterval 的节拍");
  assert.match(fn, /if \(mark && newCount < 4\) return;/, "书签防重复抽");
  assert.match(fn, /Math\.min\(120, Math\.max\(24, newCount \+ 4\)\)/, "窗口随话量放大、封顶 120");
  // 归属：配角没有自己的记忆库
  assert.match(fn, /const owners = memOwners\(ids\);/);
  assert.match(fn, /if \(!owners\.length\) return;/, "整条只关于配角就不写");
  assert.match(fn, /knownBy: knownBy/, "在场的都算知道，配角下次才记得");
  assert.match(fn, /groupId: group\.id/);
  // 批量直写不经过 addMemEntry，闸要自己过
  assert.match(fn, /window\.OpenLoopGate/);
  assert.match(fn, /isDupMem\(txt, owners/);
});

// 「看看我的向量记忆库是不是还是好的」——我看不到她手机上的数据，
// 所以给一个她自己随时能看的读数，而不是我猜一次。
test("向量体检零请求零花费，三种情况分开报", () => {
  const fn = engine.slice(engine.indexOf("async function memVecStatus"), engine.indexOf("async function ensureMemVecs"));
  assert.match(fn, /if \(!embApiReady\(\)\) return \{ on: false \};/);
  assert.doesNotMatch(fn, /embedTexts|fetch\(/, "体检不许真去嵌，那是要花钱的");
  assert.match(fn, /cur\.m === model && cur\.h === memVecHash\(memEntryEmbedText\(e\)\)/, "模型或文本变了就算过期");
  assert.match(fn, /missing: list\.length - ok - stale/);
  // UI 一眼可见，不埋进诊断折叠里
  assert.match(screens, /h\(VecHealth, \{ entries: entries \}\)/);
  assert.match(screens, /🟢 向量记忆正常/);
  assert.match(screens, /条过期（改过文本或换过模型）/);
  assert.match(screens, /向量记忆没开 · 聊天挑记忆走关键词检索/, "没配也要说清楚，那不算坏");
});
