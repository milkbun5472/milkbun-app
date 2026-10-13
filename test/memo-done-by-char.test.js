// 她 2026-10-13：鬼屋去过了、备忘录没勾，TA天天来问「去成没」
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const memo = R("memo.js"), app = R("app.js");
test("过期没勾的那条：记得办了就别再问，一次性的还教TA顺手勾掉", () => {
  assert.match(memo, /要是你记得这事已经办了.*就当办完了，别再问/);
  assert.match(memo, /\\"memoDone\\":\[/);
});
test("memoDoneByChar 只勾TA看得见、一次性、标题对得上的", () => {
  let store = { reminders: [
    { title: "周六鬼屋", repeat: "none", visibleTo: ["c1"], done: false },
    { title: "周六鬼屋", repeat: "none", visibleTo: ["c2"], done: false },
    { title: "交房租", repeat: "monthly", visibleTo: ["c1"], done: false }] };
  const i = memo.indexOf("  window.memoDoneByChar = function");
  const j = memo.indexOf("\n  };", i) + 5;
  const win = {};
  new Function("window", "loadData", "saveData", memo.slice(i, j))(win, () => store, d => { store = d; });
  assert.deepEqual(win.memoDoneByChar("c1", ["鬼屋"]), ["周六鬼屋"]);
  assert.equal(store.reminders[1].done, false, "别人的不动");
  assert.deepEqual(win.memoDoneByChar("c1", ["交房租"]), [], "重复的不勾");
  assert.match(app, /window\.memoDoneByChar\(charId, parsed\.memoDone\)/);
});
