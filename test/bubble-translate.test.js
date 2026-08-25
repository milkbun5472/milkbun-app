const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

const lang = new Function(
  engine.slice(engine.indexOf("function _transStrip"), engine.indexOf("const TRANS_CACHE_KEY"))
  + "\nreturn translatableLang;")();

// 她 2026-08-25：角色发了别的语言，点一下像语音那样把气泡撑开、同时显示中文。

test("认得出真的外语", () => {
  assert.equal(lang("おはよう、今日も頑張ってね"), "日文");
  assert.equal(lang("잘 자요, 내일 봐요"), "韩文");
  assert.equal(lang("Спокойной ночи"), "俄文");
  assert.equal(lang("Good night, get some rest"), "英文");
  assert.equal(lang("Bonne nuit, dors bien mon cœur"), "外语");
  // 假名/谚文是决定性的：句子里还有汉字也照样算日文
  assert.equal(lang("今日はいい天気ですね"), "日文");
});

// ⚠️判定必须保守：宁可漏，也不能让每条中文消息底下都挂个「译」。
test("绝不能把中文消息误判成外语", () => {
  [
    "装睡还非要回一句Over，等下开门看你怎么演",   // 夹一个英文词
    "我在实验室，wifi 有点卡",
    "嫌吵就把降噪耳机戴上",
    "本王偏不退",
    "好吵", "OK", "hi",                            // 太短
    "https://github.com/milkbun5472/milkbun-app",   // 链接
    "😭😭😭", "1024x1536"
  ].forEach(t => assert.equal(lang(t), "", "误判了：" + t));
});

test("点了才调 API，译文按原文缓存", () => {
  const fn = engine.slice(engine.indexOf("async function translateToZh"), engine.indexOf("async function translateToZh") + 1400);
  assert.match(fn, /const cached = transCacheGet\(text\);\n\s*if \(cached\) return cached;/, "先查缓存再花钱");
  assert.match(fn, /transCachePut\(text, zh\)/);
  assert.match(fn, /ttsHelperProfile\(\)/, "走后台线路，别占聊天线路");
  assert.match(fn, /只输出译文/);
  assert.match(fn, /保留原话的语气和口吻/, "聊天消息不是公文");
  // 没配后台线路要说人话，不能抛个天书
  assert.match(fn, /没配后台线路/);
  // 缓存要有上限，不能一直涨到把 localStorage 撑爆
  const put = engine.slice(engine.indexOf("function transCachePut"), engine.indexOf("async function translateToZh"));
  assert.match(put, /TRANS_CACHE_MAX/);
});

test("中文消息零开销：不多包一层 DOM", () => {
  const c = comp.slice(comp.indexOf("function TransText"), comp.indexOf("// 语音消息："));
  assert.match(c, /if \(!lang\) return text;/, "不是外语就把原字符串原样还回去");
  // 形状照抄语音转文字：点一下展开、上面一条分隔线、一个小标签、下面正文
  assert.match(c, /setOpen\(o?p?e?n? ?=?>? ?false\)|setOpen\(true\)/);
  assert.match(c, /borderTop: "1px solid "/);
  assert.match(c, /译自" \+ lang/);
  assert.match(c, /翻译中…/);
  assert.match(c, /翻译失败：/, "失败要说出来，不能默默什么都不显示");
  // <div> 嵌在 <span> 里是非法嵌套，iOS 上会出布局怪象
  assert.doesNotMatch(c, /h\("div"/, "展开区要用 display:block 的 span");
  // 长按菜单不能被吃掉：只拦 click，不拦 mousedown/touchstart
  assert.match(c, /e\.stopPropagation\(\)/);
  assert.doesNotMatch(c, /onMouseDown|onTouchStart/);
});

test("单聊和群聊两处气泡都接上了", () => {
  assert.equal((comp.match(/h\(TransText, \{ text: m\.content, isU: isU \}\)/g) || []).length, 2);
  // 撤回的那条正文是「已撤回」占位，不该挂译按钮
  assert.match(comp, /m\.recalled \? m\.content : h\(TransText/);
});
