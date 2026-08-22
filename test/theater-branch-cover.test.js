const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const theater = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");

// 分支存档：从任意一拍岔开一条新线，原线一个字不动。纯本地，零 API。
test("分支：岔开点那一拍留着，之后的全丢，原线不动", () => {
  const src = theater.slice(theater.indexOf("const branchFrom = msg =>"), theater.indexOf("const pressMsg"));
  assert.match(src, /r\.msgs\.slice\(0, k \+ 1\)/, "岔开点那一拍要留着");
  assert.match(src, /update\(list => \[nl, \.\.\.list\]\)/, "是新增一条，不是改原来那条");
  assert.doesNotMatch(src, /list\.filter\(x => x\.id !== line\.id\)/, "绝不能顺手删掉原线");

  // 行为复刻：三轮，从第二轮第二拍岔开
  const rounds = [
    { id: "r1", msgs: [{ id: "a" }, { id: "b" }], goalDone: true },
    { id: "r2", msgs: [{ id: "c" }, { id: "d" }, { id: "e" }], goalDone: true, pending: "看起来达成了" },
    { id: "r3", msgs: [{ id: "f" }] }
  ];
  const out = [];
  let hit = false;
  for (const r of rounds) {
    if (hit) break;
    const k = r.msgs.findIndex(m => m.id === "d");
    if (k < 0) { out.push(r); continue; }
    hit = true;
    out.push({ ...r, msgs: r.msgs.slice(0, k + 1), goalDone: false, failed: false, pending: false, pendingFail: false, goalNote: null });
  }
  assert.deepEqual(out.map(r => r.id), ["r1", "r2"], "第三轮整轮不要");
  assert.deepEqual(out[1].msgs.map(m => m.id), ["c", "d"], "d 留着，e 丢掉");
  assert.equal(out[0].goalDone, true, "早先几轮的结果照旧");
  assert.equal(out[1].goalDone, false, "岔开那一轮的结局重新未定");
  assert.equal(out[1].pending, false, "待确认的提示也要清掉");
  assert.equal(rounds[1].msgs.length, 3, "原线数据没被就地改动");
});

test("分支：账本只有在覆盖范围仍然成立时才带走", () => {
  const src = theater.slice(theater.indexOf("const branchFrom = msg =>"), theater.indexOf("const pressMsg"));
  assert.match(src, /const keepLedger = Number\(line\.sumCount \|\| 0\) > 0 && kept >= Number\(line\.sumCount \|\| 0\)/);
  assert.match(src, /summary: keepLedger \? line\.summary : ""/);
  assert.match(src, /sumCount: keepLedger \? line\.sumCount : 0/);
  // 岔在账本覆盖范围之内 → 账本里一半的事已经不存在了，必须丢
  const keep = (sumCount, kept) => sumCount > 0 && kept >= sumCount;
  assert.equal(keep(40, 60), true, "岔在账本之后，账本仍然成立");
  assert.equal(keep(40, 20), false, "岔在账本之内，账本必须丢");
  assert.equal(keep(0, 20), false, "还没压缩过就没有账本");
});

test("分支：归档不跟着走，血缘要记下来", () => {
  const src = theater.slice(theater.indexOf("const branchFrom = msg =>"), theater.indexOf("const pressMsg"));
  assert.match(src, /archives: \[\]/, "归档属于原线");
  assert.match(src, /branchRoot: line\.branchRoot \|\| line\.id/, "同根的分支共用一个根 id，编号才不会重");
  assert.match(src, /branchedFrom: \{ lineId: line\.id, title: line\.title, msgId: msg\.id, at: kept/);
  assert.match(theater, /⑂ 分支自「/, "卡片上要看得出它是谁的分支");
});

// 封面图：画整条线，不取自任何一拍
test("封面：走共用底座，不自己另拼一套", () => {
  assert.match(theater, /const shotBase = l =>/);
  assert.match(theater, /const genCover = async \(\) =>/);
  const cover = theater.slice(theater.indexOf("const genCover"), theater.indexOf("const genPhoto"));
  assert.match(cover, /const b = shotBase\(line\);/, "封面必须复用底座，否则会漏掉 photoStyle/手部锁");
  assert.match(cover, /buildPhotoPrompt\(b\.styledChar, sceneDesc, null, \{ kind: b\.duo \? "duo" : "other", me: b\.me, cinematic: true \}\)/);
  assert.match(cover, /封面海报/);
  assert.match(cover, /不是某一场戏的抓拍/);
  assert.match(cover, /别画成证件照或人物立绘/);
  // 不取剧情原文 → 不该有剧情过滤那套（那是剧照才需要的）
  assert.doesNotMatch(cover, /VIOLENT_RE|isSex|hitViolent/, "封面不喂剧情原文，不需要也不该有过滤逻辑");
  assert.match(cover, /画面尺度/, "但公开可展示这条仍要留着");
});

test("封面存在线上，分支沿用同一张", () => {
  const cover = theater.slice(theater.indexOf("const genCover"), theater.indexOf("const genPhoto"));
  // v54.46 起同一次 update 还要写 coverTs 并（有条件地）接管 bg，形状变了但语义没变
  assert.match(cover, /\{ \.\.\.l, cover: ref, coverTs: Date\.now\(\), bg: take \? ref : l\.bg \}/);
  const br = theater.slice(theater.indexOf("const branchFrom = msg =>"), theater.indexOf("const pressMsg"));
  assert.match(br, /cover: line\.cover \|\| null/, "同一个世界不必各画各的");
  assert.match(theater, /line\.cover \? "🎞 重出封面" : "🎞 封面图"/);
  assert.match(theater, /linear-gradient\(90deg, rgba\(240,236,228,\.94\)/, "图上压字要先保证读得清");
});
