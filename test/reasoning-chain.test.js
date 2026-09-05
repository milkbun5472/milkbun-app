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
  // OpenAI 兼容：三个字段名都要认——不同中转/模型各叫各的，少认一个就等于「这条线没有思考链」
  assert.match(engine, /_msg\.reasoning_content \? \["reasoning_content"/);
  assert.match(engine, /: _msg\.reasoning \? \["reasoning"/);
  assert.match(engine, /: _msg\.thinking \? \["thinking"/);
});

// 她 2026-08-26：同一个模型，我们这边和另一台小手机的思考链内容完全不同。
// 「这段是从哪个字段捞出来的」是排查这种事最快的一根线。
test("记下思考链来自哪个字段，展开时看得见", () => {
  assert.match(engine, /const _putMeta = \(reasoning, from\) =>/);
  ["anthropic:thinking", "gemini:thought"].forEach(x => assert.ok(engine.indexOf('"' + x + '"') > 0, x));
  assert.match(engine, /"openai:" \+ _rzn\[0\]/);
  assert.match(app, /reasonFrom: _callMeta\.from \|\| ""/);
  assert.match(comp, /"来自字段 " \+ m\.reasonFrom/);
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
  assert.match(comp, /if \(part === -1\) return h\(ReasoningBlock, \{ key: "rz" \+ i, m: m, off: dsp\.reason === false \}\);/, "用伪条目插在前面，别去动那条几十个分支的 if 链");
});

// 她 2026-08-26：「太大块太显眼了，做就一行字和箭头没有框，放第一个气泡上面越近越好」
test("收起时就是一行字加一个箭头，没有框，紧贴气泡", () => {
  const i = comp.indexOf("function ReasoningBlock(");
  assert.ok(i > 0);
  const seg = comp.slice(i, comp.indexOf("// 转发的聊天记录（v56.38）"));
  assert.match(seg, /const \[open, setOpen\] = useState\(false\)/, "默认收起");
  assert.match(seg, /深度思考/);
  assert.match(seg, /m\.reasonModel/, "模型名要露出来——她要靠它看中转有没有掺水");
  assert.match(seg, /reasonMs \/ 1000\)\.toFixed\(1\) \+ "s"/);
  assert.match(seg, /transform: open \? "rotate\(180deg\)" : "none"/);
  // 一行：整条都是 nowrap，长模型名只许省略号，不许换行把它撑成一块
  const collapsed = seg.slice(seg.indexOf('h("button", { onClick: () => setOpen'), seg.indexOf("open ? h("));
  assert.ok(!/borderRadius: 12/.test(collapsed) && !/border: "1px solid/.test(collapsed), "收起那一行不许有框");
  assert.match(seg, /margin: "0 0 2px 0"/, "顶到消息区最左边——她 2026-08-26：别飘在屏幕中间");
  assert.match(seg, /flex: 1, minWidth: 0/, "模型名再长也只许省略号，不许把这一行撑成两行");
  assert.ok((seg.match(/whiteSpace: "nowrap"/g) || []).length >= 2, "文字和模型名都不许换行");
  assert.match(seg, /textOverflow: "ellipsis"/);
});

// 她 2026-08-26：「能不能给思考这块也安个翻译键就用免费翻译的」。
// 免费那两家都是 GET 带 query，整段几千字塞进 URL 会被截断或直接失败，所以要切块。
test("长文翻译按段落切块，每块不超过 900 字，内容不丢", async () => {
  const vm2 = require("node:vm");
  const i2 = engine.indexOf("async function translateLongToZh");
  const seg = engine.slice(i2, engine.indexOf("async function translateToZh(text, lang) {"));
  const run = async src => {
    const calls = [];
    const f = new Function("translateToZh", seg + "\nreturn translateLongToZh;")(async t => { calls.push(t); return { zh: t, by: "免费" }; });
    const r = await f(src, "en");
    return { calls, zh: r.zh };
  };
  const norm = x => x.replace(/\s+/g, " ").trim();
  const para = n => Array.from({ length: n }, (_, k) => "Paragraph " + k + ". " + "x".repeat(200)).join("\n\n");

  const short = await run("Hello world");
  assert.equal(short.calls.length, 1, "短文本不该被切");

  const many = await run(para(8));
  assert.ok(many.calls.length >= 2, "长文本要切开");
  many.calls.forEach(c => assert.ok(c.length <= 900, "块太长会被免费接口截断：" + c.length));
  assert.equal(norm(many.zh), norm(para(8)), "切了又拼回来，一个字都不能少");

  // 单个段落本身就超长时，从句末切，不从词中间劈
  const oneLong = await run(("A".repeat(50) + ". ").repeat(60));
  oneLong.calls.forEach(c => assert.ok(c.length <= 900, c.length));
  assert.equal(norm(oneLong.zh), norm(("A".repeat(50) + ". ").repeat(60)));
});

test("译键走免费链，长了自动切块", () => {
  const i2 = comp.indexOf("function ReasoningBlock(");
  const seg = comp.slice(i2, comp.indexOf("// 转发的聊天记录（v56.38）"));
  assert.match(seg, /translateLongToZh\(m\.reasoning, rLang\)/);
  assert.match(seg, /translatableLang\(m\.reasoning\)/, "不是外文就别显示译键");
  assert.match(seg, /showZh && zh \? zh : m\.reasoning/, "译文和原文可以来回切");
});
