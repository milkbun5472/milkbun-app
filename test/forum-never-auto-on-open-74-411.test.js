// 进论坛不许自动生成任何东西（她 2026-10-01：「那个 4 小时点进去论坛的直接删掉，
// 我不要每次进去都生成」）
//
// 当时的真实情况：行为早就没了（调用点被摘过），但 autoAmbientRun 里那支 forum
// 还吊在那儿够不着。死代码最会骗人——下一个人看见它还在，顺手就把线接回去了。
// 所以这一条钉的不是「现在有没有发生」，是【这条路还通不通】。
//
// ⚠️照调用点那一头读（施工规则/stub-from-the-writer）：
//   真正决定「进某个屏要不要生成」的是那个 useEffect 里 screen === "…" 那几行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

test("① autoAmbientRun 里不许再有 forum 那一支", () => {
  const i = app.indexOf("const autoAmbientRun = async kind =>");
  const j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 autoAmbientRun");
  const body = app.slice(i, j);
  assert.ok(!/kind === "forum"/.test(body),
    "forum 那一支又回来了：进论坛就会自己生成一条网友帖");
  // 另外两支是她要留的，顺带钉住别被误删
  assert.ok(/kind === "moments"/.test(body), "moments 那一支不该动");
  assert.ok(/kind === "whisper"/.test(body), "whisper 那一支不该动");
});

test("② 进论坛那一下只清红点，不许调 autoAmbientRun", () => {
  const i = app.indexOf('if (screen === "forum")');
  assert.ok(i > 0, "抠不出进论坛那一行");
  const line = app.slice(i, app.indexOf("\n", i));
  assert.ok(!/autoAmbientRun/.test(line),
    "进论坛又接上生成了：" + line.trim());
  assert.match(line, /clearAppNotif\("forum"\)/, "该做的只有清红点");
});

test("③ 论坛生成只剩两条路：她自己按的，和低频主动发帖那一条", () => {
  // genForumBoard（整版网友帖）除了 UI 接线，不许有别的调用点
  // 声明写的是 `const genForumBoard = async board =>`，不带括号；
  // 所以 `genForumBoard(` 命中的全是【调用点】，一个都不该有。
  assert.ok(/const genForumBoard = async board =>/.test(app), "声明没了，锚断了");
  assert.ok(/onGenBoard: genForumBoard/.test(app), "按钮接线没了，锚断了");
  const calls = [...app.matchAll(/genForumBoard\(/g)].map(m =>
    app.slice(Math.max(0, m.index - 60), m.index + 20).replace(/\n/g, " "));
  assert.deepEqual(calls, [],
    "genForumBoard 被代码里直接调了——它只该由她按按钮触发：\n  " + calls.join("\n  "));
});
