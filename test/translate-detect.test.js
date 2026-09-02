const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");
const detect = new Function(engine.slice(engine.indexOf("function _transStrip"), engine.indexOf("const TRANS_CACHE_KEY")) + "\nreturn translatableLang;")();

// 她 2026-08-26 拿 jrsy-web 对比：「它聊天也是可以翻译的，感觉比我们翻译的好」。
// 看完它的代码——用的是【同一个】Google 免费接口、同样的解析。差别只在【什么时候给译键】：
// 它是长按菜单里永远有一个「翻译」，不做任何语种判断；我们是自动识别外语才挂译键。
// 她要的是「在旁边可以按」，所以不搬它的长按菜单，改成把识别放宽。
test("汉字为主的日文也要认出来——那正是最需要翻的一类", () => {
  assert.equal(detect("今夜も残業"), "日文", "只有一个假名，旧的 ≥2 会漏掉");
  assert.equal(detect("明日は雨か"), "日文");
  assert.equal(detect("안녕"), "韩文");
  assert.equal(detect("Привет"), "俄文");
});

test("短外语句也给译键，但单词级的口头禅不给", () => {
  ["Bonjour", "Merci beaucoup", "Ich liebe dich"].forEach(x => assert.ok(detect(x), x + " 应该给译键"));
  ["OK", "Over", "Sorry", "hi"].forEach(x => assert.equal(detect(x), "", x + " 不该挂译键"));
});

test("中英混着说的不给——她自己读得懂，挂上去只是碍眼", () => {
  assert.equal(detect("这个 deadline 我 handle 不了"), "");
  assert.equal(detect("回一句 Over 就行"), "");
});

test("纯中文一律不包一层，零开销那条路要留着", () => {
  assert.equal(detect("今天实验做完了"), "");
  assert.equal(detect(""), "");
  assert.equal(detect(null), "");
});

// 她 2026-08-26：「不要，我喜欢在旁边可以按翻译，不要放长按里面宝宝」
test("译键留在气泡旁边，长按菜单里不许有翻译", () => {
  const i = comp.indexOf("function menuItemsForKind(m)");
  const seg = comp.slice(i, i + 900);
  assert.ok(!/"trans"/.test(seg), "长按菜单里不该有翻译");
  assert.match(comp, /}, open \? "收起" : "译"\)/, "气泡旁边那个译键还在");
});

// 提前 return 卡在 hook 前面＝条件调用 hook，同一条消息编辑过就会对不上、当场炸
test("TransText 的提前 return 排在所有 hook 之后", () => {
  const i = comp.indexOf("function TransText({ text, isU, zhReady })");
  const body = comp.slice(i, comp.indexOf("function VoiceMsg(", i));
  const lastHook = Math.max(body.lastIndexOf("useState("), body.lastIndexOf("useEffect("));
  const early = body.indexOf("if (!lang) return text;");
  assert.ok(early > lastHook, "提前 return 必须排在最后一个 hook 后面");
});

test("长消息走切块版，别整段塞进 GET 的 query 里", () => {
  const i = comp.indexOf("function TransText({ text, isU, zhReady })");
  const body = comp.slice(i, comp.indexOf("function VoiceMsg(", i));
  assert.match(body, /translateLongToZh\(text, lang\)/);
});
