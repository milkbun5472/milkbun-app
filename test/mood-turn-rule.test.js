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

test("心情每轮如实记录，不用变化次数或平淡词语考核", () => {
  const i = engine.indexOf("const MOOD_TURN_RULE");
  assert.ok(i > 0);
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /必须是非空的中文短词，不许 null、空串或省略/, "跟心声同款：必填、非空");
  assert.match(rule, /当前交流与自身处境/);
  assert.match(rule, /没有变化就写回同一个词，连续相同没有轮数限制/);
  assert.match(rule, /普通、平淡的心情同样有效/);
  assert.doesNotMatch(rule, /三四轮|挡箭牌|心情也已经不是刚才那个/);
  assert.match(rule, /不要求为更新读数制造/);
});

test("普通单聊实际发送的动作协议允许事实未变时原样填写", () => {
  const start = app.indexOf('const _normalProtocolStable =');
  const protocol = app.slice(start, app.indexOf('// 数字生命不是', start));
  assert.match(protocol, /action: string，每轮回复完成后如实填写/);
  assert.match(protocol, /当前事实未变且原表述仍准确时，可以原样填写/);
  assert.match(protocol, /事实变化时再更新/);
  assert.doesNotMatch(protocol, /必须根据此刻重新表述/);
  assert.match(app, /_s\.engineerEyes \? "" : _normalProtocolStable/);
});

test("四处都要真的拼进去，不能再只是声明", () => {
  // 单聊线上：v2 每轮任务（现行路径）
  assert.match(app, /_normalThoughtTurnHint \+ "\\n" \+ MOOD_TURN_RULE/, "单聊线上·v2");
  // ⚠️原来这儿还钉着「旧全量任务串」那一份。v66.12 把那条不再发送的 A/B 基线删了
  //   （她 2026-09-09：「每次都这样耽误事」）——钉一条【发不出去的路】只会让人以为它还在跑。
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
               (app.match(/MOOD_TURN_RULE/g) || []).length, 5,
    "1 处定义 + groupBans + 单人线下 + 单聊线上 v2 + 群线上（v66.12 删掉了那条不再发送的 A/B 基线，少一处）");
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
