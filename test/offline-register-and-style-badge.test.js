const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-22：「整体描述还是很难吃，变成霸总了」。
// 查下来是我自己造的：v54.79 清死代码时删掉的 ANTI_CLICHE_LEGACY 里，
// 第⑩条是全仓库【唯一点名禁霸总标配】的规则；v2 重写时也没搬过来——
// 和「句尾不打句号」那次一模一样的丢法。这次按她的实际症状补回来。
const RUNTIME = (() => {
  const i = engine.indexOf("const OFFLINE_NARRATIVE_RUNTIME = `");
  const s = engine.indexOf("`", i) + 1;
  return engine.slice(s, engine.indexOf("`", s));
})();

test("霸总那一套要点名，光说「别写网文腔」没用", () => {
  assert.match(RUNTIME, /【别滑进网文腔·尤其是霸总那一套】/);
  // 动作模板——她这次的正文里全中
  ["攥住手腕", "扣住手腕", "把人往怀里带", "拦在身前", "拇指在对方腕骨上碾"].forEach(k =>
    assert.ok(RUNTIME.includes(k), "动作模板漏了：" + k));
  // 表情模板
  ["冷笑", "嗤笑", "挑眉", "嘴角勾起一个没什么温度的笑"].forEach(k =>
    assert.ok(RUNTIME.includes(k), "表情模板漏了：" + k));
  // 旁白先贴标签再说话，正是她那版「语气沉了下来，带着点压不住的嘲讽和严厉」
  assert.match(RUNTIME, /先给情绪贴标签再让人物说话/);
  assert.match(RUNTIME, /让用词、停顿、他挑了什么不说，自己把态度露出来/);
});

test("禁的是模板，不是强势的人物", () => {
  assert.match(RUNTIME, /这一条禁的是【模板】，不是强势的人物/);
  assert.match(RUNTIME, /角色本来就居高位、说话带刺、动手快，那都照写/);
  assert.match(RUNTIME, /而不是从「霸总该有的反应」这个现成模子里倒出来/);
  // 给了额度而不是一刀切
  assert.match(RUNTIME, /整段最多出现一次，且必须由这一刻的具体处境逼出来/);
});

test("三条正文通道都吃得到（单人线下 + 叙事底座）", () => {
  assert.match(engine, /"\\n\\n" \+ OFFLINE_NARRATIVE_RUNTIME \+/, "单人线下");
  assert.match(engine, /ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME/, "叙事底座→小剧场与同人文");
});

// —— 文风指示条 ——
// 她放了份自定义文风却完全没生效，而界面上根本看不出这局挂着哪一个，排查全靠猜。
test("单人与群线下都摆出当前文风", () => {
  // v63.01 no-english-titles：STYLE → 「文风」
  assert.equal((comp.match(/"文风"/g) || []).length, 2, "两个线下组件各一条");
  const g = comp.indexOf("function GroupOfflineMode");
  assert.ok(comp.slice(g).includes('"文风"'), "群线下也要有");
  assert.ok(!comp.includes('"STYLE"'), "旧那条英文还在");
});

test("线下顶栏摆出当前文风，没挂上一眼就看见", () => {
  assert.match(comp, /她 2026-08-22 放了份自定义文风进去却完全没生效/);
  assert.match(comp, /"文风"/);
  assert.match(comp, /未设文风 · 走通用叙事/);
  // 只看还没结束的那一局
  assert.match(comp, /const sess = \(sessions \|\| \[\]\)\.find\(x => x && !x\.endTs\);/);
  // 自定义要标出来，跟内置区分开
  assert.match(comp, /named && named\.custom \? "（自定义）" : ""/);
  // 点一下能直接进设置去改
  assert.match(comp, /onClick: \(\) => setSetOpen\(true\)/);
});

test("判「有没有文风」要认两条路：session 自带的与按 key 查到的", () => {
  assert.match(comp, /const own = \(sess\.stylePrompt \|\| ""\)\.trim\(\);/);
  assert.match(comp, /const named = \[\.\.\.OFFLINE_STYLES, \.\.\.customStyles\]\.find\(x => x\.key === key\);/);
  assert.match(comp, /const on = usingPreset \|\| !!\(own \|\| \(named && named\.prompt\)\);/);
  // v55.52：吃预设台那份时也算「有文风」，别再报「未设文风」
  assert.match(comp, /const usingPreset = !!\(sess\.presetOn && sess\.presetId && window\.StylePresets/);
});
