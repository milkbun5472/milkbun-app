import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/assistant-extras.js", import.meta.url), "utf8");
const asst = readFileSync(new URL("../js/assistant.js", import.meta.url), "utf8");
test("秋秋知道每种功能走哪条线路：规矩一栏 + 调用记录按用途归拢", () => {
  const now = Date.now();
  const rows = [
    { ts: now, label: "聊天回复", route: "Fable站", model: "fable-5", ok: true },
    { ts: now - 1000, label: "记忆抽取", route: "便宜后台", model: "flash", ok: false, err: "429 too many requests" },
    { ts: now - 2000, label: "记忆抽取", route: "便宜后台", model: "flash", ok: true },
    { ts: now - 3000, label: "聊天回复", route: "备用", model: "opus", ok: true }
  ];
  const win = { CallLog: { list: () => rows.slice() } };
  const ctx = { window: win, console, Date }; win.window = win; vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const X = win.AssistExtras;
  const out = X.snapshotExtra({ characters: [], apiProfiles: [] }, new Set());
  assert.ok(Array.isArray(out.线路怎么选) && out.线路怎么选.some(x => /后台线路/.test(x)));
  const chat = out.最近调用.find(x => x.用途 === "聊天回复"), mem = out.最近调用.find(x => x.用途 === "记忆抽取");
  assert.match(chat.走的线路和模型, /Fable站 · fable-5（1次）；备用 · opus（1次）/);
  assert.equal(mem.失败, 1); assert.match(mem.最近失败原因, /429/);
  assert.match(asst, /最近调用: \/线路\|模型/);
});
