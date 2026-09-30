// 群友 2026-10-01 两张截图：
//   ① 「资产生成失败：解析失败：您好！本服务不支持测活/连通性测试（如 Hi、Hello、ping…）」
//   ② 「顶栏的头像位置动不了吗？…我想搞个双人头像一直不给我生」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = R("engine.js"), comps = R("components.js"), studio = R("theme-studio.js");

test("光秃秃的「开始。」在 callAI 那一处统一换成一句说清要干什么的话；真聊天一个字不碰", () => {
  const i = engine.indexOf("async function callAI("), j = engine.indexOf("\n}\n", i);
  const fn = engine.slice(i, j);
  const a = fn.indexOf("const BARE_TRIGGER"), b = fn.indexOf("const t0 = Date.now();");
  assert.ok(a > 0 && b > a, "抠不出 BARE_TRIGGER 那一段");
  const run = msgs => new Function("messages", fn.slice(a, b) + "\nreturn messages;")(msgs);
  assert.equal(run([{ role: "user", content: "开始。" }])[0].content, "请按上面的要求开始生成，直接给出结果。");
  assert.match(run([{ role: "user", content: "重来一次。" }])[0].content, /重新完整生成/);
  assert.equal(run([{ role: "user", content: "嗯" }])[0].content, "嗯", "她真打的字被改了");
  const chat = [{ role: "user", content: "开始" }, { role: "assistant", content: "好" }];
  assert.equal(run(chat), chat, "多轮对话也被改了");
});

test("顶栏藏着一颗她自己的头像，给主题当双人头像的挂点；钩子清单里登记了", () => {
  assert.match(comps, /h\("span", \{ "data-wk": "headme", style: \{ display: "none" \} \}, h\(Avatar, \{ character: meAv, size: 36, radius: 9 \}\)\)/);
  assert.match(studio, /\["headme", "顶栏里她自己的头像/);
});
