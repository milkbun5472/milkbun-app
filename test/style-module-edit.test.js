// 文风台内置模块能改、能自己写（群友 2026-10-10）：内置原文不动，改动另存；恢复原样就是删掉改动
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const src = fs.readFileSync(require.resolve("../js/style-presets.js"), "utf8");
const store = {};
const ctx = { window: {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const SP = ctx.window.StylePresets;

test("改内置：读到改后的，原文不动；恢复原样回到原文", () => {
  const id = Object.keys(SP.MODULES).find(k => typeof SP.MODULES[k].text === "string");
  const orig = SP.MODULES[id].text;
  SP.saveModuleEdit(id, { name: "我改的", hint: "", text: "改过的要求" });
  assert.equal(SP.moduleById(id).text, "改过的要求");
  assert.equal(SP.moduleById(id).edited, true);
  assert.equal(SP.MODULES[id].text, orig);
  assert.ok(SP.allCats().some(c => c.mods.some(m => m.id === id && m.text === "改过的要求")));
  assert.equal(SP.textFor({ mods: [id] }), "改过的要求");
  SP.resetModule(id);
  assert.equal(SP.moduleById(id).text, orig);
});
test("现算的那几条不让改", () => {
  const fid = Object.keys(SP.MODULES).find(k => typeof SP.MODULES[k].text === "function");
  if (!fid) return;
  assert.equal(SP.canEditModule(fid), false);
  assert.throws(() => SP.saveModuleEdit(fid, { name: "x", text: "y" }), /现算/);
});
test("自己写一个：进「我写的」，能改", () => {
  const m = SP.addUserModule({ name: "只写对白", text: "这一场只写对白。" });
  assert.ok(SP.allCats().some(c => c.zh === "我写的" && c.mods.some(x => x.id === m.id)));
  SP.saveModuleEdit(m.id, { name: "只写对白", text: "只写对白，不写旁白。" });
  assert.equal(SP.moduleById(m.id).text, "只写对白，不写旁白。");
  assert.throws(() => SP.addUserModule({ name: "", text: "x" }), /名字和内容/);
});
