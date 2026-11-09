import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ctx = { console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, documentElement: { style: {} } }, navigator: {} }; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {}; vm.createContext(ctx); vm.runInContext(src, ctx);
test("抽记忆时给模型看的「记过了」里有跟这段对话沾边的旧事", () => {
  const lib = [];
  for (let i = 0; i < 80; i++) lib.push({ id: "n" + i, text: "小雨 第" + i + "天聊了些日常琐事", tags: ["日常"], ts: Date.now() - i * 3600e3 });
  lib.push({ id: "old", text: "小雨 不吃香菜，一闻到就难受", tags: ["饮食", "香菜"], ts: Date.now() - 60 * 86400e3 });
  const out = ctx.memExtractAvoidList(lib, "今晚吃火锅吗？锅里别放香菜啊", 40);
  assert.ok(out.length <= 40);
  assert.ok(out.includes("小雨 不吃香菜，一闻到就难受"), "两个月前那条没带上");
  assert.ok(out.includes(lib[0].text), "最新的那条也要在");
});
test("单聊、群聊、群线下抽取都用它", () => {
  assert.equal((app.match(/memExtractAvoidList\(/g) || []).length, 3);
});
