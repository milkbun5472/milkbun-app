const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs"); const vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/style-presets.js", "utf8");
test("导入的预设能整组删：模块、预设里的勾、跟着建的那份空预设一起走", () => {
  const store = {};
  const ctx = { window: {}, loadJSON: (k, d) => k in store ? JSON.parse(store[k]) : d, saveJSON: (k, v) => { store[k] = JSON.stringify(v); }, console };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const SP = ctx.window.StylePresets || Object.values(ctx.window).find(v => v && v.removeUserCat);
  const got = SP.fromPromptList({ prompts: [{ name: "a", content: "甲" }, { name: "b", content: "乙" }] }, "This World");
  SP.importBundle(got);
  const cat = got.modules[0].cat;
  assert.equal(SP.removeUserCat(cat), 2);
  assert.equal(SP.allCats().filter(c => c.id === cat).length, 0);
  assert.equal(SP.list().filter(p => p.id === "sp_" + cat).length, 0);
});
test("界面：导入的组底下有「删掉这一整组」，删前提醒导出", () => {
  const lab = fs.readFileSync(__dirname + "/../js/style-lab.js", "utf8");
  assert.match(lab, /"data-wk": "slcatdel"/); assert.match(lab, /SP\.removeUserCat\(c\.id\)/); assert.match(lab, /导出全部数据/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"slcatdel"/);
});
