import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/gacha.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
const K = ctx.GachaKit || ctx.window.GachaKit;
test("现做的卡带「别把刚才聊天重写一遍」；「此刻TA眼里的你」还要求几句、不写成一场戏", () => {
  assert.match(K.makeExtraOf("s_look"), /别把那一段换个说法再写一遍/);
  assert.match(K.makeExtraOf("s_look"), /不是一场戏/);
  assert.match(K.makeExtraOf("s_word"), /别把那一段换个说法再写一遍/);
  assert.equal(K.makeExtraOf("x_past"), "");
});
test("只加在普通角色那条路上，言秋书房那条照旧只拿卡面", () => {
  assert.equal((app.match(/makeExtraOf\(card\.poolId\)/g) || []).length, 1);
  assert.doesNotMatch(K.askOf("s_look"), /不是一场戏|别把那一段/);
});
