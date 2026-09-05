const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload } = require("../js/trpg.js");

// ============================================================
// 夜谈(她 2026-09-04:跑团还是单调)——休整拍不再是「各提一句对下一步的看法」,
// 是每位队友各开一个话头(从私念/羁绊/今天的事里长出来),她挑一个接着聊。
// 接了的划掉;队伍一动身这一夜就过去了。
// ============================================================

const camp = (over) => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } },
          { key: "c2", name: "陆闻", hp: 0, maxHp: 100, stats: { phy: 40, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0, stages: [{ goal: "a", done: false }],
  choices: [], pendingStage: false, pendingEnd: false, msgs: [{ role: "gm" }, { role: "gm" }]
}, over || {});

test("休整拍:night 字段落成话头——只认在场、活着的队友,玩家自己和倒下的不算,同一人只留一条", () => {
  const r = applyTurnPayload(camp(), { night: [
    { who: "裴照川", open: "你今天那一下,是故意的吧。" },
    { who: "Lisa", open: "不该有我" },
    { who: "陆闻", open: "倒下的人开不了口" },
    { who: "裴照川", open: "第二条不要" },
    { who: "不存在", open: "x" },
    { who: "裴照川", open: "" }
  ] }, { rest: true, calm: true });
  assert.deepEqual(r.camp.night.threads, [{ who: "裴照川", open: "你今天那一下,是故意的吧。", taken: false }]);
  assert.equal(r.camp.night.at, 2, "记下这一夜从哪一拍开始");
  assert.equal(applyTurnPayload(camp(), { night: [] }, { rest: true }).camp.night, null, "没人开口就没有夜谈");
});

test("夜谈拍:接了谁的话头就划掉谁的;别的拍一来,这一夜就过去了", () => {
  const night = { threads: [{ who: "裴照川", open: "a", taken: false }, { who: "陆闻", open: "b", taken: false }], at: 2 };
  const r = applyTurnPayload(camp({ night }), {}, { night: "裴照川", calm: true });
  assert.deepEqual(r.camp.night.threads.map(th => th.taken), [true, false]);
  assert.equal(applyTurnPayload(camp({ night }), {}, {}).camp.night, null, "普通拍清掉");
  assert.equal(applyTurnPayload(camp({ night }), {}, { night: "裴照川" }).camp.night.threads.length, 2, "夜谈拍不清");
  assert.equal(applyTurnPayload(camp({ night }), { night: [{ who: "裴照川", open: "c" }] }, { rest: true }).camp.night.threads[0].open, "c", "再歇一次就是新的一夜");
});

test("turn():夜谈是特殊拍——不开亲笔票、不触发幕间、场景钉 interlude、钟不走", () => {
  assert.match(src, /const cc = \(mode && \(mode\.talk \|\| mode\.night\)\) \|\| tailHasCC/);
  assert.match(src, /typeof mode === "string" \|\| mode\.talk \|\| mode\.night \|\| mode\.travel/);
  assert.match(src, /\(mode === "rest" \|\| mode === "lull" \|\| \(mode && mode\.night\)\) \? "interlude"/);
  assert.match(src, /calm: mode === "rest" \|\| mode === "lull" \|\| !!\(mode && \(mode\.talk \|\| mode\.night\)\)/);
  assert.match(src, /rest: mode === "rest", night: \(mode && mode\.night\) \|\| null/, "opts 里要把休整/夜谈两个口子递进 applyTurnPayload");
});

test("提示词:休整拍要每位队友开一个话头(不是对下一步的看法),夜谈拍只演两个人、可以擦暗线的边", () => {
  assert.match(src, /每位队友各开【一个话头】,写进 night 字段/);
  assert.doesNotMatch(src, /每位队友至少对下一步提一句自己的看法/, "旧的那句要删掉,不然两句打架");
  assert.match(src, /这句话换个人说就不对了,才算他的/, "判据不是样例");
  assert.match(src, /〔夜谈·对象:" \+ mode\.night\.who \+ "〕sceneMeta\.type 固定 interlude/);
  assert.match(src, /他隐约察觉 " \+ uName \+ " 心里揣着事\(他不知道那是什么\)/);
  assert.match(src, /问完就住,玩家躲开也不追,绝不点破/);
  assert.match(src, /\\"night\\":\[\],\\"stepDone\\":null/, "输出 JSON 里有 night");
  // prompt-no-content-samples:话头没有样例句
  const at = src.indexOf("【夜谈】歇下来的时候人才会说话");
  assert.ok(at > 0);
  assert.doesNotMatch(src.slice(at, at + 600), /如「/);
});

test("界面:话头是几张纸条,点谁接谁;composer 进夜谈模式,「睡了」退出;队伍动身自动退出", () => {
  assert.match(src, /const \[nightWith, setNightWith\] = useState\(null\)/);
  assert.match(src, /"—— 夜谈 · 有人开了口 ——"/);
  assert.match(src, /turn\("\(转过去,接" \+ th\.who \+ "的话\)", null, \{ night: nw \}\)/);
  assert.match(src, /if \(nightWith\) return turn\(ready, null, \{ night: nightWith \}\)/);
  assert.match(src, /setNightWith\(null\), style: S\.btn\(false\) \}, "睡了"\)/);
  assert.match(src, /if \(nightWith && !\(camp && camp\.night\)\) setNightWith\(null\)/);
  assert.match(src, /useMode \|\| \(nightWith \? \{ night: nightWith \} : null\)/, "夜里点的轻选项还留在夜谈里");
  assert.match(src, /textDecoration: th\.taken \? "line-through" : "none"/);
});
