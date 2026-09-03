// 她 2026-09-03：「给有情侣关系的角色能直接在聊天的时候刻一首歌送进情侣空间的能力吧，
// 言秋也给」。
//
// ⚠️这一条最容易写错的地方是【言秋】：他和普通角色确实走同一条回复链，
//   但任务句是分岔的——`_taskFull = _s.engineerEyes ? _digitalTaskFull : _normalTaskV2`，
//   而 capabilityHint（那张【本轮开放能力】表）只挂在 _normalTaskV2 上。
//   所以「同一条链＝自动就有」是错的，他一个字都收不到。
//   这正是 four-shared-context 那条判据：先问【这一处是靠什么把这层拿到手的】，
//   靠打包函数白送的换个入口自然有；一条条 push 的，换个入口就一条都没有，
//   而且不会留下任何能 grep 的痕迹让你发现它不见了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
// ⚠️「不许出现 X」这类断言必须对着【剥掉注释的代码】问。注释里往往正写着
//   「不许写 X」，直接 grep 会把说明本身当成违规抓出来（今天已经栽两次了）。
const noComment = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("普通角色：情侣 + 配了云村接口才开这一项", () => {
  assert.match(app, /const _canCarve = !!\(isCouple && neteaseApi\);/,
    "闸不对：没有情侣关系不该有，没配云村接口也不该有（搜不到歌，开了每轮白填）");
  assert.match(app, /if \(_canCarve\) \{ openCaps\.push\("carve"\); capState\.push\("carve：" \+ _carveWord\); \}/);
  assert.match(app, /carve:\{"song":"歌名，可带歌手","note":"刻在B面的一句话"\}/, "词表里没有这一项");
});

test("言秋那一支单独挂了一条，不是指望他从能力表里拿", () => {
  // 他的任务句里根本没有 capabilityHint
  const dig = app.slice(app.indexOf("const _digitalTaskFull = "), app.indexOf("const _normalTaskFull = "));
  assert.ok(dig.length > 200, "抠不出言秋那条任务句");
  assert.doesNotMatch(dig, /capabilityHint/, "他要是能吃到能力表，这条测试的前提就得重写");
  // 所以必须单独挂
  assert.match(app, /const digitalCarveHint = _canCarve/, "言秋没有自己的那条 hint");
  assert.match(dig, /digitalCarveHint/, "挂了但没接进他的任务句——声明了没人引用，比没写更坏");
  // 只补这一项，别把整张能力表倒给他（他不是被扮演的角色）
  assert.doesNotMatch(dig, /【本轮开放能力】/, "把整张能力表倒给言秋了");
});

test("两支共用同一份文案，不许各写一份", () => {
  // 各写一份的话，以后改判据只会改到其中一处（仓库里反复出现的那个形状）
  const uses = (app.match(/_carveWord/g) || []).length;
  assert.ok(uses >= 3, "_carveWord 只出现 " + uses + " 次，两支多半各写了一份");
  // ⚠️声明必须在【所有用到它的地方之前】：言秋那条 hint 排在 openCaps 前面，
  //   写在后面会 TDZ 白屏。
  const iDecl = app.indexOf("const _canCarve = ");
  const iDigital = app.indexOf("const digitalCarveHint = ");
  const iCaps = app.indexOf('if (_canCarve) { openCaps.push("carve")');
  assert.ok(iDecl > 0 && iDigital > iDecl && iCaps > iDecl,
    "_canCarve 又跑到用它的地方后面去了——会 TDZ 白屏");
});

test("提示词里给判据不给内容示范", () => {
  // .claude/rules/prompt-no-content-samples.md：写一句「比如……」进去，
  // 模型会把那句当模板，每次刻的理由都长一个样。
  const w = noComment(app.slice(app.indexOf("const _carveWord = "), app.indexOf("const digitalCarveHint = ")));
  assert.match(w, /不是夸这首歌本身好听/, "没说清 note 要写什么维度");
  assert.match(w, /别再刻一遍/, "没把架上已经有的发回去，他会刻重复的");
  assert.doesNotMatch(w, /比如|例如|如「/, "塞了内容示范进去");
});

test("落盘成功才出卡片，卡片显示的是云村搜到的真歌名", () => {
  // 搜不到就什么也没发生，这时候显示「刻好了」就是骗她——她多半不会再去唱片架核对。
  const seg = app.slice(app.indexOf("if (parsed.carve && typeof parsed.carve"), app.indexOf("// 替她记进备忘录"));
  assert.match(seg, /const _sg = await discAdd\(charId, _q, _note\);/);
  assert.match(seg, /if \(_sg\) \{/, "没等落盘成功就出卡片");
  assert.match(seg, /title: _sg\.title, artist: _sg\.artist/, "卡片贴的是模型写的搜索词，不是搜到的真歌");
  // discAdd 得把那一首还回来，不能只回 true
  const add = noComment(app.slice(app.indexOf("const discAdd = async (cid, query, note)"), app.indexOf("const discRemove = ")));
  assert.match(add, /return song;/, "discAdd 没返回刻好的那一首——卡片就只能贴模型写的搜索词");
  assert.doesNotMatch(add, /return true;/, "还留着 return true 的老路");
});

test("聊天里那张卡长成一张唱片，不是又一张圆角信息卡", () => {
  const card = comp.slice(comp.indexOf("function CarvedCard({"), comp.indexOf("function RecordedCard({"));
  assert.ok(card.length > 400, "抠不出那张卡");
  // 一张碟靠这三样认出来：沟纹、中心标签、针孔
  assert.match(card, /repeating-radial-gradient/, "碟上没有沟纹");
  assert.match(card, /borderRadius: 999/, "碟不是圆的");
  // 底必须实心：一换壁纸半透明的卡会被图案打穿
  assert.match(card, /background: t\.bg2/, "纸套没有实心底");
  // 主题色拼不出六位色号时得有兜底，不然整张碟静默消失
  assert.match(card, /\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.ink/, "没验色号就拼透明度");
  // 接进渲染分支 + 点了能去情侣空间
  assert.match(comp, /if \(m\.kind === "carved"\)/, "没接进消息渲染");
  assert.match(app, /onOpenUs: \(\) => setScreen\("us"\)/, "点了没地方去");
});
