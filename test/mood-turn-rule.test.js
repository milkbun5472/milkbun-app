const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-25：「这实时心情动都不动啊」——心声历史里连着四条、跨 13 小时
// 全是「清醒又好笑」。查出来是 app.js 那条 moodUpdateHint：写好了、声明了一次，
// 然后再没被引用过，一个字都没进过提示词。
// 旁边的 _normalThoughtTurnHint（心声那条）是拼进去的，所以心声一直在动、心情不动。

test("那条死代码不许再留着——它长得像已经生效了", () => {
  assert.equal(app.indexOf("const moodUpdateHint"), -1,
    "声明了却没人用的提示串比没有更坏：看代码以为已经在发了");
});

test("心情规则要没有逃生口（心声那条能一直有效就是因为这个）", () => {
  const i = engine.indexOf("const MOOD_TURN_RULE");
  assert.ok(i > 0);
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /必须是非空的中文短词，不许 null、空串或省略/, "跟心声同款：必填、非空");
  // 旧稿那句「没有真实变化才保持原词」就是逃生口：上一行刚告诉它此刻心情是X，
  // 照抄永远是最省事的选择。
  assert.doesNotMatch(rule, /没有真实变化才保持原词/);
  assert.match(rule, /是起点不是答案/);
  assert.match(rule, /连着三四轮一模一样，基本就说明是在照抄/, "要给可判定的自检");
  // 心情不该只被「她说了什么」推动，否则她不说话就永远不动
  assert.match(rule, /此刻几点、你正在做什么、身体累不累/);
  assert.match(rule, /就算对方什么都没说/);
  // 别让它退回万能词
  assert.match(rule, /别写「平静」「还行」这种什么都没说的挡箭牌/);
});

test("四处都要真的拼进去，不能再只是声明", () => {
  // 单聊线上：v2 每轮任务（现行路径）
  assert.match(app, /_normalThoughtTurnHint \+ "\\n" \+ MOOD_TURN_RULE/, "单聊线上·v2");
  // 单聊线上：旧全量任务串（非 anthropic 线路走这条，漏了就换条线路又不动）
  assert.match(app, /" \+ MOOD_TURN_RULE \+ crossSamenessHint\(charId\) \+ "\\n【输出】只输出一个 JSON/, "单聊线上·全量");
  // 群线上：mood 字段只在开了记忆互通时才发，规则跟着字段走
  assert.match(app, /两项只更新共享状态，绝不写进 text 气泡。\\n" \+ MOOD_TURN_RULE/, "群线上");
  // 单聊线下 / 群线下
  // v60.39 起三处群共用 groupBans：别再 grep「这个常量拼在那一行的哪个位置」，
  // 对着【它到底吐出哪几层】问（改拼法不该红，掉一层才该红）。
  // 单聊线下照旧直接拼；群线下经 groupBans（mood:true），顺序仍在人设声纹锚之后
  assert.match(engine, /PERSONA_REGISTER_ANCHOR \+\n\s*"\\n\\n" \+ MOOD_TURN_RULE/, "单聊线下");
  const seq = GB.layers(GB.OFFLINE);
  assert.equal(seq.indexOf("<MOOD_TURN_RULE>"), seq.indexOf("<PERSONA_REGISTER_ANCHOR>") + 1, "群线下");
  // 会写心情的才要：群线上的 mood 跟着字段走（在 common 里），通话不写心情
  assert.ok(!GB.has(GB.CALL, "MOOD_TURN_RULE"), "通话不写心情，别白发一层");
  assert.equal((engine.match(/MOOD_TURN_RULE/g) || []).length +
               (app.match(/MOOD_TURN_RULE/g) || []).length, 6,
    "1 处定义 + groupBans + 单人线下 + 单聊线上两条 + 群线上");
});

// 心声历史只存档、不回灌进提示词——所以唯一的反馈源就是【你此刻的心情】那一行，
// 新规则正对着它。这条钉住这个前提：哪天历史被喂回去了，就得重新想这条够不够。
test("心声历史不许被喂回提示词，否则规则再硬也会被记录投票压过去", () => {
  const uses = app.split("\n")
    .map((l, n) => ({ l, n: n + 1 }))
    .filter(x => /stateHistRef\.current/.test(x.l) && !/^\s*\/\//.test(x.l));
  uses.forEach(x => assert.doesNotMatch(x.l, /system|bundle|prompt|parts\.push/i,
    "第 " + x.n + " 行把心声历史送进了提示词：" + x.l.trim().slice(0, 80)));
});
