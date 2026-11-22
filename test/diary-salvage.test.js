// 日记回来的东西怎么认（她 2026-11-22「容易解析失败然后啥都不返回也看不到原因，能不能加几层兜底」）
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const c = src.indexOf("function diaryFromRaw"), d = src.indexOf("if (typeof window", c);
const f = new Function("extractJSON", src.slice(c, d) + ";return diaryFromRaw;")(t => { try { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } });
test("正常 JSON 原样", () => assert.deepStrictEqual(f('{"paras":["a"]}').paras, ["a"]));
test("正文换了个字段名也收", () => assert.deepStrictEqual(f(JSON.stringify({ content: "第一段\n\n第二段写得长一点" })).paras, ["第一段", "第二段写得长一点"]));
test("没给 JSON、给了一整段正文：拆段存下", () => { const r = f("今天去了海边，风很大。\n\n晚上吃了面，想起她说过的话，心里有点空落落的，算了明天再说。"); assert.strictEqual(r.paras.length, 2); assert.ok(r._salvaged); });
test("回空、几个字：说清是哪种，带出开头原话", () => {
  assert.throws(() => f(""), /模型回空了/);
  assert.throws(() => f("嗯"), /模型回的开头是：「嗯」/);
});
test("generateDiary 走这一份", () => assert.match(src, /return diaryFromRaw\(raw\);/));
