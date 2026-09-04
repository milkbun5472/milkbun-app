// 心上的架构第二刀：把它接进转正评审包。
//
// ⚠️我上一轮那条建议「旁人并进 shadow 体系」有一半是错的，看清楚之后改了：
//   shadow 的定义是【只在本机推演，不调模型、不进 prompt】（heart-drive-shadow.js
//   开头原话）。而旁人必须调模型去读聊天记录写纸条——把它做成 shadow 会破坏
//   shadow 那条零成本的性质。该做的只是让心上【被审得到】，不是让它变成影子。
//
// 病：评审包收了 E潮汐/人格/A线/躯体/动念，唯独没有心上。于是这套东西跑了几个月
//     没人看得见它到底在不在跑——盘一盘触发过没有？旁人的纸条他采了还是全丢了？
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/shadow-review.js"), "utf8");
const drive = fs.readFileSync(path.join(root, "js/heart-drive-shadow.js"), "utf8");

const fns = (() => {
  const g = { localStorage: { getItem: () => null } };
  const i = src.indexOf("  const readStoredHeart");
  const j = src.indexOf("  const finiteRound");
  assert.ok(i > 0 && j > i, "抠不出心上那两段");
  return new Function("window", src.slice(i, j) + "\nreturn { readStoredHeart, cleanHeart };")(g);
})();
const now = Date.now();
const BOX = {
  list: [
    { id: "a", status: "active", tracks: [{ ts: now, text: "今天换了更细的滤纸" }, { ts: now, text: "水流还是不稳" }] },
    { id: "b", status: "ash", tracks: [] },
    { id: "c", status: "graduated", tracks: [{ ts: now, text: "x" }] },
    { id: "d", status: "withered", tracks: [] }
  ],
  persona: [{ id: "p1", text: "我是一个喜欢做咖啡的人" }],
  briefs: [{ ts: now, note: "她连着三天说累" }, { ts: now }],
  avoid: [{ topic: "聊前任" }], milestones: [{ ts: now, text: "这一季我…" }],
  lastMuse: "2026-09-03", lastMellow: "2026-08-28", lastSolstice: "2026-07-01", lastObserve: "2026-09-01"
};
const row = fns.cleanHeart({ id: "c1", name: "沈屿白" }, "沈屿白", { c1: BOX });

test("每一栏都报得出数，四种状态分开算", () => {
  assert.deepEqual(row.念想, { 总数: 4, active: 1, 落灰: 1, 毕业: 1, 没接住: 1 });
  assert.equal(row.长出来的自我, 1);
  assert.equal(row.做过的, 3, "做过的要跨所有念想累计");
  assert.equal(row.旁人纸条, 2);
  assert.equal(row.不想碰的, 1);
  assert.equal(row.一季自述, 1);
});

test("四拍上次跑到哪儿都要报——不然看不出它卡没卡住", () => {
  assert.deepEqual(row.上次,
    { 发呆: "2026-09-03", 盘一盘: "2026-08-28", 回头看: "2026-07-01", 旁人: "2026-09-01" });
});

test("⚠️一个字的正文都不许进评审包", () => {
  // 念想、长出来的自我、旁人纸条、做过的——全是角色自己的话；
  // 评审包是拿去给人看的（这份文件对别的模块也声明了 containsChatText:false）。
  const s = JSON.stringify(row);
  ["今天换了更细的滤纸", "我是一个喜欢做咖啡的人", "她连着三天说累", "聊前任", "这一季我"]
    .forEach(t => assert.ok(!s.includes(t), "漏出了正文：" + t));
});

test("没有那份存档时不报空壳", () => {
  assert.equal(fns.cleanHeart({ id: "zzz", name: "谁" }, "谁", {}), null);
  assert.equal(fns.cleanHeart({ id: "zzz", name: "谁" }, "谁", { zzz: "不是对象" }), null);
});

test("接进报告，而且复用已有那个循环算好的显示名", () => {
  assert.match(src, /心上: \{/, "报告里没有心上这一节");
  assert.match(src, /containsChatText: false/, "没声明不含正文");
  assert.match(src, /const heartRow = cleanHeart\(char, label, storedHeart\);/,
    "没挂进已有的 for 循环——另起一遍 chars.map 就成了第二处「谁是这个角色的显示名」，迟早两处不一致");
  assert.doesNotMatch(src, /labelOf\(/, "又自己造了一个取名字的函数");
});

test("旁人【不该】被做成 shadow——这条推理的前提要一直成立", () => {
  // shadow 的定义就写在 heart-drive-shadow.js 开头。哪天这条变了，
  // 上面那个「不并进去」的判断要重新想一遍。
  assert.match(drive, /不注入 prompt、不生成念头、不改变角色回复/, "shadow 的定义变了，回去重想");
  // 而旁人是要调模型的
  const heart = fs.readFileSync(path.join(root, "js/heart.js"), "utf8");
  assert.match(heart, /observerSpec/, "旁人那一路没了的话这条也要重写");
});
