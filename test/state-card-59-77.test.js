const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const cp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const card = cp.slice(cp.indexOf("function StateCard({"), cp.indexOf("// 线下模式（赴约）"));
const shell = cp.slice(cp.indexOf("function CenterCard({"), cp.indexOf("function StateCard({"));

// 她 2026-09-01：「重做心声卡样式吧，现在的有点无聊，而且是半屏，改成屏幕中间的框」
test("心声卡是屏幕正中的一个框，不再是半窗", () => {
  assert.ok(card.indexOf("Sheet") < 0, "还在掀半窗");
  assert.match(card, /return h\(CenterCard, \{ onClose: onClose \}/, "没走居中那个壳");
  assert.match(shell, /className: "absolute inset-0 z-50 flex items-center justify-center"/, "壳不是居中的");
  assert.ok(shell.indexOf("items-end") < 0, "壳还是从底下掀起来的");
  // 一个滚动容器，头尾不跟着滚（mobile-ui-layout §3）
  assert.match(shell, /maxHeight: "82vh"/, "没有高度上限，内容一多会顶出屏幕");
  assert.match(card, /className: "flex-1 min-h-0 overflow-y-auto"/, "正文不是那个唯一的滚动容器");
  assert.match(card, /className: "shrink-0 flex items-start gap-3"/, "抬头会跟着正文一起滚");
});

// 她 2026-09-01：「我发现我们这个和最后一张图的 category 完全一样是不是得改改」
test("五个分栏不再是参考里那一套", () => {
  // 原来：实时心情 / 对你的好感度 / 穿着 / 动作 / 内心想法——跟她截图里那个一字不差
  ["实时心情", "对你的好感度", "内心想法"].forEach(bad =>
    assert.ok(card.indexOf('"' + bad + '"') < 0, "还留着撞车的那一栏：" + bad));
  // 穿着/动作这两个词只准出现在【读数据的字段名】上，不准再当小标题
  assert.ok(card.indexOf('label("穿着")') < 0 && card.indexOf('label("动作")') < 0, "穿着/动作还各占一个小标题");
  // 换成三栏
  assert.match(card, /label\("看得见的"\)/, "没有「看得见的」");
  assert.match(card, /label\("没说出口的", t\.accent\)/, "没有「没说出口的」");
  assert.match(card, /label\("他心里给你打的分"\)/, "没有「他心里给你打的分」");
});

test("心情长在抬头那一行上，不再单独占一张卡", () => {
  const head = card.slice(card.indexOf("const head = h("), card.indexOf("const tabs ="));
  assert.match(head, /"· " \+ dm\.label/, "心情没跟名字排在一行");
  assert.match(head, /dm && dm\.def \? "还没聊出心情，聊几句就会变"/, "默认心情没交代");
  assert.match(head, /dm && dm\.faded \? "已经随时间平复下去了"/, "平复过的没交代");
  assert.match(head, /"上一次变是 " \+ timeAgo\(dm\.ts\)/, "看不出这心情是什么时候写的");
});

test("看得见的那半是一块两拍，不是两张并排的卡", () => {
  const seen = card.slice(card.indexOf('label("看得见的")') + 16, card.indexOf('label("没说出口的"'));
  assert.equal((seen.match(/label\(/g) || []).length, 0, "这一块里又多出了小标题");
  // 身上什么样是轻的一行，手在做什么才是主句
  assert.match(seen, /fontSize: 12, lineHeight: 1\.7, color: t\.sub[\s\S]{0,40}S\(state\.wearing\)/, "穿着不是轻的那一行");
  assert.match(seen, /fontSize: 15, lineHeight: 1\.75, color: t\.ink[\s\S]{0,60}S\(state\.action\)/, "动作不是主句");
  // 群聊里照旧不给看穿着和动作
  assert.match(card, /\(!hideWearAction && seen\.length\)/, "群聊里也把穿着动作端出来了");
});

test("分数只有一个就别做成一排进度条", () => {
  const sc = card.slice(card.indexOf("const scale ="), card.indexOf("const body ="));
  assert.match(sc, /\[0, 25, 50, 75, 100\]\.map\(v =>/, "不是一条带刻度的尺");
  assert.match(sc, /left: Math\.max\(0, Math\.min\(100, aff\)\) \+ "%"/, "墨点没站在当下的位置");
  assert.ok(sc.indexOf("width: aff") < 0 && sc.indexOf("aff + \"%\", height") < 0, "又做成了进度条");
  // NPC 没有好感度这回事
  assert.match(card, /const scale = isNpc \? null :/, "NPC 也摆了一条好感度");
});

test("深色主题下不许白底白字", () => {
  // 连 "1px solid #fff" 这种嵌在里面的也要抓：深色主题里 t.ink 是近白色
  assert.ok(card.indexOf("#fff") < 0 && shell.indexOf("#fff") < 0, "写死了 #fff");
  assert.ok(!/#ffffff|rgb\(255, ?255, ?255\)/i.test(card + shell), "换个写法写死了纯白");
  assert.match(shell, /background: t\.bg2/, "框的底色没走主题");
});
