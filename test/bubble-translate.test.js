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

// 她 2026-08-25：「没有免费的办法吗！」——是我上来就用了模型。
// 改成免费优先、一级一级往下退，模型只当兜底。
test("免费优先：Google → MyMemory → 模型兜底", () => {
  const fn = engine.slice(engine.indexOf("async function translateToZh"), engine.indexOf("async function translateToZh") + 1600);
  const i0 = fn.indexOf("_transGoogle"), i1 = fn.indexOf("_transMyMemory"), i2 = fn.indexOf("_transModel");
  assert.ok(i0 > 0 && i1 > i0 && i2 > i1, "顺序必须是 免费→免费→模型，模型绝不能排在前面");
  assert.match(fn, /if \(cached && cached\.zh\) return cached;/, "先查缓存，一分钱不花");
  // 每一级都要短超时，不能让她对着「翻译中…」干等
  const g = engine.slice(engine.indexOf("async function _transGoogle"), engine.indexOf("async function _transMyMemory"));
  assert.match(g, /_fetchJSON\(u, 7000\)/);
  const mm = engine.slice(engine.indexOf("async function _transMyMemory"), engine.indexOf("async function _transModel"));
  assert.match(mm, /_fetchJSON\(u, 8000\)/);
  // MyMemory 额度用尽时会把错误话塞进 translatedText 当正文回来（跟中转站一个毛病）
  assert.match(mm, /MYMEMORY WARNING\|QUERY LENGTH LIMIT/);
  // 三级都挂要把三条原因都报出来，不能只报最后一条
  assert.match(fn, /三条都没翻成/);
  assert.match(fn, /errs\.join\("；"\)/);
});

test("免费接口不许要 key，也不许把她的文字送去没写明的地方", () => {
  const g = engine.slice(engine.indexOf("async function _transGoogle"), engine.indexOf("async function _transModel"));
  assert.match(g, /translate\.googleapis\.com/);
  assert.match(g, /api\.mymemory\.translated\.net/);
  assert.doesNotMatch(g, /apiKey|Authorization|key=/, "免费引擎不该出现任何密钥");
  // 语种直接用我们自己判出来的，别指望它们的 auto
  assert.match(engine, /const TRANS_LANG_CODE = \{ "日文": "ja", "韩文": "ko", "俄文": "ru", "英文": "en"/);
});

test("模型只是兜底，但兜底那份的要求不许降级", () => {
  const m = engine.slice(engine.indexOf("async function _transModel"), engine.indexOf("async function translateToZh"));
  assert.match(m, /ttsHelperProfile\(\)/, "走后台线路，别占聊天线路");
  assert.match(m, /只输出译文/);
  assert.match(m, /保留原话的语气和口吻/, "聊天消息不是公文");
  assert.match(m, /免费接口没通，后台线路也没配/);
});

test("缓存要记住是谁翻的，而且认得旧格式", () => {
  const get = engine.slice(engine.indexOf("function transCacheGet"), engine.indexOf("function transCachePut"));
  assert.match(get, /typeof v === "string" \? \{ zh: v, by: "" \}/, "v55.99 存的是裸字符串，不能读崩");
  const put = engine.slice(engine.indexOf("function transCachePut"), engine.indexOf("const TRANS_LANG_CODE"));
  assert.match(put, /\{ zh: zh, by: by \|\| "" \}/);
  assert.match(put, /TRANS_CACHE_MAX/, "缓存要有上限，别把 localStorage 撑爆");
});

test("中文消息零开销：不多包一层 DOM", () => {
  const c = comp.slice(comp.indexOf("function TransText"), comp.indexOf("// 语音消息："));
  assert.match(c, /if \(!lang\) return text;/, "不是外语就把原字符串原样还回去");
  // 形状照抄语音转文字：点一下展开、上面一条分隔线、一个小标签、下面正文
  assert.match(c, /setOpen\(o?p?e?n? ?=?>? ?false\)|setOpen\(true\)/);
  assert.match(c, /borderTop: "1px solid "/);
  assert.match(c, /"译自" \+ lang \+ \(by \? " · " \+ by : ""\)/, "要标出是免费翻的还是模型翻的——她一眼能看出花没花钱");
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
