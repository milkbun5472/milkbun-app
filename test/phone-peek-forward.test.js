// 查手机 · 偷看转发（她 2026-08-29）：
// 「我想的是要转发给他才会注入上下文，不然不提一直在上下文里塞一堆他手机刷新出来的内容也不对。
//   还有发送给他的话语境上就是我偷看了他们手机看到的，得把握好他们的反应。」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const peekFn = app.match(/const forwardPhonePeekToChat = \(char, peek\) => \{[\s\S]*?\n  \};/);

test("手机内容不常驻上下文，只有转发才进聊天", () => {
  // v48.42 那条「查手机内容不喂进聊天 prompt」的注释必须还在——转发是它的补充，不是它的推翻
  assert.match(app, /查手机内容（歌单\/浏览器\/视频\/备忘\/录音）不再喂进聊天 prompt/);
  assert.ok(peekFn, "找不到 forwardPhonePeekToChat");
  // 只写进这一条消息，不去动任何常驻上下文字段
  assert.match(peekFn[0], /pChat\(char\.id, p => \[\.\.\.p, \{/);
  assert.doesNotMatch(peekFn[0], /ctxFor|recentChat|setPhones/);
});

test("转发的语境是「她翻了你的手机」，不是他自己提起的", () => {
  assert.match(peekFn[0], /\[我翻了你的手机\]在你的〈/);
  assert.equal(peekFn[0].indexOf("role: \"user\""), peekFn[0].lastIndexOf("role: \"user\""));
  assert.match(peekFn[0], /kind: "phonepeek"/);
});

test("三档语境各自写死了他该有的反应边界", () => {
  const tag = app.match(/const PHONE_PEEK_TAG = \{[\s\S]*?\n  \};/);
  assert.ok(tag, "找不到 PHONE_PEEK_TAG");
  const s = tag[0];
  ["open", "quiet", "hidden"].forEach(k => assert.ok(s.includes(k + ":"), k + " 这一档没有"));
  // quiet：他在意的是「被翻了」，不是内容本身
  assert.match(s, /是她自己翻你手机翻到的/);
  assert.match(s, /别一上来就配合地把内容解释一遍/);
  // hidden：被撞破，不是被问
  assert.match(s, /不是「她问了个问题」，是「他被撞破了」/);
  assert.match(s, /有权不答、反问、翻脸/);
});

test("框架写在 content 里，所以线上线下群聊读到的是同一份", () => {
  // 不是四处各挂一个钩子，是让它跟着消息本身走
  assert.match(peekFn[0], /content: "\[我翻了你的手机\]/);
  assert.match(peekFn[0], /PHONE_PEEK_TAG\[tier\]/);
  assert.match(app, /不必在四处各挂一个钩子/);
});

test("藏起来的东西走 hidden 档：小号、匿名、深夜、私密、最近删除", () => {
  // v57.54：深夜台成了独立 app，整个走 hidden 档
  assert.match(phone, /onPeek\(\{ tier: "hidden", label: "深夜台"/);
  assert.match(phone, /acc\.key === "main" \? "open" : "hidden"/);
  // 相册按分类判：private / deleted 是藏起来的，其余只是没主动说
  assert.match(phone, /const hid = photo\.category === "private" \|\| photo\.category === "deleted";/);
});

test("他没瞒着的东西走 open 档，别当成撞破", () => {
  assert.match(phone, /peekFoot\("open", "歌单"/);
});

test("没主动说的日常内容走 quiet 档", () => {
  // v57.60 浏览器也成了自绘整屏的组件，转发走它自己的 peekBtn
  ["他搜过的", "他没关的标签页", "他的书签"].forEach(l =>
    assert.ok(phone.includes('"' + l + '"'), l + " 没接转发"));
  // v57.56：备忘录和录音合成「便签」，转发走 StickyView 自己那颗按钮
  ["他的便签", "他录的一条"].forEach(l =>
    assert.ok(phone.includes('label: voice ? "他录的一条" : "他的便签"') || phone.includes('"' + l + '"'), l + " 没接转发"));
  // 购物 v57.50 起是自己画整屏的组件：整卡可点的走 onPeek({label:...})，
  // 卡底带按钮的走 peekBtn(...)，两种都算接上了
  ["想买清单", "他的订单", "购物习惯", "他给谁买的东西"].forEach(l =>
    assert.ok(phone.includes('label: "' + l + '"') || phone.includes('peekBtn("quiet", "' + l + '"'),
      l + " 没接转发"));
});

test("聊天里这条渲染成偷看卡，藏起来的那档一眼看得出不一样", () => {
  assert.match(comp, /function PhonePeekCard\(\{ m, isU \}\)/);
  assert.match(comp, /const hid = p\.tier === "hidden";/);
  assert.match(comp, /"翻他手机 · "/);
  assert.match(comp, /if \(m\.kind === "phonepeek"\)/);
  // 卡片读 m.peek，不把带反应指令的 content 原样显示出来
  assert.match(comp, /const p = m\.peek \|\| \{\};/);
});

test("所有非整屏的 app 共用同一条紧凑标题栏", () => {
  // mobile-ui-layout.md §1：返回键 + 居中小标题 + 右侧等宽操作位。
  // v57.59 起电话/浏览器/设置也并进来了——它们是最后三个还顶着 30px 大标题的
  //（她 2026-08-29：「有个界面没做但是忘记是哪个了」）。
  assert.match(phone, /FULL_BLEED_KEYS\.indexOf\(appKey\) < 0 && h\("div", \{\n    className: "shrink-0 px-4 pb-2 flex items-center gap-2"/);
  assert.match(phone, /paddingTop: safeTop\(10\)/);
  assert.match(phone, /const liveTitle = appKey === "music"/);
  assert.match(phone, /isLive \? liveTitle : zh/);
  // 右侧等宽占位，标题才真的居中
  assert.match(phone, /h\("div", \{ style: \{ width: 40, height: 40, display: "flex"/);
  // 通用大 Head 在查手机里已经没人用了
  assert.doesNotMatch(phone, /h\(Head, \{\n    zh,/);
});

test("全刷时只有正在生成的那个 app 转圈，别的照常能看", () => {
  assert.match(app, /setGen\(g => \(\{ \.\.\.g, phoneApp: "__all__:" \+ key \}\)\);/);
  assert.match(phone, /const allNowKey = String\(busyKey \|\| ""\)\.indexOf\("__all__"\) === 0/);
  assert.match(phone, /busyKey: allNowKey \|\| busyKey,/);
  // 已经有内容的 app 不该被 spinner 顶掉
  // v57.54 起视频不再是特例，这条判断从 else-if 变成了链首的 if
  assert.match(phone, /let content;\n  if \(loading && !data\) content = h\(Spinner/);
});

test("大号是默认身份，小号和匿名各有明确用途", () => {
  assert.match(app, /十次里有七八次都该是 main/);
  assert.match(app, /别因为内容稍微私人一点就躲进小号或匿名/);
  // 习惯那一行不能再说「通常偏向小号」——那是她报的病根之一
  assert.doesNotMatch(app, /通常偏向：" \+ \(forumHabit\.identityBias/);
  assert.match(app, /真需要遮一下的时候，他习惯用/);
  // 预设里最多一个偏小号
  const presets = app.match(/const FORUM_HABIT_PRESETS = \[[\s\S]*?\n  \];/)[0];
  assert.equal((presets.match(/identityBias: "alt"/g) || []).length, 1);
});

test("随机版块不再让匿名吧和别的版块等权", () => {
  const m = app.match(/const bs = \["吐槽吧".*?\];/);
  assert.ok(m);
  const all = m[0].match(/"[^"]+"/g);
  const anon = all.filter(x => x === '"匿名吧"').length;
  assert.equal(anon, 1);
  assert.ok(all.length >= 9, "总格子只有 " + all.length + " 个，匿名占比还是太高");
});
