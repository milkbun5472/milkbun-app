const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 把解析器那一段原样跑起来
function loadParser() {
  const i = screens.indexOf("function cardFillNames");
  const j = screens.indexOf("function CardImportSheet");
  assert.ok(i > 0 && j > i && j - i < 9000, "抠不出角色卡解析那一段");
  return new Function(screens.slice(i, j) + "\nreturn { parseCharCard, cardFromJSON, cardStripScaffold, cardFillNames };")();
}
const { parseCharCard, cardFromJSON } = loadParser();

const V2 = JSON.stringify({
  spec: "chara_card_v2",
  data: {
    name: "裴照川",
    description: "{{char}} 是大靖永安王。他对 {{user}} 嘴硬心软。",
    personality: "冷面、护短",
    scenario: "{{user}} 刚从江南回京",
    first_mes: "你回来了。{{user}}，过来。",
    mes_example: "<START>\n{{user}}: 王爷。\n{{char}}: 嗯。",
    creator_notes: "永安王 · 古代权谋向",
    character_book: { entries: [{ content: "王府在城西。", constant: true }, { content: "他母亲早逝。" }] }
  }
});

// 她 2026-08-30：「导入角色卡那个格式还是有点不对劲，经常导入了格式还是不对」。
// 病根：一张酒馆 JSON 卡以前认不出来，会连大括号一起当人设塞进去。
test("酒馆 v2 的 JSON 卡按字段拆开，不是整坨当人设", () => {
  const p = parseCharCard(V2, "Lisa");
  assert.equal(p.from, "json");
  assert.equal(p.name, "裴照川");
  assert.doesNotMatch(p.persona, /[{}]|"description"|chara_card/, "JSON 原文漏进人设了");
  assert.match(p.persona, /大靖永安王/);
  assert.match(p.persona, /冷面、护短/, "personality 丢了");
  assert.match(p.persona, /刚从江南回京/, "scenario 丢了");
});

test("酒馆 v1 那种扁平 JSON 也认", () => {
  const p = parseCharCard(JSON.stringify({ name: "阿屿", description: "海洋所读研。", personality: "温吞", first_mes: "……你也来看海？" }), "Lisa");
  assert.equal(p.from, "json");
  assert.equal(p.name, "阿屿");
  assert.equal(p.greeting, "……你也来看海？");
});

test("卡里的世界书落成世界书词条（不再塞进记忆种子），constant 的那条常驻", () => {
  const p = parseCharCard(V2, "Lisa");
  assert.equal(p.seeds.length, 0);
  assert.equal(p.lore.length, 2);
  assert.equal(p.lore.filter(e => e.alwaysOn).length, 2, "没关键词的条目也得常驻，不然永远翻不出来");
  assert.match(p.lore[0].payload, /王府在城西/);
});

