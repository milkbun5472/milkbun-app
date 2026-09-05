// 「让秋秋在这个人的聊天框里可以直接改动」（她 2026-09-05）：
// OOC 里说一句「帮我改一下我的气泡颜色」「我想要梦幻风格的」，就该真的改好。
// 不另开一条调用：OOC 那一次本来就在问模型，多要一栏 skin 就够了（她按次计费）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("不为这件事多打一次电话", () => {
  const i = eng.indexOf("async function oocAsk(p, ctx, question)");
  const body = eng.slice(i, eng.indexOf("async function oocAskGroup", i));
  assert.equal((body.match(/await callAI\(/g) || []).length, 1, "多加了一次调用——她是按次计费的");
  assert.match(body, /\+ BUBBLE_AI_RULE/, "那一段没接进 system");
  assert.match(body, /skin: sanitizeBubblePatch\(parsed\.skin\)/, "回来的那一栏没收");
  assert.match(body, /directive: null, refused: false, skin: null/, "解析失败的兜底没把 skin 归零");
});

test("模型给的值当外来字符串看", () => {
  assert.match(eng, /function sanitizeBubblePatch\(obj\)/, "没有这道闸");
  // bubbleDecls 的 q() 只拦 <>{}，一个带分号的值就能多写一条声明
  assert.match(eng, /url\\s\*\\\(/, "url( 没拦");
  assert.ok(/\[;\{\}<>@/.test(eng), "分号/@/花括号没拦");
  const fn = new Function("return (" + /const bubbleAiValueOk = [\s\S]*?\n};/.exec(eng)[0].replace(/^const bubbleAiValueOk = /, "").replace(/;$/, "") + ")")();
  assert.equal(fn("#ff0055"), true);
  assert.equal(fn("linear-gradient(135deg,#4f5bd5,#8134af)"), true);
  assert.equal(fn("red;position:fixed;top:0"), false, "分号混进来还能过");
  assert.equal(fn('url("http://x/y.png")'), false);
  assert.equal(fn("#fff" + "x".repeat(200)), false, "长度没封顶");
});

test("数值卡在界内，认不出的栏一概不要", () => {
  const src = /function sanitizeBubblePatch\(obj\)[\s\S]*?\n}/.exec(eng)[0];
  const f = new Function(
    "const BUBBLE_AI_KEYS = " + JSON.stringify(["myBg","charBg","myText","charText","myBorder","charBorder","shadow","chatBg"]) + ";"
    + "const bubbleAiValueOk = v => { const s=String(v==null?'':v).trim(); return !!s && s.length<=160 && !/[;{}<>@\\\\]|url\\s*\\(/i.test(s); };"
    + src + "return sanitizeBubblePatch;")();
  assert.deepEqual(f({ myBg: "#fff", radius: 999 }), { myBg: "#fff", radius: 30 }, "圆角没卡上限");
  assert.deepEqual(f({ radius: -5 }), { radius: 0 });
  assert.equal(f({ position: "fixed" }), null, "自造的栏被放进来了");
  assert.equal(f({}), null);
  assert.equal(f(null), null);
  // 贴纸不给它填：模型只会编一个不存在的图片地址出来
  assert.equal(f({ mySticker: "https://x/a.png" }), null, "贴纸这一栏不该收");
});

test("那一段不给内容示范，只给判据", () => {
  const i = eng.indexOf("const BUBBLE_AI_RULE =");
  const rule = eng.slice(i, eng.indexOf("// OOC：跳出角色", i));
  // 判据（prompt-no-content-samples）：这一句被逐字照抄是对的还是错的？
  // 「#hex」「0-30 的整数」照抄没问题——它们说的是【格式】；
  // 一套具体配色照抄就是灾难——那是【内容】，必须由她那句话长出来。
  assert.ok(rule.indexOf("linear-gradient(...)") > 0, "连格式都没说，模型不知道能填渐变");
  assert.ok(!/#[0-9a-fA-F]{6}/.test(rule), "写了一个具体色值——以后不管什么风格都会往它上面靠");
  assert.ok(rule.indexOf("梦幻") < 0 && rule.indexOf("清新") < 0, "把某种风格写死成例子了");
  assert.match(rule, /字要看得清/, "没有那条压过审美的底线");
  assert.match(rule, /只改那一处/, "她只说一处时会被整套换掉");
});

test("落进的是「这个人自己的气泡」那一层，而且是打补丁", () => {
  assert.match(app, /const applyOocSkin = \(charId, skin\) => \{/, "改完没落盘");
  assert.match(app, /bubble: Object\.assign\(\{\}, base, skin, \{ _tuned: true \}\)/, "不是在她当前那一套上打补丁");
  assert.match(app, /const base = \(cur\.bubble && typeof cur\.bubble === "object"\) \? cur\.bubble\s*\n?\s*: \(typeof BUBBLE_SKIN === "object" \? Object\.assign\(\{\}, BUBBLE_SKIN\) : \{\}\)/,
    "跟随全局时没把全局那份铺开当底——只存孤零零一栏，看着像没改全");
  assert.match(app, /saveJSON\("x_chatSettings", n\)/, "只改了内存没存档");
  assert.match(app, /res\.skin \? "\\n\\n〔这个聊天窗的气泡已经换好了/, "改了不说一声，她不知道去哪儿再调");
});

// 四处一样喂：线上 OOC 和线下 OOC 是两个调用点。
// （群 OOC 不在这条里，是【说得出理由的差异】：这一层限死在
//  html[data-lisa-char="…"] 上，群聊那一页压根没有「这个人的气泡」这一层。）
test("线上线下两个 OOC 都接上，而且只写在一处", () => {
  assert.equal((app.match(/applyOocSkin\(charId, res\.skin\)/g) || []).length, 2, "两个调用点没都接上");
  assert.equal((app.match(/bubble: Object\.assign\(\{\}, base, skin/g) || []).length, 1, "合并方式抄了两份——改一处另一处永远落单");
});
