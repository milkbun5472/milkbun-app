const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs"); const vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const uniqEmoteIds = packs =>"), j = app.indexOf("// 表情包字典 x_emotePacks", i);
const ctx = {}; vm.createContext(ctx); vm.runInContext(app.slice(i, j).replace("const uniqEmoteIds", "this.uniqEmoteIds"), ctx);
test("重复或没有 id 的表情各换一个新 id，第一份留原 id（群友 2026-10-25 同图删不掉）", () => {
  const packs = [{ emotes: [{ id: "a", url: 1 }, { id: "a", url: 1 }, { url: 2 }, { url: 3 }] }, { emotes: [{ id: "a", url: 4 }] }];
  ctx.uniqEmoteIds(packs);
  const ids = packs.flatMap(p => p.emotes.map(e => e.id));
  assert.equal(ids[0], "a"); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(Boolean));
});
test("开机读档和每次保存都过这一道", () => {
  assert.match(app, /uniqEmoteIds\(_packs\);\n\s*setEmotePacks\(_packs\)/);
  assert.match(app, /const commitEmotePacks = next => \{\n\s*uniqEmoteIds\(next\);/);
});
