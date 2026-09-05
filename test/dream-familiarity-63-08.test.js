// v63.08 玩法④（她 2026-09-05「都可以做，按顺序来」的第四件）：熟不熟决定你看不看得出逆鳞。
// 「熟」不是一个数值，是三样真攒出来的东西：好感、印象卡厚不厚、记忆库里有多少条是 Ta 知道的。
// 0 生：三条路一模一样；1 熟：抗拒项留一处轻微不对劲；2 很熟：那条路明显不像 Ta 的梦会给的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const dream = read("js/dream.js"), app = read("js/app.js");
function loadDream() {
  const g = { window: null, loadJSON: () => ({}), saveJSON: () => true, useState: v => [typeof v === "function" ? v() : v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, React: { Fragment: "f" },
    h: () => null, Head: () => null, Avatar: () => null, F_BODY: "a", F_DISPLAY: "b", requestAppConfirm: () => {}, isOocMsg: () => false };
  g.window = g; g.DreamLoop = { markEntered: () => Promise.resolve(), excerptsFor: () => [], listDreams: () => Promise.resolve([]) };
  vm.runInNewContext(dream, g); return g;
}

test("档位：生 / 熟 / 很熟，三样东西攒出来的", () => {
  const T = loadDream().Dream.familiarityTier;
  assert.equal(T(null), 0); assert.equal(T({ affinity: 10, gazeLen: 0, memCount: 0 }), 0);
  assert.equal(T({ affinity: 55 }), 1, "好感过半就该算熟了些");
  assert.equal(T({ gazeLen: 300 }), 1, "印象卡厚也算");
  assert.equal(T({ affinity: 80, gazeLen: 300, memCount: 20 }), 2);
  assert.equal(T({ affinity: 80, memCount: 20 }), 2, "好感 80 算两分，加记忆够三分");
  assert.equal(T({ affinity: 60, memCount: 20 }), 1);
});

test("破绽写进提示词：生的一字不加；熟的一处轻微；很熟的一处明显——都只许一处、不解释", () => {
  const R = loadDream().Dream.familiarityRule;
  assert.equal(R(0, "沈屿白"), "");
  assert.match(R(1, "沈屿白"), /一处轻微】的不对劲/); assert.match(R(1, "沈屿白"), /只此一处，别解释、别加重/);
  assert.match(R(2, "沈屿白"), /一处明显些】的破绽/); assert.match(R(2, "沈屿白"), /另外两条必须都像 沈屿白/);
  // 接在「三个字面上都像合理选择」那句后面，首幕和续写都递档位
  assert.match(dream, /抗拒项是「看着无害、却恰好碰了逆鳞」。" \+\s*\n\s*\(familiarityRule\(opts\.familiarity \|\| 0, nm\)/);
  assert.match(dream, /stage: "open", charName: session\.charName, familiarity: session\.familiarity \|\| 0/);
  assert.match(dream, /forceFinal: forceFinal, charName: session\.charName, familiarity: session\.familiarity \|\| 0/);
});

test("档位在进梦时定下、写进存档：递关键词的和推门进真梦的都定", () => {
  assert.equal((dream.match(/familiarity: familiarityTier\(props\.familiarityOf \? props\.familiarityOf\(c\.id\) : null\)/g) || []).length, 2);
  // 选项底下那行话告诉她破绽有没有；挣扎那一幕不适用
  assert.match(dream, /cur\.struggle \? null : h\("div", \{ style: \{ fontFamily: F_BODY, fontSize: 10\.5, color: t\.fog, textAlign: "center", paddingTop: 2 \} \}, FAMILIAR_LINE\[/);
});

test("App 那头只读三样：好感、印象卡长度、Ta 能召回的记忆条数（走 retrieveMemories，不自己抄可见性规则）", () => {
  assert.match(app, /familiarityOf: cid => \(\{\s*\n\s*affinity: affinities\[cid\],/);
  assert.match(app, /window\.Gaze\.text\(cid, profile && profile\.name\)/);
  assert.match(app, /retrieveMemories\(memLibRef\.current, cid, "", \{ limit: 500 \}\)\.length/, "记忆条数得走 retrieveMemories 的可见性规则，自己写 knownBy 判断迟早走散");
});
