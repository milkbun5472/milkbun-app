const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");

test("日记以角色选择性记忆写作，不再逐条拼聊天摘要", () => {
  assert.match(engine, /只挑【这个角色本人到睡前还会惦记的 1~3 个瞬间】写/);
  assert.match(engine, /不要逐条复述，不追求覆盖完整/);
  assert.match(engine, /不要站到自己外面解释/);
  assert.match(engine, /严格保持这个角色自己的声纹/);
  // v53.50:秘密不再是「0~2 个」的配额感表述，改为「0 个才是常态、至多 2 个」，
  // 并明令它不是文末升华句——Lisa 反馈每篇都在最后拿它拔高立意。
  assert.match(engine, /全篇 0 个才是常态/);
  assert.match(engine, /全篇至多 2 个/);
  assert.match(engine, /它不是文末的升华句/);
  assert.doesNotMatch(engine, /全篇有 1~3 个这样的一句话 secret 段就够/);
});

// 三个塌缩(2026-08-18 Lisa):标题清一色是当天日期、每篇结尾都用 secret 段升华、
// 每篇长度都差不多。前两个都是提示词自己给的最省力路径。
test("日记的标题、秘密、长短都不许塌缩成同一个模子", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  // 界面本来就用日期兜底，所以提示词不该再把日期当成可选标题
  assert.match(screens, /entry\.titleEn \|\| entry\.titleZh \|\| dateStr/);
  assert.match(engine, /两个字段都留空/, "不取标题的人应留空，由界面显示日期");
  assert.doesNotMatch(engine, /可以只填日期\/编号/, "旧的日期当标题的省力路径必须已移除");
  assert.match(engine, /禁止把它固定放在最后一段当收尾/);
  assert.match(engine, /篇篇一样长本身就是假的/, "长短要由这一天决定");
});
