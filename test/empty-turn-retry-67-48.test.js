// 她 2026-09-12（截图：她问「那要是有了呢」，回来只有一行灰字动作）：
//「宝宝为啥有时只有动作和心声没有气泡」
//
// word 这一格可以整个空着回来——而空了之后【没有任何人接手】：
// 动描那一行照样摆出去，delivered 仍然是 false，调用方从来不看这个返回值。
// 于是她等来一行动作、一个字都没有，而那一次调用的钱已经花了。
// 协议里本来就有正经的「不说话」出口（silent:true＝已读不回），空 word 不是它。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 外面那层单独跑：给它一个「跑完了但空」的内层，看会不会重来
const wrap = (() => {
  const i = app.indexOf("  const replyNow = async (charId, extraText, mode, opts) => {");
  const j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出外面那层");
  return app.slice(i, j + 5);
})();
const run = (results, opts) => {
  const calls = [];
  const box = new Function("_replyTurn", wrap + "\nreturn replyNow;")(
    async (cid, text, mode, o) => { calls.push({ text, o }); return results[calls.length - 1]; });
  return box("c1", "她说的那句", null, opts).then(r => ({ r, calls }));
};

test("⭐跑完了却一个字都没送到 → 再来一次", async () => {
  const { r, calls } = await run([false, true], {});
  assert.equal(calls.length, 2, "没有重来——她等来的就是一行灰字动作");
  assert.equal(r, true);
});

test("重来那一次不把她的话再塞一遍（照现有对话重生成）", async () => {
  const { calls } = await run([false, true], {});
  assert.equal(calls[0].text, "她说的那句");
  assert.equal(calls[1].text, null, "又把她那句话当成新消息塞进去了＝她的话会出现两遍");
  assert.equal(calls[1].o._emptyRetry, true, "没打标记的话会无限重来");
});

test("只重来一次，不许连环", async () => {
  const { r, calls } = await run([false, false], {});
  assert.equal(calls.length, 2, "第二次还是空就到此为止");
  assert.equal(r, false);
});

test("「没跑」和「报错了」不许当成空轮再烧一次钱", async () => {
  for (const v of [null, undefined]) {
    const { calls } = await run([v, true], {});
    assert.equal(calls.length, 1, "返回 " + v + " 也被当成空轮重来了");
  }
});

test("送到了就不重来（哪怕只送出一个表情）", async () => {
  const { calls } = await run([true, true], {});
  assert.equal(calls.length, 1);
});

test("主动那一路不重来：没人在等，而且它本来就可以不说话", async () => {
  const { calls } = await run([false, true], { proactive: true });
  assert.equal(calls.length, 1);
});

// ── 里面那一支：提前退出和报错都要能跟「空轮」分开 ──────────────
test("提前退出一律 null，不是 false", () => {
  assert.match(A, /if \(laneBusy\("c:" \+ chatKey\)\) return null;/);
  assert.match(A, /if \(opts\.proactive && !autoRefreshOn\("proactive", charId\)\) return null;/);
  assert.match(A, /if \(opts\.proactive && currentlyTogetherWithChar\(charId\)\) return null;/);
  assert.match(A, /toast\("先发条消息再让 TA 回复"\);\n\s*return null;/);
  assert.match(A, /if \(Date\.now\(\) - _lastTs < 12 \* 60000\) return null;/);
  assert.match(A, /turnId: "e_" \+ Date\.now\(\)\n\s*\}\]\);\n\s*return null;/, "报错也被当成空轮就会重烧一次钱");
  // 真正跑完那一条照旧 return delivered
  assert.match(A, /return delivered;/);
});

test("里面那一支改名之后，调用点还是只认 replyNow 一个入口", () => {
  assert.match(A, /const _replyTurn = async \(charId, extraText, mode, opts\) => \{/);
  // 定义那一行是 `= async (`，名字后面带空格，不会被这条数进来
  assert.equal((A.match(/_replyTurn\(/g) || []).length, 2, "只许外层那两次调用；别的地方不许绕过外层");
});

// ── 提示词那一头：给出口，不只给禁令 ─────────────────────────
test("word 不许空，而且告诉它「不想说话」有专门的格子", () => {
  assert.match(A, /\*\*这一格不能空着\*\*/);
  assert.match(A, /她收到的是一行动作、一个字都没有/, "得说清后果，不然它不知道这条在管什么");
  assert.match(A, /就用 silent 那一格（那是专门给「已读不回」的）/, "给出口不给判决（施工规则/bans-make-it-dumber.md）");
});

test("病历留在代码里", () => {
  const i = app.indexOf("const replyNow = async (charId, extraText, mode, opts) => {");
  const doc = app.slice(Math.max(0, i - 1600), i);
  assert.match(doc, /为啥有时只有动作和心声没有气泡/);
  // ⚠️这两句在源码里是分两行写的，别拼成一条跨行的正则（跨行中间还夹着 "  // "）
  assert.match(doc, /delivered 仍是 false/);
  assert.match(doc, /调用方从来不看这个返回值/);
  assert.match(doc, /silent:true 才是「已读不回」的正经出口/);
});
