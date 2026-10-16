// 她 2026-10-13：OOC 里商量好「下一轮他去做 X」，不是长期规矩——原来不记，回复时他根本看不见
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const eng = R("engine.js"), app = R("app.js");
test("OOC 能判出「只管接下来几轮」的安排，轮数 1~10", () => {
  assert.match(eng, /\(C\) 不是长期规矩，而是【只管接下来几轮】的安排/);
  const i = eng.indexOf("function oocResult("), j = eng.indexOf("\n}", i) + 2;
  const f = new Function(eng.slice(i, j) + "; return oocResult;")();
  assert.deepEqual(f({ reply: "好", soon: { text: "下一轮主动提出去接她", turns: 1 } }, []).soon, { text: "下一轮主动提出去接她", turns: 1 });
  assert.equal(f({ reply: "好", soon: { text: "x", turns: 99 } }, []).soon.turns, 10);
  assert.equal(f({ reply: "不行", refused: true, soon: { text: "x", turns: 2 } }, []).soon, null, "拒绝了就不记");
  assert.equal(f({ reply: "分析" }, []).soon, null);
});
test("线上线下共用同一张：记在主聊天便签里，线下读、线下也扣", () => {
  assert.match(app, /const oocSoonNote = \(chatKey, soon\) =>/);
  assert.match(app, /oocSoonNote\(chatKey, res\.soon\)/);
  assert.match(app, /oocSoonNote\(sideRoom \? scopeKey : charId, res\.soon\)/);
  assert.match(app, /customNotes: \[\.\.\.\(workSess\.customNotes \|\| \[\]\), \.\.\._oocSoon\]/);
  assert.match(app, /n\.from === "ooc"/);
});
