const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const cp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const card = cp.slice(cp.indexOf("function StateCard({"), cp.indexOf("// 线下模式（赴约）"));
const shell = cp.slice(cp.indexOf("const HEART_D ="), cp.indexOf("function StateCard({"));

// 她 2026-09-01：「重做心声卡样式吧，现在的有点无聊，而且是半屏，改成屏幕中间的框」
test("心声卡是屏幕正中的一个框，不再是半窗", () => {
  assert.ok(card.indexOf("Sheet") < 0, "还在掀半窗");
  assert.match(card, /return h\(CenterCard, \{ onClose: onClose \}/, "没走居中那个壳");
  assert.match(shell, /className: "absolute inset-0 z-50 flex items-center justify-center"/, "壳不是居中的");
  assert.ok(shell.indexOf("items-end") < 0, "壳还是从底下掀起来的");
  // 一个滚动容器，头尾不跟着滚（mobile-ui-layout §3）
  assert.match(shell, /maxHeight: "82vh"/, "没有高度上限，内容一多会顶出屏幕");
  assert.match(card, /className: "flex-1 min-h-0 overflow-y-auto"/, "正文不是那个唯一的滚动容器");
  assert.match(card, /className: "shrink-0 flex items-center gap-3"/, "抬头会跟着正文一起滚");
});

// 她 2026-09-01：「我发现我们这个和最后一张图的 category 完全一样是不是得改改」
test("五个分栏不再是参考里那一套", () => {
  // 原来：实时心情 / 对你的好感度 / 穿着 / 动作 / 内心想法——跟她截图里那个一字不差
  ["实时心情", "内心想法"].forEach(bad =>
    assert.ok(card.indexOf('"' + bad + '"') < 0, "还留着撞车的那一栏：" + bad));
  assert.ok(card.indexOf('"对你的好感度"') < 0, "还留着撞车的那一栏：对你的好感度");
  // 穿着/动作这两个词只准出现在【读数据的字段名】上，不准再当小标题
  assert.ok(card.indexOf('label("穿着")') < 0 && card.indexOf('label("动作")') < 0, "穿着/动作还各占一个小标题");
  // 换成三栏
  assert.match(card, /label\("看得见的"\)/, "没有「看得见的」");
  assert.match(card, /label\("心里想的", t\.accent\)/, "没有「心里想的」");
  assert.match(card, /label\("好感度"\)/, "没有「好感度」");
});

test("心情长在抬头那一行上，不再单独占一张卡", () => {
  const head = card.slice(card.indexOf("const head = h("), card.indexOf("const tabs ="));
  assert.match(head, /\(!isNpc && dm\) \? h\("span", \{ style: \{ color: t\.accent \} \}, dm\.label\)/, "心情没挨着名字");
  assert.match(head, /dm && dm\.def \? "聊几句就会变"/, "默认心情没交代");
  assert.match(head, /dm && dm\.faded \? "已经平复下去了"/, "平复过的没交代");
  assert.match(head, /timeAgo\(dm\.ts\) \+ "变的"/, "看不出这心情是什么时候写的");
});

test("看得见的那半是一块两拍，不是两张并排的卡", () => {
  const seen = card.slice(card.indexOf('label("看得见的")') + 16, card.indexOf('label("心里想的"'));
  assert.equal((seen.match(/label\(/g) || []).length, 0, "这一块里又多出了小标题");
  // 身上什么样是轻的一行，手在做什么才是主句
  assert.match(seen, /fontSize: 12, lineHeight: 1\.7, color: t\.sub[\s\S]{0,40}S\(state\.wearing\)/, "穿着不是轻的那一行");
  assert.match(seen, /fontSize: 15, lineHeight: 1\.75, color: t\.ink[\s\S]{0,60}S\(state\.action\)/, "动作不是主句");
  // 群聊里照旧不给看穿着和动作
  assert.match(card, /\(!hideWearAction && seen\.length\)/, "群聊里也把穿着动作端出来了");
});

// 她 2026-09-01：「做个心形的水位表，心形中间显示好感，根据数字决定颜色多满」
test("好感度是一颗会灌满的心，不是进度条也不是尺", () => {
  const sc = card.slice(card.indexOf("const heartInk ="), card.indexOf("const body ="));
  assert.match(shell, /const HEART_D = "M12 21\.35/, "没有心形");
  assert.match(sc, /clipPath: "url\(#sc-heart\)"/, "水位没裁进心里，那就只是块色");
  assert.match(sc, /y: 24 \* \(1 - lvl\), width: 24, height: 24 \* lvl/, "水位不跟着分数走");
  assert.match(sc, /const heartInk = aff >= 80 \? "#b83b4e" : aff >= 60 \? "#c4606f" : aff >= 40 \? "#c58089" : aff >= 20 \? "#b08a86" : "#8794a6";/,
    "颜色不跟着分数变");
  // 数字压在心中间，而且得读得清
  assert.match(sc, /alignItems: "center", justifyContent: "center"[\s\S]{0,180}\}, aff\)/, "数字没压在心中间");
  assert.match(sc, /WebkitTextStroke: "3px " \+ t\.bg2, paintOrder: "stroke"/, "数字压在水位上会看不清");
  // 旧那条尺撤干净了
  assert.ok(sc.indexOf("[0, 25, 50, 75, 100]") < 0, "旧那条刻度尺还留着");
  // NPC 没有好感度这回事
  assert.match(card, /const scale = isNpc \? null :/, "NPC 也摆了好感度");
});

test("长名字撑不坏抬头", () => {
  const head = card.slice(card.indexOf("const head = h("), card.indexOf("const tabs ="));
  assert.equal((head.match(/whiteSpace: "nowrap"/g) || []).length, 2, "名字和心情那两行没都锁成不换行");
  assert.equal((head.match(/textOverflow: "ellipsis"/g) || []).length, 2, "超长了没打点");
  assert.ok(head.indexOf("flex items-baseline gap-2") < 0, "名字和心情还挤在同一行");
});

// 她 2026-09-01：「这一个白框还是无聊，再弄点装饰吧」
test("卡上有装饰，但都从「一帧」这件事长出来", () => {
  assert.match(shell, /repeating-linear-gradient\(112deg/, "没有纸纹，还是一块纯色");
  assert.match(shell, /borderTop: "3px solid " \+ t\.accent/, "顶上没有那道线");
  // 取景框四角：这张卡讲的就是此刻的一帧
  assert.match(card, /borderWidth: "1px 0 0 1px"/, "取景框缺左上角");
  assert.match(card, /borderWidth: "0 1px 1px 0"/, "取景框缺右下角");
  // 压在心声底下的那个大引号
  assert.match(card, /fontSize: 92, lineHeight: 1, color: t\.accent, opacity: \.07/, "心声那块没有压底的引号");
});

test("深色主题下不许白底白字", () => {
  // 连 "1px solid #fff" 这种嵌在里面的也要抓：深色主题里 t.ink 是近白色
  // 唯一允许的一处：心里水面那道亮边（它压在自己那块朱色上，不受主题影响）
  const whites = (card.match(/#fff/g) || []).length + (shell.match(/#fff/g) || []).length;
  assert.equal(whites, 1, "除了水面那道亮边，不许再写死 #fff");
  assert.match(card, /fill: "#fff", opacity: \.5/, "那一处 #fff 不是水面那道亮边");
  assert.ok(!/#ffffff|rgb\(255, ?255, ?255\)/i.test(card + shell), "换个写法写死了纯白");
  assert.match(shell, /transparent 1px 7px\)," \+ t\.bg2/, "框的底色没走主题");
});
