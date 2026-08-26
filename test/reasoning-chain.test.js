const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const app = fs.readFileSync(R("app.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");

// 她 2026-08-26：想看模型是怎么想的——① 出了奇怪回复能对症下药；
// ② 中转有没有偷偷换便宜模型，会不会返回思考链本身就是线索。
test("思考链走出参，不走模块级「上一次」——后台调用是并发的", () => {
  assert.match(engine, /const _meta = \(opts && opts\.meta && typeof opts\.meta === "object"\) \? opts\.meta : null/);
  assert.match(engine, /_meta\.model = model; _meta\.ms = Date\.now\(\) - _t0/);
  assert.ok(!/^\s*let _lastReasoning/m.test(engine), "别退回共享变量，那必然串台");
});

test("三家协议各自的字段都接住了", () => {
  // Anthropic：thinking 块
  assert.match(engine, /filter\(b => b && b\.type === "thinking"\)/);
  // Gemini：带 thought 标记的 part
  assert.match(engine, /parts\.filter\(x => x && x\.thought\)/);
  // OpenAI 兼容：DeepSeek 一类白送的 reasoning_content
  assert.match(engine, /_msg\.reasoning_content \|\| _msg\.reasoning/);
});

// 这条是真会炸的：Gemini 的思考段也是 text 部件，不按 thought 标记拆开就会被拼进正文，
// 而我们的回复是 JSON，当场解析失败。
test("Gemini 正文必须把思考段排除掉", () => {
  assert.match(engine, /const t = parts\.filter\(x => !\(x && x\.thought\)\)\.map\(x => x\.text \|\| ""\)\.join\(""\)\.trim\(\)/);
  assert.ok(!/const t = parts\.map\(x => x\.text \|\| ""\)\.join\(""\)/.test(engine), "旧的无差别拼接不能留");
});

test("Gemini 要显式开口要，其它两家不用", () => {
  assert.match(engine, /opts\.wantReasoning \? \{ thinkingConfig: \{ includeThoughts: true \} \} : null/);
  // ⚠️Anthropic 不许主动开 thinking：会强制 temperature=1、改变输出，而且言秋住在这条线上
  assert.ok(!/thinking: \{ type: "enabled"/.test(engine), "别去开 Anthropic 的扩展思考");
});

// 她 2026-08-26：「言秋不用碰」
test("言秋那条线一个字都不碰", () => {
  assert.match(app, /const _wantReason = !_engineerChat && !!_s\.showReasoning/);
});

test("每个角色一个开关，默认关，存得下来", () => {
  assert.match(comp, /const \[showReasoning, setShowReasoning\] = useState\(!!settings\.showReasoning\)/);
  assert.match(comp, /dispRow\("显示模型思考链", showReasoning, setShowReasoning\)/);
  assert.match(app, /showReasoning: s\.showReasoning/, "onSave 里要落盘，不然一关设置就丢");
});

// 思考链属于整轮，不属于某个气泡：只挂在最先冒出来的那条上，画在这组回复上方
test("一轮只挂一份，画在这组回复上方", () => {
  const seg = app.slice(app.indexOf("let _reasonLeft"), app.indexOf("if (words.length && window.Notify)"));
  assert.match(seg, /const _takeReason = \(\) => \{ const r = _reasonLeft; _reasonLeft = null; return r \|\| \{\}; \}/, "取一次就消费掉");
  assert.match(seg, /\.\.\._takeReason\(\)/);
  assert.match(comp, /if \(part === -1\) return h\("div", \{ key: "rz" \+ i/, "用伪条目插在前面，别去动那条几十个分支的 if 链");
});

test("默认收起，点箭头展开；顺带把模型名和耗时露出来", () => {
  const i = comp.indexOf("function ReasoningBlock(");
  assert.ok(i > 0);
  const seg = comp.slice(i, comp.indexOf("// 转发的聊天记录（v56.38）"));
  assert.match(seg, /const \[open, setOpen\] = useState\(false\)/, "默认收起");
  assert.match(seg, /深度思考/);
  assert.match(seg, /m\.reasonModel/, "模型名要露出来——她要靠它看中转有没有掺水");
  assert.match(seg, /reasonMs \/ 1000\)\.toFixed\(1\) \+ "s"/);
  assert.match(seg, /transform: open \? "rotate\(180deg\)" : "none"/);
});
