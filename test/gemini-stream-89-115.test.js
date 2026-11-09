// 她 2026-11-05 接上谷歌官方直连后问「为啥感觉比中转还慢」：
// 慢的不是谷歌——这条方言原来只会 :generateContent 这个一次性接口，必须等整条写完才一起吐出来，
// 于是前十几秒是纯黑屏，而中转站（OpenAI 方言，早就有 SSE）一秒就开始蹦字。总时长差不多，体感差一倍。
// 这一份钉两件事：① 真的改发流式接口了；② 收回来的东西拼成跟一次性接口一模一样的形状。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const engine = fs.readFileSync("js/engine.js", "utf8");

// ⚠️锚只钉函数名/常量名，不钉注释、不钉整行参数表（施工规则/anchor-on-code）
const cut = (from, to) => {
  const i = engine.indexOf(from), j = engine.indexOf(to, i);
  assert.ok(i > 0 && j > i, "抠不出 " + from);
  return engine.slice(i, j);
};

test("谷歌那条真的改发流式接口了，工具回合除外", () => {
  assert.match(engine, /":streamGenerateContent\?alt=sse"/, "得用谷歌的 SSE 接口");
  // 带工具时不走流式：functionCall 的参数在 SSE 里是一片片的 delta，拼错就是调错工具
  assert.match(engine, /const gWantStream = [^\n]*&& !gTools &&[^\n]*streamOffFor\(p\)\)/);
  assert.match(engine, /const postGemini = async \(stream\) =>/);
});

test("收回来拼成跟一次性接口一样的形状：思考和正文分得开，onDelta 不吐思考", async () => {
  // 桩照【谷歌真的发什么】写：每行 data: 一个 GenerateContentResponse 片段（施工规则/stub-from-the-writer）
  const chunks = [
    'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: "先想", thought: true }], role: "model" } }] }) + '\n\n',
    'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: "你" }], role: "model" } }] }) + '\n\n',
    'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: "好" }], role: "model" }, finishReason: "STOP" }], modelVersion: "gemini-3.8-flash", usageMetadata: { promptTokenCount: 31000, candidatesTokenCount: 900, thoughtsTokenCount: 100, cachedContentTokenCount: 30000 } }) + '\n\n'
  ];
  const enc = new TextEncoder();
  const r = { headers: { get: () => "text/event-stream" }, body: { getReader: () => ({
    read: async () => chunks.length ? { value: enc.encode(chunks.shift()), done: false } : { done: true },
    cancel: () => Promise.resolve()
  }) } };
  const seen = [];
  const body = cut("async function pumpSSE(", "function recordUsage(")
    + "\n" + cut("      const acc = [];", "      await pumpSSE(r, opts, consume")
    + "\n      await pumpSSE(r, opts, consume, { stop: () => gDone });"
    + "\n      return gErr ? { error: gErr } : { candidates: [{ content: { parts: acc }, finishReason: gFinish || 'STOP' }], usageMetadata: gUsage || null, modelVersion: gModel };";
  const run = new Function("r", "opts", "TextDecoder", "return (async () => {" + body + "})();");
  const d = await run(r, { onDelta: t => seen.push(t) }, TextDecoder);

  const parts = d.candidates[0].content.parts;
  assert.equal(parts.length, 2, "思考一段、正文一段，不许接成一段");
  assert.equal(parts[0].thought, true);
  assert.equal(parts[0].text, "先想");
  assert.equal(parts[1].text, "你好", "连着的正文片段要并成一段");
  assert.ok(!parts[1].thought);
  assert.deepEqual(seen, ["你", "好"], "思考不许当正文吐给界面");
  assert.equal(d.candidates[0].finishReason, "STOP");
  assert.equal(d.modelVersion, "gemini-3.8-flash");
  assert.equal(d.usageMetadata.promptTokenCount, 31000);
});

test("报错时谷歌回的是普通 JSON，不另发一枪，按 JSON 读", () => {
  assert.match(engine, /if \(!\(stream && \/text\\\/event-stream\/i\.test\([^\n]*\)\)\) return await readAIJSON\(r\);/);
  // 一发就被拒（还没吐字）才退回一次给完；已经吐过字的不重发——那种可能已经扣了钱
  assert.match(engine, /if \(d && d\.error && !_gStreamGot\) \{ const d2 = await postGemini\(false\); if \(!d2\.error\) \{ streamLearnOff\(p\); d = d2; \} \}/);
});

test("用量：谷歌的字段名翻成同一张表，没回 usage 就不编数", () => {
  assert.match(engine, /ug\.promptTokenCount/);
  assert.match(engine, /ug\.candidatesTokenCount\) \|\| 0\) \+ \(\(ug && ug\.thoughtsTokenCount/, "思考也是按输出收的");
  assert.match(engine, /ug\.cachedContentTokenCount/);
  assert.match(engine, /\}, opts, ug \? \{ in: gIn, out: gOut, cr: gCr \} : null\)/, "没有 usageMetadata 就不填 _tok");
});

test("收流和记用量各只有一份（施工规则/one-public-mechanism）", () => {
  assert.equal((engine.match(/\.body\.getReader\(\)/g) || []).length, 1, "SSE 收流只许有 pumpSSE 这一份");
  assert.equal((engine.match(/window\.__usage = window\.__usage \|\| \[\]/g) || []).length, 1, "落库只许有 recordUsage 这一份");
  // 三条方言都从那一处过
  assert.equal((engine.match(/recordUsage\(/g) || []).length, 4, "定义 1 处 + anthropic/openai/gemini 各 1 处");
  assert.ok(!/window\.__cacheStat = \(\) =>[\s\S]{0,200}anthropic 调用/.test(engine), "汇总不再只认 anthropic");
});
