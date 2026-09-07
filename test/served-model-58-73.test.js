const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const eng = R("engine.js"), scr = R("screens.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
// 纯函数捞出来真跑
const verdict = (() => {
  const src = grab(eng, "function servedNorm(s) {", "function noteServedModel(");
  return new Function(src + "\nreturn servedVerdict;")();
})();

// 她 2026-08-31：3.7 说自己知识库到 24 年（对的），又说自己是 1.0（它没法知道）。
// 判断线路真假不能问模型——训练数据截止在它自己发布之前，那个回答是猜的。
// 唯一算数的是回包里服务端写的 model 字段。
test("同一个模型：一样的、带版本号尾巴的，都算一致", () => {
  assert.equal(verdict("claude-3-7-sonnet", "claude-3-7-sonnet"), "same");
  assert.equal(verdict("claude-3-7-sonnet-latest", "claude-3-7-sonnet-20250219"), "same");
  assert.equal(verdict("gpt-4o", "gpt-4o-2024-08-06"), "same");
  assert.equal(verdict("anthropic/claude-3-7-sonnet", "claude-3-7-sonnet"), "same");
  assert.equal(verdict("deepseek-chat:free", "deepseek-chat"), "same");
});

test("换了个模型：一眼报出来", () => {
  assert.equal(verdict("claude-3-7-sonnet", "claude-3-5-sonnet"), "diff");
  assert.equal(verdict("claude-3-7-sonnet", "gpt-4o-mini"), "diff");
  // 宁可多报一次「对不上」也不能把真的偷换说成别名：gpt-4o 不是 gpt-4
  assert.equal(verdict("gpt-4o", "gpt-4"), "diff");
});

test("线路没回传模型名就说看不出来，不许瞎判", () => {
  assert.equal(verdict("claude-3-7-sonnet", ""), "unknown");
  assert.equal(verdict("", "claude-3-7-sonnet"), "unknown");
});

test("三家协议都要接上——少接一处，那条线路就永远看不见", () => {
  const call = grab(eng, "async function callAI(p, system, messages, opts) {", "function repairJSON(");
  // ⚠️按【分支】切，不按「挨着哪一行」切：后者插进任何一行新代码都会假红
  const anth = call.slice(call.indexOf('if (fmt === "anthropic") {'), call.indexOf('if (fmt === "gemini") {'));
  const gem = call.slice(call.indexOf('if (fmt === "gemini") {'), call.indexOf("const root = base.endsWith"));
  const oai = call.slice(call.indexOf("const root = base.endsWith"));
  assert.match(anth, /_served\(d\.model\);/, "anthropic 那条没记");
  assert.match(gem, /_served\(d\.modelVersion \|\| d\.model\);/, "gemini 没记（它那个字段叫 modelVersion，不叫 model）");
  assert.match(oai, /_served\(d\.model\);/, "openai 那条没记");
  // 流式回包是自己拼出来的，不把 SSE 里的 model 带出来，走流式的线路就永远 unknown
  assert.match(call, /if \(event\.model && !sseModel\) sseModel = String\(event\.model\);/, "流式没接住模型名");
  assert.match(call, /usage: usage \|\| \{\}, model: sseModel \}/, "流式拼的回包里没带模型名");
});

test("记的是【服务端写的】那个，不是你填的那个", () => {
  const note = grab(eng, "function noteServedModel(profile, req, got) {", "async function callAI(");
  assert.match(note, /verdict: servedVerdict\(req, name\)/, "没存判定结果");
  assert.match(note, /localStorage\.setItem\("x_apiServed"/, "没存盘");
  assert.match(note, /if \(!name\) return;/, "空的也往里写,会把上一次的真结果冲掉");
  const meta = grab(eng, "  const _served = got =>", "  const _putMeta =");
  assert.match(meta, /noteServedModel\(p, model, got\)/, "没把这条线路和你填的模型一起记下去");
  // _meta.model 仍是【你填的】——两个字段要分得开，不然又变成自己证明自己
  assert.match(eng, /_meta\.model = model; _meta\.ms = Date\.now\(\) - _t0;/, "请求侧那个字段被改坏了");
});

test("设置里看得见「你填的 → 它实际给的」，对不上要标出来", () => {
  // 上限只是防止 indexOf 抓到很远的一处；v65.16「保存 ≠ 设为主用」之后这个函数长了一点
  const api = grab(scr, "function ApiConfig({", "\nfunction ", 24000);
  assert.match(api, /localStorage\.getItem\("x_apiServed"/, "设置页没去读");
  assert.match(api, /"它实际给的："/, "看不见服务端给的是哪个");
  assert.match(api, /served\.verdict === "diff" \? "#a4442e"/, "对不上的时候没标出来");
  assert.match(api, /这条线路可能把请求转给了别的模型/, "没说清对不上意味着什么");
  assert.match(api, /别去问模型「你是哪一版」/, "没说清为什么不能问模型");
  assert.match(api, /\[cur && cur\.id, editing\]/, "换一条线路时不会重读,会一直显示上一条的结果");
  // 卡片列表上也要标：一眼扫过去就知道哪条对不上，不用一张张点开
  assert.match(api, /\(\(servedAll \|\| \{\}\)\[p\.id\] \|\| \{\}\)\.verdict === "diff"/, "卡片列表上不标,得一张张点开才发现");
  assert.match(api, /"⚠ 实际给的是 " \+ servedAll\[p\.id\]\.got/, "卡片上没写实际给的是哪个");
});
