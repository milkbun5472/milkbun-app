const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const theater = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");

// 她 2026-08-18 报「群聊生成失败：The string did not match the expected pattern.」——
// 一句 WebKit 的 DOMException，光看文案定位不到是哪一步、哪个 API 抛的。
test("群聊报错要带上错误类型和当时走到哪一步", () => {
  assert.match(app, /let phase = "准备上下文";/);
  ["等模型回复", "解析回复", "落地发言"].forEach(p =>
    assert.match(app, new RegExp('phase = "' + p + '";'), p + " 这一步要打点"));
  assert.match(app, /const kind = e && e\.name && e\.name !== "Error" \? "\[" \+ e\.name \+ "\] " : "";/);
  assert.match(app, /群聊生成失败·" \+ phase \+ "：" \+ kind/);
});

// 同一趟里翻出来的静默漏：解析不出数组时，整个分支【什么都不做】，
// 她只会看到点了没反应，连失败提示都没有。
test("群聊解析不出数组必须报出来，不许静默吞掉一整轮", () => {
  const seg = app.slice(app.indexOf('phase = "解析回复"'), app.indexOf('phase = "落地发言"'));
  assert.match(seg, /let arr = parseJSONLoose\(raw\);/, "走加固解析，不再裸 extractJSON");
  assert.match(seg, /if \(!Array\.isArray\(arr\)\) \{/);
  assert.match(seg, /throw new Error\("模型没按 JSON 数组输出"/);
  assert.match(seg, /它回的是：/, "认输时要带上模型到底回了什么");
  // 裹进对象、或只回一条的情况先救一把，别整轮丢掉
  assert.match(seg, /\["items", "messages", "replies", "list"\]/);
  assert.match(seg, /arr\.name && \(arr\.text \|\| arr\.redpacket \|\| arr\.emote\)/);
});

test("控制字符转义只留一份实现，主聊天/群聊/小剧场共用", () => {
  assert.match(engine, /function escapeJsonStringControls\(value\) \{/);
  assert.match(engine, /function parseJSONLoose\(raw\) \{/);
  assert.doesNotMatch(theater, /const escapeJsonStringControls = /, "小剧场不许再抄一份");
});

test("行为验证：群聊回复里的真换行不再整轮报废", () => {
  const fn = (src, name) => {
    const i = src.indexOf("function " + name);
    return src.slice(i, src.indexOf("\n}\n", i) + 3);
  };
  const mod = new Function(fn(engine, "repairJSON") + fn(engine, "extractJSON") +
    fn(engine, "escapeJsonStringControls") + fn(engine, "parseJSONLoose") +
    "\nreturn { parseJSONLoose, extractJSON };")();
  const bad = '[{"name":"沈屿白","text":"我先去趟书房。\n晚点再说。"},{"name":"银龙","text":"随你。"}]';
  assert.equal(mod.extractJSON(bad), null, "裸 extractJSON 本来就死在这里");
  const arr = mod.parseJSONLoose(bad);
  assert.ok(Array.isArray(arr) && arr.length === 2);
  assert.equal(arr[0].text, "我先去趟书房。\n晚点再说。");
  assert.equal(arr[1].name, "银龙");
});