// 占位符原来要她自己手动换（codex 里还写着这条注意事项），现在导入时就换掉
test("{{char}} 换成角色名、{{user}} 换成她的名字", () => {
  const p = parseCharCard(V2, "Lisa");
  assert.doesNotMatch(p.persona + p.greeting, /\{\{|<\s*(BOT|USER)\s*>/i, "还有占位符没换");
  assert.match(p.persona, /裴照川 是大靖永安王/);
  assert.match(p.persona, /他对 Lisa 嘴硬心软/);
  assert.match(p.greeting, /Lisa/);
});

test("对话示例（<START> / mes_example）不导入，而且明说了", () => {
  const p = parseCharCard(V2, "Lisa");
  assert.doesNotMatch(p.persona, /王爷。|<START>/, "例句脚手架漏进人设了");
  assert.ok(p.warnings.some(w => /对话示例/.test(w)), "没告诉她例句被丢掉了");
});

test("<START> 之后那一段从纯文本卡里也要切掉", () => {
  const p = parseCharCard("## 人设\n他是个王爷。\n<START>\n你: 王爷。\n他: 嗯。", "Lisa");
  assert.equal(p.persona, "他是个王爷。");
});

// 老格式不能退化
test("## 分节的老卡照旧能拆", () => {
  const p = parseCharCard("# 裴照川 · 角色卡\n## 人设\n大靖永安王。\n## 长期记忆\n城西第一次见。\n## 记忆库种子\n1. 〔置顶〕他不吃羊肉。\n2. 他左腕有旧疤。", "Lisa");
  assert.equal(p.name, "裴照川");
  assert.equal(p.persona, "大靖永安王。");
  assert.equal(p.longMem, "城西第一次见。");
  assert.equal(p.seeds.length, 2);
  assert.equal(p.seeds[0].pinned, true);
  assert.equal(p.seeds[0].text, "他不吃羊肉。");
});

// 原来只认 ## 一种分节，别的卡一律掉进「整篇当人设」的兜底
test("【】/ **加粗** / # 这几种分节也认，值写在同一行也认", () => {
  const a = parseCharCard("【名字】裴照川\n【一句话】永安王，嘴硬心软\n【人设】\n大靖永安王。\n【开场白】\n你回来了。", "Lisa");
  assert.equal(a.name, "裴照川");
  assert.equal(a.tagline, "永安王，嘴硬心软");
  assert.equal(a.persona, "大靖永安王。");
  assert.equal(a.greeting, "你回来了。");
  const b = parseCharCard("**姓名**：阿屿\n**人设**\n海洋所读研。\n**长期记忆**\n码头见的。", "Lisa");
  assert.equal(b.name, "阿屿");
  assert.equal(b.persona, "海洋所读研。");
  assert.equal(b.longMem, "码头见的。");
});

test("带冒号那种分节只认名单里的词，正文里的「他说：」不算标题", () => {
  const p = parseCharCard("人设：\n他是个王爷。\n他说：\n这句话不该切成一节。", "Lisa");
  assert.match(p.persona, /他是个王爷/);
  assert.match(p.persona, /这句话不该切成一节/, "正文被「他说：」切断了");
});

test("什么结构都没有就整篇当人设，绝不导入失败", () => {
  const p = parseCharCard("这是一个很普通的人。\n他喜欢下雨天。", "Lisa");
  assert.equal(p.from, "text");
  assert.match(p.persona, /很普通的人/);
  assert.match(p.persona, /下雨天/);
});

test("带手机/输出格式脚手架的卡会提醒她", () => {
  const p = parseCharCard("## 人设\n他是个王爷。\n## 输出格式\n每次回复必须带手机状态栏。", "Lisa");
  assert.ok(p.warnings.some(w => /脚手架/.test(w)));
});

test("不是 JSON 的文本不许被 cardFromJSON 认走", () => {
  assert.equal(cardFromJSON("## 人设\n他是个王爷。"), null);
  assert.equal(cardFromJSON("{ 这不是 JSON"), null);
  assert.equal(cardFromJSON('{"foo":1}'), null, "没有任何角色字段的对象不该算角色卡");
});

// 名字认不出来的时候，原来只能先导进去再去档案里改；
// 她 2026-10-05：格式有时候拆错，预览每一栏都要能手动改，还要能直接选 docx 文件
test("预览每一栏都能改，改过的带进导入；能从文件导入", () => {
  const i = screens.indexOf("function CardImportSheet");
  const j = screens.indexOf("function MemImportSheet", i);
  assert.ok(i > 0 && j > i, "抠不出导入页");
  const sheet = screens.slice(i, j);
  for (const k of ["name", "tagline", "persona", "longMem", "seeds", "greeting"]) {
    assert.match(sheet, new RegExp('setVal\\("' + k + '"|box\\("' + k + '"'), k + " 没有可编辑的框");
  }
  assert.match(sheet, /seeds: textToSeeds\(val\("seeds"\)\)/, "改过的种子没被带进导入");
  assert.match(sheet, /persona: persona\.trim\(\)/, "改过的人设没被带进导入");
  assert.match(sheet, /readOfflineStyleDocument\(file\)/, "文件导入没走公共的 docx 读取");
  assert.match(sheet, /accept: "\.docx/, "选不了 docx");
});

// no-half-sheet.md：这一页要装粘贴框＋预览＋一串提醒，半窗先扣掉一半屏幕
test("导入页是整页，不是半窗", () => {
  const i = screens.indexOf("function CardImportSheet");
  const j = screens.indexOf("function MemImportSheet", i);
  const sheet = screens.slice(i, j);
  assert.doesNotMatch(sheet, /h\(Sheet,/, "又改回半窗了");
  assert.match(sheet, /h-full flex flex-col/);
  assert.match(sheet, /flex-1 min-h-0 overflow-y-auto/);
  // ⚠️v64.90 起顶栏走共用 Head，刘海归它让（mobile-ui-layout.md §1）
  assert.match(sheet, /h\(Head, \{ zh: "导入角色卡", bg: "transparent", onBack: onClose \}\)/, "顶栏没走共用 Head");
});
