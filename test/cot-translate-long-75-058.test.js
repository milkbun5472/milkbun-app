// 英文思考链夹着中文名字/台词也要有译键（群里 2026-10-08）
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const cut = (a, b) => { const i = eng.indexOf(a), j = eng.indexOf(b, i); assert.ok(i >= 0 && j > i); return eng.slice(i, j); };
const fns = new Function("localStorage", cut("function _transStrip", "function safeTop(") + "\nreturn { translatableLang, translatableLangLong };");
const F = fns({ getItem: () => null });
const comp = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
const component = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i >= 0 && j > i); return comp.slice(i, j); };
assert.match(component("function ReasoningBlock(", "function ChatForwardCard("), /h\(TransText, \{ text: m\.reasoning,[^\n]+long: true/);
// 真正画译键的公共组件，使用实际语种判断；不再假定思考链自己保留一套翻译状态。
const render = new Function("translatableLang", "translatableLangLong", "useTheme", "useState", "useEffect", "h", "F_BODY",
  component("function TransTextState(", "function voiceBars(") + "\nreturn TransTextState;")(
  F.translatableLang, F.translatableLangLong, () => ({ ink: "#333", line: "#ddd" }),
  initial => [typeof initial === "function" ? initial() : initial, () => {}], () => {},
  (type, props, ...children) => ({ type, props, children }), "serif");
{
  const cot = "The user just said she is tired. I should respond as 沈屿白 would — gently, without lecturing. Maybe say \"早点睡\" but in his own voice, short and warm.";
  assert.strictEqual(F.translatableLang(cot), "");          // 气泡那份：有汉字就不给
  assert.strictEqual(F.translatableLangLong(cot), "英文");   // 思考链这份：英文为主就给
  assert.strictEqual(F.translatableLangLong("他说今天很累，我应该温柔一点回应 OK"), "");
  const tree = render({ text: cot, long: true, ink: "#333" });
  assert.ok(tree.children.some(node => node && node.props && node.props["data-wk"] === "translatebutton" && node.children.includes("译")));
  assert.strictEqual(render({ text: cot, ink: "#333" }), cot);
  assert.strictEqual(render({ text: "他说今天很累，我应该温柔一点回应 OK", long: true, ink: "#333" }), "他说今天很累，我应该温柔一点回应 OK");
}
console.log("cot-translate-long ok");
