// 她 2026-09-15：「我总觉得他们不是很主动发语音打电话之类的都是我问才会」。
//
// 查下来正是这个：voice 和 call 一直在 openCaps 里、能力字典里也写着长什么样，
// 可【从来没有一句说过什么时候该用】。同一批能力里，表情包有（跟着这个人的习惯走）、
// 照片有（Ta 让你拍／你想给 Ta 看／氛围正好……）——这两样一直空着。
// 模型手上只有一个格式、没有场合，就只在她点名的那一轮填。
// 跟 photo 那条注释里「分寸那半句是从被删掉的旧基线里救回来的」是同一种空白。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("单聊：voice 和 call 都得有「什么时候该用」，不能只有格式", () => {
  assert.match(app, /capState\.push\("voice：/, "语音没有场合那一句");
  assert.match(app, /capState\.push\("call：/, "电话没有场合那一句");
  // 关键的那半句：不必等她开口
  assert.match(app, /\*\*不必等 Ta 开口要\*\*/);
  assert.match(app, /\*\*不必等 Ta 提\*\*/);
  // 打了没人接不是失败——不说清楚的话模型会不敢打
  assert.match(app, /没接就是一条未接来电，本来就是这样/);
});

test("给场合不给配额：天花板还给人设，不许写成「每几轮发一条」", () => {
  const seg = app.slice(app.indexOf('capState.push("voice：'), app.indexOf('capState.push("call：') + 600);
  assert.match(seg, /按你这个人的习惯来/, "爱不爱发语音是人和人不一样的事");
  assert.match(seg, /一晚上一条都不发也成立/, "得给不发的那一头留出口");
  // 配额式的写法一个都不许有（施工规则/bans-make-it-dumber：掷轴、别掷答案）
  [/每\s*\d+\s*轮/, /至少.{0,4}一条/, /必须发/].forEach(re =>
    assert.doesNotMatch(seg, re, "写成配额了：" + re));
});

test("群聊那两个字段原来是减速带，现在换成判据", () => {
  // 原来写的是「偶尔用」和「别频繁」——那是答案不是判据，而且方向正好跟她要的相反
  const spec = app.slice(app.indexOf('\\"voice\\":\\"（可选）填 true'), app.indexOf('\\"call\\":\\"（可选）填 voice 或 video') + 400);
  assert.ok(spec.indexOf("偶尔用") < 0, "群里语音还挂着「偶尔用」");
  assert.ok(spec.indexOf("别频繁") < 0, "群里通话还挂着「别频繁」");
  assert.match(spec, /不必等人问/);
  assert.match(spec, /要有真的理由/, "群里拨电话会弹来电，这一条约束要留着，但得是判据");
});
