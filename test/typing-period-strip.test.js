const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22 第二次反馈：v54.78 把「句尾不打句号」写回提示词、也确认送到了模型手里，
// 刷完还是有。上文一旦被带偏，几十条带句号的记录拉着模型往回走，提示词拔不过来。
// 所以加一道确定性兜底：气泡落库前削掉句尾那个句号。刀要钝得恰到好处——
// 削多了会毁掉语气和链接，削少了等于没削。

// 把函数原样抠出来跑，验的是真行为
const strip = new Function(
  engine.slice(engine.indexOf("function stripTypingPeriod(text) {"),
    engine.indexOf("\n}", engine.indexOf("function stripTypingPeriod(text) {")) + 2) +
  "\nreturn stripTypingPeriod;")();

test("该削的削掉", () => {
  assert.equal(strip("我知道了。"), "我知道了");
  assert.equal(strip("好。"), "好");
  assert.equal(strip("行吧．"), "行吧");          // 全角句点同理
  assert.equal(strip("嗯。  "), "嗯");            // 尾部空白一起清
});

test("传语气的一律不碰", () => {
  ["真的吗？", "太过分了！", "算了…", "没事~", "行吧～", "哈哈哈哈"].forEach(x =>
    assert.equal(strip(x), x, "误伤了 " + x));
  assert.equal(strip("等等。。。"), "等等。。。", "叠用句号是语气，不是句号");
  assert.equal(strip("好。。"), "好。。");
});

test("句中的句号不动——那多半是两句挤在一泡，削了会连读成一句", () => {
  assert.equal(strip("今天累死了。明天再说"), "今天累死了。明天再说");
  // 只有句尾那一个被削，前面的留着（拆泡在前，正常不会走到这一步）
  assert.equal(strip("今天累死了。明天再说。"), "今天累死了。明天再说");
});

test("英文句点留着：缩写、网址、小数点误伤不起", () => {
  ["http://a.com", "3.14", "Dr. Wang", "etc."].forEach(x =>
    assert.equal(strip(x), x, "误伤了 " + x));
});

test("收尾引号括号原样接回去，不许把气泡削空", () => {
  assert.equal(strip("他说「走吧。」"), "他说「走吧」");
  assert.equal(strip("（算了。）"), "（算了）");
  assert.equal(strip("。"), "。", "只剩句号就放弃——宁可留着也不发空泡");
  assert.equal(strip(""), "");
  assert.equal(strip(null), "");
});

test("单聊接在拆泡之后，群聊在取出每条时就地削", () => {
  assert.match(app, /if \(!_s\.engineerEyes && typeof stripTypingPeriod === "function"\) words = words\.map\(stripTypingPeriod\);/);
  // 顺序要紧：必须排在按句末标点拆泡【之后】，否则拆分找不到断句点
  const splitAt = app.indexOf("再把仍塞了一大段（多句）的按句末标点拆成一句一泡");
  const stripAt = app.indexOf("words = words.map(stripTypingPeriod)");
  assert.ok(splitAt > 0 && stripAt > splitAt, "削早了会毁掉拆泡");
  assert.match(app, /if \(item\.text && typeof stripTypingPeriod === "function" && !settingsFor\(spk\.id\)\.engineerEyes\) item\.text = stripTypingPeriod\(item\.text\);/, "群聊");
});

test("engineerEyes 的角色两条线路都跳过——他那条线连聊天规则都不注入", () => {
  assert.match(app, /!_s\.engineerEyes && typeof stripTypingPeriod/, "单聊要跳过");
  assert.match(app, /!settingsFor\(spk\.id\)\.engineerEyes\) item\.text = stripTypingPeriod/, "群聊要跳过");
  // 提示词那边本来就放过他，兜底不能反过来管得更宽
  assert.match(app, /_onlineRuntime = _s\.engineerEyes \? "" :/);
});

test("只管线上气泡：线下正文是叙事散文，标点该好好打", () => {
  assert.ok(!/stripTypingPeriod/.test(
    engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || ""),
    "线下不许被削");
  assert.equal((app.match(/stripTypingPeriod/g) || []).length, 4, "单聊 2 处引用 + 群聊 2 处，多了就是被塞进别的通道了");
});
