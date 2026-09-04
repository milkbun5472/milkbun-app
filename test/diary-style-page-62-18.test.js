// 日记档案（v62.18，她 2026-09-04 点名）：
// ① 原型（mbti）栏删掉——全 app 没有任何一处读它，是个纯装饰的死字段；
// ② 签名接进日记提示词（原来只画在封面上，写日记的人自己反而不知道）；
// ③ 标签和灰字里的英文、内容示范清掉（no-english-titles + prompt-no-content-samples）；
// ④ 顺手从半窗换成整页（no-half-sheet）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const page = (() => {
  const i = screens.indexOf("function DiaryStylePage(");
  assert.ok(i > 0, "没有整页版的日记档案");
  return screens.slice(i, screens.indexOf("\nfunction ", i + 10));
})();

test("原型（mbti）栏删干净了——那是个没人读的死字段，不许复活", () => {
  for (const src of [screens, app, engine]) assert.ok(!/\.mbti\b|\bmbti:/.test(src), "还有地方在读写 mbti");
  assert.ok(page.indexOf("ARCHETYPE") < 0 && page.indexOf("原型") < 0, "原型栏还在");
});

test("档案卡整个真生效：文风和签名都进日记提示词", () => {
  assert.match(engine, /char\.diaryStyle && char\.diaryStyle\.trim\(\)/, "文风没进提示词");
  assert.match(engine, /【他写给自己的那句签名】/, "签名没进提示词");
  // 签名只是调性参照，不许被抄成每篇的落款
  assert.match(engine, /不要每篇日记都把它抄进正文或当落款/, "没拦住「每篇都抄签名」");
});

test("标签无英文、灰字无内容示范", () => {
  assert.ok(page.indexOf("MOTTO") < 0 && page.indexOf("ISFJ") < 0, "标签或灰字里还有英文");
  // prompt-no-content-samples：placeholder 只写【说明】。原来那句「反正你是我的」被照抄的话就是灾难
  assert.ok(page.indexOf("反正你是我的") < 0 && page.indexOf("疯批学者") < 0, "灰字里还塞着能被照抄的样例内容");
  assert.match(page, /换个人还成立的描述，等于没写/, "文风那栏没给判据");
});

test("整页，不是半窗（no-half-sheet）；旧的 DiaryStyleSheet 不留", () => {
  assert.ok(page.indexOf("h(Sheet") < 0, "还是半窗");
  assert.match(page, /className: "h-full flex flex-col"/, "不是整页外壳");
  assert.match(page, /h\(Head, \{ zh: "日记档案"/, "没用紧凑标题栏");
  assert.match(page, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是主滚动容器");
  assert.ok(screens.indexOf("DiaryStyleSheet") < 0, "旧半窗组件还有引用");
  // 两个入口都走提前 return 的整页，不再叠在原视图后面
  assert.match(screens, /if \(styleEdit\) \{\s*\n\s*const sc = characters\.find/, "没有整页入口");
});
