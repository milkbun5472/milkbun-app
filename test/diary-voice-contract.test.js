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

// 声纹仍被模板化(2026-08-18 Lisa):声纹块夹在 system 中段，压轴的却是真实性铁律
// 与 JSON 容器——落笔前读到的最后一样东西是格式规范。recency 最强的 user 消息
// 原先只有一句「开始写今天的日记」。
test("日记要在 recency 最强处放声纹守则，并有正向锚点", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(engine, /const voiceTail = /, "声纹守则要挂到 user 消息尾部");
  assert.match(engine, /content: \(retro \? "现在是今晚睡前[\s\S]{0,80}\) \+ voiceTail/, "user 消息必须带上尾部守则");
  assert.match(engine, /这是【说话】的样本，日记是【写字】/, "要说明如何把说话习惯换算成书写习惯");
  assert.match(engine, /【至少有一处只有他会写】/, "禁令之外必须有正向锚点");
  assert.match(engine, /划出一片谁站进去都安全的中间地带/, "要点明纯禁令导致的趋同");
});

// 老问题(Lisa 修过几次没好):过了零点必须点进日记页才开始生成。
// 根因是 useEffect([screen]) 只在 screen==="diary" 时才跑，锁也按「是否进过日记页」记。
test("日记自动补写不依赖进入日记页", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const diaryDayKey = new Date\(diaryTargetTs\(\)\)\.toDateString\(\)/, "要有按天算的键");
  assert.match(app, /\}, \[diaryDayKey, !!active\]\);/, "开 App 即跑，并在跨天时重跑");
  assert.match(app, /if \(diaryRunRef\.current === dayKey\) return;/, "锁改为按补写的那一天记");
  assert.doesNotMatch(app, /else diaryRunRef\.current = false; \/\/ 离开后下次再进重新判定/,
    "旧的屏幕型锁必须已移除，否则任意界面触发会被反复重置");
});
