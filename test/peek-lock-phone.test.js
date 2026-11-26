// 他翻完手机吃醋生气了，可以把她手机锁上（她 2026-11-24）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js"), p = src("peek-phone.js"), ts = src("theme-studio.js");
const loadPeek = () => { const w = {}; new Function("window", "React", p)(w, {}); return w.PeekPhone; };

test("lock 一趟只留一次，不管写在哪儿都挪到最后", () => {
  const P = loadPeek();
  const out = P.cleanScript({ steps: [{ do: "lock", text: "「先说清楚」" }, { do: "open", app: "messages" }, { do: "lock", text: "第二次" }, { do: "think", text: "她在干嘛" }] }, ["chat", "messages"], {});
  const locks = out.filter(s => s.do === "lock");
  assert.strictEqual(locks.length, 1);
  assert.strictEqual(locks[0].text, "先说清楚");
  const two = P.cleanScript({ steps: [{ do: "lock", lines: ["「过来」", "", "手机我先拿着"] }] }, ["chat"], {}).find(s => s.do === "lock");
  assert.deepStrictEqual(two.lines, ["过来", "手机我先拿着"], "好几句：一句一条，空的不要");
  assert.strictEqual(out[out.length - 1].do, "lock");
});

test("开关默认不许；只有开了才给他提这一步、效果才落地", () => {
  assert.match(a, /useState\(\(\) => loadJSON\("x_phoneLockOk", \{\}\) \|\| \{\}\)/);
  assert.match(a, /phoneLockOk\[charId\] && !\(loadJSON\("x_phoneLock", null\)\) \? "\\n翻完你可以在最后加一步/);
  assert.match(a, /if \(step\.do === "lock"\) \{\n\s+if \(!phoneLockOk\[viewerId\]\) return;/);
  assert.match(a, /"paycart", "unblockme", "lock"\]\.includes\(st\.do\)/, "偷偷翻那一路也当场锁");
});

test("锁着时：跟他的聊天以外都换成锁屏（主屏、重开 app 也是）；放录像时不挡", () => {
  assert.match(a, /if \(phoneLock && !peekPlay && !\(screen === "thread" && activeChar && String\(activeChar\.id\) === String\(phoneLock\.by\)\)\) \{/);
  assert.ok(!/"回主屏"/.test(c.slice(c.indexOf("function PhoneLockScreen"), c.indexOf("function Spinner"))), "锁屏上没有回主屏");
  assert.match(a, /body = h\(PhoneLockScreen, \{[^}]*onForce: forceUnlockPhone/);
  assert.match(c, /function PhoneLockScreen\(/);
});

test("他在聊天里自己解开；强行解开他会知道", () => {
  assert.match(a, /openCaps\.push\("unlockphone"\)/);
  assert.match(a, /if \(parsed\.unlockphone === true && !sideRoom\)/);
  assert.match(a, /peekLogAdd\(L\.by, \{ how: "forceunlock", note: nt \}\)/);
  assert.match(a, /给你留了一句：「" \+ x\.note/);
  assert.match(c, /disabled: !note\.trim\(\), onClick: \(\) => onForce\(note\.trim\(\)\)/, "不写一句解不开");
  assert.match(a, /x\.how === "forceunlock" \?/);
});

test("新挂点都登记了", () => {
  for (const k of ["peeklockok", "phonelock", "phonelockicon", "phonelockbg", "phonelockdate", "phonelockclock", "phonelockcards", "phonelockcard", "phonelocktitle", "phonelocktext", "phonelocksub", "phonelockbtn", "phonelockforce", "phonelockleave", "phonelockleaveinput", "phonelockleavebtn"]) {
    assert.ok(ts.includes('["' + k + '"'), k);
    assert.ok(c.includes('"data-wk": "' + k + '"'), k);
  }
});
// 锁屏那几句只说它是什么、用他自己的口吻（她 2026-11-26「都有点放狠话了」）
{ const fs2 = require("fs"), a2 = fs2.readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  require("assert").ok(/锁屏上那几条，就是你这会儿想对她说的话：站在你是她的谁那儿，用你平时跟她说话的样子说/.test(a2), "锁屏话的口吻");
  require("assert").ok(!/把她的手机收走/.test(a2), "不再框成收走"); }
