const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-08-27：「群聊的思考链能看出它在想怎么演，但是单聊还是在 summarize」。
// 单聊这一轮的末尾堆着十来段字段作业，模型读到的最后两千字全是记账，思考也跟着变成清点。
// 群聊末尾是「输出一个数组，谁说什么」，任务本身就是演。
test("单聊每轮的【最后一句】是要演的那件事，不是记账", () => {
  const i = app.indexOf("const _turnClosing =");
  assert.ok(i > 0, "收尾那一句没了");
  const seg = app.slice(i, i + 800);
  assert.match(seg, /顺手记的账/, "得说清字段不是任务");
  assert.match(seg, /别先在心里把上面的对话复述一遍再总结一遍/, "得直说别在思考里做流水账");
  // 位置要紧：拼在整串最末尾，模型临落笔前读到的就是它
  assert.match(app, /crossSamenessHint\(charId\) \+ _biTurnLine \+ _turnClosing\)/, "没拼在每轮任务串的最后");
});

test("它是引导不是保证——代码里得写着这句，别下次有人当成修好了", () => {
  const i = app.indexOf("const _turnClosing =");
  const why = app.slice(Math.max(0, i - 900), i);
  assert.match(why, /这是提示词层的引导，不是保证/);
  assert.match(why, /思考链是模型自己的/);
});

// 只加在单聊线上：差异要显式、要写理由（.claude/rules/four-surfaces-same-context.md）
test("只加在单聊线上，理由写在代码里", () => {
  assert.equal((app.match(/_turnClosing/g) || []).length, 2, "只该有一处定义 + 一处拼接");
  const i = app.indexOf("const _turnClosing =");
  const why = app.slice(Math.max(0, i - 900), i);
  assert.match(why, /群聊本来就没这毛病/);
  assert.match(why, /线下那一轮的任务是写一整段场景/, "线下为什么不接，要写清楚");
});

test("言秋那条线拿不到它——他走的是数字生命那串", () => {
  assert.match(app, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskV2;/);
  const dig = app.slice(app.indexOf("const _digitalTaskFull ="), app.indexOf("const _normalTaskFull ="));
  assert.doesNotMatch(dig, /_turnClosing/, "数字生命那串不许沾");
});
