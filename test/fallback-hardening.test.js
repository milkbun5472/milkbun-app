// 她 2026-09-29：「123 都修」——列表半截捡救／网络抖一下再试一次／直接调模型的地方也能报失败
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const fn = name => { const i = engine.indexOf("function " + name + "("); assert.ok(i >= 0, name); return engine.slice(i, engine.indexOf("\n}\n", i) + 3); };
const X = new Function(fn("repairJSON") + fn("escapeJsonStringControls") + fn("extractJSON") + "\nreturn { extractJSON };")();

test("列表写到一半被截断：写完整的那几项收下，残缺的最后一项丢掉", () => {
  const raw = '{"items":[{"name":"毛毯","price":189,"desc":"暖"},{"name":"咖啡","price":59,"desc":"香"},{"name":"耳机","pri';
  const d = X.extractJSON(raw);
  assert.deepEqual(d.items.map(x => x.name), ["毛毯", "咖啡"]);
});
test("正文里直接换行：裸 extractJSON 现在也解得开", () => {
  assert.equal(X.extractJSON('{"body":"第一行\n第二行"}').body, "第一行\n第二行");
});
test("好好的 JSON 一个字不动（修剪只在修截断那条路上）", () => {
  const ok = '{"items":[{"a":1,"b":2},{"a":3}]}';
  assert.deepEqual(X.extractJSON(ok), { items: [{ a: 1, b: 2 }, { a: 3 }] });
});

function wrapper(behaviors) {
  const src = engine.slice(engine.indexOf("async function callAI("), engine.indexOf("async function callAIOnce("));
  let n = 0; const events = [];
  const once = async (p, s, m, o) => { const b = behaviors[n++]; if (typeof b === "function") return b(o); if (b instanceof Error) throw b; return b; };
  const win = { dispatchEvent: ev => events.push(ev.detail) };
  const call = new Function("callAIOnce", "window", "CustomEvent", "setTimeout", src + "\nreturn callAI;")(
    once, win, function (t, o) { return o; }, (f) => f());
  return { call, calls: () => n, events };
}
test("网关 502：等一下再发一次，成功就当没事", async () => {
  const w = wrapper([new Error("Bad Gateway 502"), "好了"]);
  assert.equal(await w.call({}, "", [], {}), "好了");
  assert.equal(w.calls(), 2);
});
test("超时不重试（可能已经扣过钱），并且广播失败让 app 弹提示", async () => {
  const w = wrapper([new Error("请求超时，请重试（模型或网络太慢）")]);
  await assert.rejects(w.call({}, "", [], { tag: "外卖" }));
  assert.equal(w.calls(), 1);
  assert.equal(w.events[0].tag, "外卖");
});
test("流式已经吐过字的不重试，免得同一句话冒两遍", async () => {
  const w = wrapper([o => { o.onDelta("半句"); throw new Error("503 Service Unavailable"); }]);
  await assert.rejects(w.call({}, "", [], { onDelta: () => {} }));
  assert.equal(w.calls(), 1);
});
test("没填密钥这类配置问题：不当成「生成失败」广播", async () => {
  const w = wrapper([new Error("尚未填写密钥，去设置里补上")]);
  await assert.rejects(w.call({}, "", [], {}));
  assert.equal(w.events.length, 0);
});
