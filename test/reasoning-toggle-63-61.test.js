// 「显示模型思考链」关掉之后还是显示（她 2026-09-05 报）。
// 病因：开关只管【要不要问上游要】，不管【要来了记不记】——
// 有些线路不用问也会主动送一份 reasoning_content 回来，那一份照旧被存进消息里。
// 所以两道都要有：源头不许记（新消息），画面上挡住（早先已经存下的那些）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

test("没要就不许记：_putMeta 先看 wantReasoning", () => {
  const i = eng.indexOf("const _putMeta = (reasoning, from) =>");
  assert.ok(i > 0, "_putMeta 没了");
  const body = eng.slice(i, i + 600);
  assert.match(body, /if \(!\(opts && opts\.wantReasoning\)\) return;/, "上游主动送的那一份没挡住");
  // model/ms 不归这个开关管，别一起挡掉
  assert.ok(body.indexOf("_meta.model = model") < body.indexOf("opts.wantReasoning"),
    "把 model/ms 也一起挡了——那两样跟思考链没关系");
});

test("画面上四处都拿到这个角色的开关", () => {
  assert.match(app, /disp: \{ reason: !!settingsFor\(activeChar\.id\)\.showReasoning,/, "单聊线上没接");
  assert.match(app, /showReason: !!settingsFor\(offlineChar\.id\)\.showReasoning/, "单聊线下没接");
  // 群里一次画所有人：在场任一成员开着就画（同上网那条链的写法）
  assert.match(app, /showReason: \(offlineGroup\.memberIds \|\| \[\]\)\.some\(id => !!settingsFor\(id\)\.showReasoning\)/, "群线下没接");
  assert.match(app, /showReason: \(activeGroup\.memberIds \|\| \[\]\)\.some\(id => !!settingsFor\(id\)\.showReasoning\)/, "群线上没接");
  // 一层写在四处，第四处没跟上——所以形参也一并钉住
  ["function OfflineMode(", "function GroupOfflineMode(", "function GroupThread("].forEach(f => {
    const j = comp.indexOf(f);
    assert.ok(j > 0, f + " 没了");
    assert.ok(comp.slice(j, comp.indexOf(")", j)).includes("showReason"), f + " 没收这个参数");
  });
});
