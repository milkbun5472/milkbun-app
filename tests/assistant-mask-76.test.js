// 秋秋能直接写面具（2026-10-28）：主面具 main、新建 new、副面具按 id；只改给了的栏
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8");

function load() {
  const win = {};
  vm.runInContext(src, vm.createContext({ window: win, console, React: { createElement: () => null }, localStorage: { getItem: () => null, setItem: () => {} }, parseJSONLoose: t => JSON.parse(t) }));
  return win.Assistant;
}

test("面具：主面具、新建、改副面具都走面具页同一处", () => {
  const A = load();
  const lib = [{ id: "mk_1", name: "小林", label: "校园", persona: "旧" }];
  let main = { name: "我", persona: "主" }, saved = [];
  const ctx = { mainMask: () => ({ ...main, id: "" }), primaryMaskId: () => "", masks: () => lib,
    onSaveMainMask: p => { main = p; }, onSaveMask: m => saved.push(m) };
  const T = A.TARGETS.mask;
  assert.deepEqual(T.read(ctx).map(x => x.id), ["main", "mk_1"]);
  T.write("main", { text: '{"persona":"新的主人设"}' }, ctx);
  assert.equal(main.persona, "新的主人设"); assert.equal(main.name, "我"); assert.ok(!("id" in main));
  T.write("new", { text: '{"name":"阿远","persona":"新面具"}' }, ctx);
  assert.equal(saved[0].name, "阿远"); assert.match(saved[0].id, /^mk_/);
  T.write("mk_1", { text: '{"persona":"改过"}' }, ctx);
  assert.equal(saved[1].label, "校园"); assert.equal(saved[1].persona, "改过");
  assert.throws(() => T.write("mk_9", { text: '{"persona":"x"}' }, ctx), /找不到/);
});

test("app 把面具写口接给秋秋，主面具只有 saveMainProfile 一处写", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /onSaveMainMask: p => saveMainProfile\(p\)/);
  assert.match(app, /onSaveMask: saveOneMask/);
  assert.equal((app.match(/saveJSON\("x_profile", p\)/g) || []).length, 1);
});
